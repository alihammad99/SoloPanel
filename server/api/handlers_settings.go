package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/panel/backend/auth"
	"github.com/panel/backend/db"
)

var ghClient = &http.Client{Timeout: 15 * time.Second}

func handleGetSettings(w http.ResponseWriter, r *http.Request) {
	keys := []string{
		"s3_endpoint", "s3_bucket", "s3_region",
		"s3_access_key", "s3_secret_key", "restic_password",
		"registry_url",
	}
	result := map[string]string{}
	for _, k := range keys {
		result[k] = db.GetSetting(k)
	}
	writeJSON(w, result)
}

func handleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var input map[string]string
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, "invalid body", http.StatusBadRequest)
		return
	}

	allowed := map[string]bool{
		"s3_endpoint":     true,
		"s3_bucket":       true,
		"s3_region":       true,
		"s3_access_key":   true,
		"s3_secret_key":   true,
		"restic_password": true,
		"registry_url":    true,
	}

	for k, v := range input {
		if allowed[k] {
			db.SetSetting(k, v)
		}
	}
	writeJSON(w, map[string]string{"message": "updated"})
}

func handleGithubRepos(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r)
	token := loadGHToken(claims.Username)
	if token == "" {
		writeError(w, "no github token stored — please log out and log in again", http.StatusUnauthorized)
		return
	}

	page := r.URL.Query().Get("page")
	if page == "" {
		page = "1"
	}
	url := "https://api.github.com/user/repos?per_page=100&sort=updated&page=" + page

	req, _ := http.NewRequestWithContext(r.Context(), "GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := ghClient.Do(req)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var repos []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&repos)

	// Return just the fields the frontend needs
	type repoSummary struct {
		FullName      string `json:"full_name"`
		SSHURL        string `json:"ssh_url"`
		HTTPURL       string `json:"clone_url"`
		Private       bool   `json:"private"`
		Description   string `json:"description"`
		Language      string `json:"language"`
		Stars         int    `json:"stargazers_count"`
		Fork          bool   `json:"fork"`
		DefaultBranch string `json:"default_branch"`
	}
	result := make([]repoSummary, 0, len(repos))
	for _, r := range repos {
		s := repoSummary{}
		if v, ok := r["full_name"].(string); ok {
			s.FullName = v
		}
		if v, ok := r["ssh_url"].(string); ok {
			s.SSHURL = v
		}
		if v, ok := r["clone_url"].(string); ok {
			s.HTTPURL = v
		}
		if v, ok := r["private"].(bool); ok {
			s.Private = v
		}
		if v, ok := r["description"].(string); ok {
			s.Description = v
		}
		if v, ok := r["language"].(string); ok {
			s.Language = v
		}
		if v, ok := r["fork"].(bool); ok {
			s.Fork = v
		}
		if v, ok := r["stargazers_count"].(float64); ok {
			s.Stars = int(v)
		}
		if v, ok := r["default_branch"].(string); ok {
			s.DefaultBranch = v
		}
		result = append(result, s)
	}
	writeJSON(w, result)
}

func handleGithubBranches(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r)
	token := loadGHToken(claims.Username)
	if token == "" {
		writeError(w, "no github token", http.StatusUnauthorized)
		return
	}

	owner := r.URL.Query().Get("owner")
	repo := r.URL.Query().Get("repo")
	if owner == "" || repo == "" {
		writeError(w, "owner and repo required", http.StatusBadRequest)
		return
	}

	ghURL := "https://api.github.com/repos/" + owner + "/" + repo + "/branches?per_page=100"
	req, _ := http.NewRequestWithContext(r.Context(), "GET", ghURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := ghClient.Do(req)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var branches []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&branches)

	names := make([]string, 0, len(branches))
	for _, b := range branches {
		if name, ok := b["name"].(string); ok {
			names = append(names, name)
		}
	}
	writeJSON(w, names)
}
