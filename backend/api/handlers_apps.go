package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/panel/backend/auth"
	"github.com/panel/backend/config"
	"github.com/panel/backend/db"
	"github.com/panel/backend/services"
)

func handleListApps(w http.ResponseWriter, r *http.Request) {
	var apps []db.App
	db.DB.Find(&apps)
	writeJSON(w, apps)
}

func parseRepoOwnerRepo(repoURL string) (owner, repo string) {
	// git@github.com:owner/repo.git or https://github.com/owner/repo.git
	repoURL = strings.TrimSuffix(repoURL, ".git")
	if strings.Contains(repoURL, ":") {
		// SSH format
		parts := strings.Split(repoURL, ":")
		path := parts[len(parts)-1]
		segs := strings.Split(path, "/")
		if len(segs) >= 2 {
			return segs[len(segs)-2], segs[len(segs)-1]
		}
	} else {
		// HTTPS format
		segs := strings.Split(repoURL, "/")
		if len(segs) >= 2 {
			return segs[len(segs)-2], segs[len(segs)-1]
		}
	}
	return "", ""
}

func addDeployKeyToGitHub(owner, repo, publicKey, token string) error {
	if owner == "" || repo == "" || token == "" {
		return nil // skip silently
	}
	payload := map[string]interface{}{
		"title":     "Panel Deploy Key",
		"key":       publicKey,
		"read_only": true,
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "https://api.github.com/repos/"+owner+"/"+repo+"/keys", strings.NewReader(string(body)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("github API %d: %s", resp.StatusCode, string(data))
	}
	return nil
}

func handleCreateApp(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name     string `json:"name"`
		RepoURL  string `json:"repo_url"`
		Branch   string `json:"branch"`
		Port     int    `json:"port"`
		Domain   string `json:"domain"`
		EnvVars  string `json:"env_vars"`
		BuildCmd string `json:"build_cmd"`
		StartCmd string `json:"start_cmd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, "invalid body", http.StatusBadRequest)
		return
	}

	claims := auth.GetClaims(r)

	keyPair, err := services.GenerateSSHKeyPair("panel-" + input.Name)
	if err != nil {
		writeError(w, "key gen failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	envEnc := ""
	if input.EnvVars != "" {
		envEnc, err = services.Encrypt(input.EnvVars, config.C.Encryption.Key)
		if err != nil {
			writeError(w, "encrypt failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	app := db.App{
		Name:          input.Name,
		RepoURL:       input.RepoURL,
		Branch:        input.Branch,
		DeployKeyPub:  keyPair.PublicKey,
		DeployKeyPriv: keyPair.PrivateKey,
		Port:          input.Port,
		Domain:        input.Domain,
		EnvVarsEnc:    envEnc,
		BuildCmd:      input.BuildCmd,
		StartCmd:      input.StartCmd,
		Status:        "idle",
		UserID:        claims.UserID,
	}

	if err := db.DB.Create(&app).Error; err != nil {
		writeError(w, "db create failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Auto-add deploy key to GitHub if we have a token
	keyAdded := false
	owner, repoName := parseRepoOwnerRepo(input.RepoURL)
	if owner != "" && repoName != "" {
		token := db.GetSetting("gh_token_" + claims.Username)
		if token != "" {
			if err := addDeployKeyToGitHub(owner, repoName, keyPair.PublicKey, token); err != nil {
				fmt.Printf("[deploy-key-auto] failed for %s/%s: %v\n", owner, repoName, err)
			} else {
				keyAdded = true
				fmt.Printf("[deploy-key-auto] success for %s/%s\n", owner, repoName)
			}
		}
	}

	writeJSON(w, map[string]interface{}{
		"app":          app,
		"deploy_key":   keyPair.PublicKey,
		"key_added":    keyAdded,
		"key_add_hint": "If deployment fails with 'Permission denied', log out and back in to refresh your GitHub token with repo scope, then delete and re-create this app.",
	})
}

func handleGetApp(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var app db.App
	if err := db.DB.First(&app, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}
	app.DeployKeyPriv = ""
	writeJSON(w, app)
}

func handleUpdateApp(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var app db.App
	if err := db.DB.First(&app, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	var input struct {
		Branch   string `json:"branch"`
		Port     int    `json:"port"`
		Domain   string `json:"domain"`
		EnvVars  string `json:"env_vars"`
		BuildCmd string `json:"build_cmd"`
		StartCmd string `json:"start_cmd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, "invalid body", http.StatusBadRequest)
		return
	}

	updates := map[string]interface{}{}
	if input.Branch != "" {
		updates["branch"] = input.Branch
	}
	if input.Port != 0 {
		updates["port"] = input.Port
	}
	if input.Domain != "" {
		updates["domain"] = input.Domain
	}
	if input.EnvVars != "" {
		enc, err := services.Encrypt(input.EnvVars, config.C.Encryption.Key)
		if err != nil {
			writeError(w, "encrypt failed", http.StatusInternalServerError)
			return
		}
		updates["env_vars_enc"] = enc
	}
	if input.BuildCmd != "" {
		updates["build_cmd"] = input.BuildCmd
	}
	if input.StartCmd != "" {
		updates["start_cmd"] = input.StartCmd
	}

	db.DB.Model(&app).Updates(updates)
	writeJSON(w, app)
}

