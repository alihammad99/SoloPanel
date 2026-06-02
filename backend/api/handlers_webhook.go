package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/panel/backend/db"
	"github.com/panel/backend/services"
)

func handleGithubWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		writeError(w, "read error", http.StatusBadRequest)
		return
	}

	event := r.Header.Get("X-Github-Event")
	if event != "push" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var payload struct {
		Ref        string `json:"ref"`
		Repository struct {
			SSHURL  string `json:"ssh_url"`
			HTMLURL string `json:"html_url"`
		} `json:"repository"`
		HeadCommit struct {
			ID string `json:"id"`
		} `json:"head_commit"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		writeError(w, "invalid payload", http.StatusBadRequest)
		return
	}

	// Find app by repo URL (match ssh or https variant)
	sshURL := payload.Repository.SSHURL
	htmlURL := payload.Repository.HTMLURL
	var app db.App
	result := db.DB.Where("repo_url = ? OR repo_url = ?", sshURL, htmlURL).First(&app)
	if result.Error != nil {
		// Try partial match stripping .git suffix
		bare := strings.TrimSuffix(sshURL, ".git")
		result = db.DB.Where("repo_url LIKE ?", "%"+bare+"%").First(&app)
		if result.Error != nil {
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}

	// Verify webhook secret if configured
	secret := db.GetSetting("webhook_secret_" + fmt.Sprintf("%d", app.ID))
	if secret != "" {
		sig := r.Header.Get("X-Hub-Signature-256")
		if !verifyWebhookSignature(body, secret, sig) {
			writeError(w, "invalid signature", http.StatusUnauthorized)
			return
		}
	}

	// Only deploy if push is to the app's configured branch
	pushedBranch := strings.TrimPrefix(payload.Ref, "refs/heads/")
	appBranch := app.Branch
	if appBranch == "" {
		appBranch = "main"
	}
	if pushedBranch != appBranch {
		writeJSON(w, map[string]string{"status": "skipped", "reason": "branch mismatch"})
		return
	}

	// Create deployment record and trigger
	now := time.Now()
	dep := db.Deployment{
		AppID:     app.ID,
		CommitSHA: payload.HeadCommit.ID,
		Status:    "queued",
		StartedAt: now,
	}
	db.DB.Create(&dep)

	go services.RunDeploy(&app, dep.ID, payload.HeadCommit.ID, "")

	writeJSON(w, map[string]interface{}{
		"status":        "triggered",
		"deployment_id": dep.ID,
		"app":           app.Name,
		"commit":        payload.HeadCommit.ID,
	})
}

func verifyWebhookSignature(body []byte, secret, sig string) bool {
	if !strings.HasPrefix(sig, "sha256=") {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}