func handleDeleteApp(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var app db.App
	if err := db.DB.First(&app, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}
	db.DB.Delete(&app)
	writeJSON(w, map[string]string{"message": "deleted"})
}

func handleDeployApp(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var app db.App
	if err := db.DB.First(&app, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	deployment := db.Deployment{
		AppID:     app.ID,
		Status:    "queued",
		StartedAt: time.Now(),
	}
	db.DB.Create(&deployment)

	go services.RunDeploy(&app, deployment.ID, "", "")

	writeJSON(w, map[string]interface{}{
		"deployment_id": deployment.ID,
		"message":       "deployment started",
	})
}

func handleGetDeploymentLog(w http.ResponseWriter, r *http.Request) {
	deployID, _ := strconv.ParseUint(chi.URLParam(r, "deployID"), 10, 64)

	ls := services.GetStreamer(uint(deployID))
	if ls == nil {
		var dep db.Deployment
		if err := db.DB.First(&dep, deployID).Error; err != nil {
			writeError(w, "not found", http.StatusNotFound)
			return
		}
		writeJSON(w, map[string]interface{}{
			"status": dep.Status,
			"log":    dep.Log,
		})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	ch := ls.Subscribe()
	for line := range ch {
		w.Write([]byte("data: " + line + "\n\n"))
		flusher.Flush()
	}
}

func handleListDeployments(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	var deps []db.Deployment
	db.DB.Where("app_id = ?", appID).Order("created_at desc").Limit(20).Find(&deps)
	writeJSON(w, deps)
}

func handleGetEnvVars(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var app db.App
	if err := db.DB.First(&app, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	if app.EnvVarsEnc == "" {
		writeJSON(w, map[string]string{"env_vars": ""})
		return
	}

	plain, err := services.Decrypt(app.EnvVarsEnc, config.C.Encryption.Key)
	if err != nil {
		writeError(w, "decrypt failed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"env_vars": plain})
}

func handleGetDeployKey(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var app db.App
	if err := db.DB.First(&app, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]string{"public_key": app.DeployKeyPub})
}

func handleDetectStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var app db.App
	if err := db.DB.First(&app, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	appDir := filepath.Join(config.C.Storage.AppsDir, app.Name)
	stack := services.DetectTechStack(appDir)
	writeJSON(w, stack)
}

func handleAddDeployKeyToGithub(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r)
	id := chi.URLParam(r, "id")
	var app db.App
	if err := db.DB.First(&app, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	token := db.GetSetting("gh_token_" + claims.Username)
	if token == "" {
		writeError(w, "no github token — log out and back in", http.StatusBadRequest)
		return
	}

	owner, repoName := parseRepoOwnerRepo(app.RepoURL)
	if owner == "" || repoName == "" {
		writeError(w, "could not parse repo url", http.StatusBadRequest)
		return
	}

	if err := addDeployKeyToGitHub(owner, repoName, app.DeployKeyPub, token); err != nil {
		writeError(w, "github api: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"message": "deploy key added to github"})
}
