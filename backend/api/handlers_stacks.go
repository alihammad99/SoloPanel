package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/panel/backend/auth"
	"github.com/panel/backend/config"
	"github.com/panel/backend/db"
	"github.com/panel/backend/services"
)

func handleListStacks(w http.ResponseWriter, r *http.Request) {
	var stacks []db.DockerStack
	db.DB.Find(&stacks)
	writeJSON(w, stacks)
}

func handleCreateStack(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name        string `json:"name"`
		TemplateID  string `json:"template_id"`
		ComposeYAML string `json:"compose_yaml"`
		EnvVars     string `json:"env_vars"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, "invalid body", http.StatusBadRequest)
		return
	}

	claims := auth.GetClaims(r)

	composeYAML := input.ComposeYAML
	if composeYAML == "" && input.TemplateID != "" {
		tmpl, err := services.GetTemplate(input.TemplateID)
		if err != nil {
			writeError(w, "template not found: "+err.Error(), http.StatusNotFound)
			return
		}
		composeYAML = tmpl.ComposeYAML
	}

	envEnc := ""
	if input.EnvVars != "" {
		var err error
		envEnc, err = services.Encrypt(input.EnvVars, config.C.Encryption.Key)
		if err != nil {
			writeError(w, "encrypt failed", http.StatusInternalServerError)
			return
		}
	}

	stack := db.DockerStack{
		Name:        input.Name,
		TemplateID:  input.TemplateID,
		ComposeYAML: composeYAML,
		EnvVarsEnc:  envEnc,
		Status:      "stopped",
		UserID:      claims.UserID,
	}

	if err := db.DB.Create(&stack).Error; err != nil {
		writeError(w, "db create: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, stack)
}

func handleGetStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var stack db.DockerStack
	if err := db.DB.First(&stack, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, stack)
}

func handleDeleteStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var stack db.DockerStack
	if err := db.DB.First(&stack, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}
	db.DB.Delete(&stack)
	writeJSON(w, map[string]string{"message": "deleted"})
}

func handleStartStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var stack db.DockerStack
	if err := db.DB.First(&stack, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	stackDir := filepath.Join(config.C.Storage.AppsDir, "stacks", stack.Name)
	if err := os.MkdirAll(stackDir, 0750); err != nil {
		writeError(w, "mkdir failed", http.StatusInternalServerError)
		return
	}

	composePath := filepath.Join(stackDir, "docker-compose.yml")
	if err := os.WriteFile(composePath, []byte(stack.ComposeYAML), 0640); err != nil {
		writeError(w, "write compose failed", http.StatusInternalServerError)
		return
	}

	envMap := map[string]string{}
	if stack.EnvVarsEnc != "" {
		plain, err := services.Decrypt(stack.EnvVarsEnc, config.C.Encryption.Key)
		if err == nil {
			for _, line := range splitLines(plain) {
				parts := splitN(line, "=", 2)
				if len(parts) == 2 {
					envMap[trim(parts[0])] = trim(parts[1])
				}
			}
		}
	}

	ls := services.NewLogStreamer()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, _ := w.(http.Flusher)

	go func() {
		err := services.ComposeUp(stackDir, ls, envMap)
		if err != nil {
			ls.Write([]byte("[error] " + err.Error() + "\n"))
			db.DB.Model(&stack).Update("status", "error")
		} else {
			db.DB.Model(&stack).Update("status", "running")
		}
		ls.Done()
	}()

	ch := ls.Subscribe()
	for line := range ch {
		w.Write([]byte("data: " + line + "\n\n"))
		if flusher != nil {
			flusher.Flush()
		}
	}
}

func handleStopStack(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var stack db.DockerStack
	if err := db.DB.First(&stack, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	stackDir := filepath.Join(config.C.Storage.AppsDir, "stacks", stack.Name)
	ls := services.NewLogStreamer()

	go func() {
		services.ComposeDown(stackDir, ls)
		db.DB.Model(&stack).Update("status", "stopped")
	}()

	writeJSON(w, map[string]string{"message": "stopping"})
}

func handleGetMarketplace(w http.ResponseWriter, r *http.Request) {
	registryURL := r.URL.Query().Get("registry")
	if registryURL == "" {
		registryURL = db.GetSetting("registry_url")
	}

	templates, err := services.FetchTemplates(registryURL)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Optional server-side filtering
	search := strings.ToLower(r.URL.Query().Get("search"))
	category := strings.ToLower(r.URL.Query().Get("category"))
	if search != "" || category != "" {
		filtered := templates[:0]
		for _, t := range templates {
			if category != "" && !strings.EqualFold(t.Category, category) {
				continue
			}
			if search != "" {
				haystack := strings.ToLower(t.Name + " " + t.Description + " " + strings.Join(t.Tags, " "))
				if !strings.Contains(haystack, search) {
					continue
				}
			}
			filtered = append(filtered, t)
		}
		templates = filtered
	}

	writeJSON(w, templates)
}

func handleRefreshMarketplace(w http.ResponseWriter, r *http.Request) {
	services.InvalidateTemplateCache()
	writeJSON(w, map[string]string{"message": "cache cleared"})
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i, c := range s {
		if c == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func splitN(s, sep string, n int) []string {
	var result []string
	for i := 0; i <= len(s)-len(sep); i++ {
		if s[i:i+len(sep)] == sep {
			result = append(result, s[:i])
			s = s[i+len(sep):]
			if len(result) == n-1 {
				break
			}
			i = -1
		}
	}
	result = append(result, s)
	return result
}

func trim(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\r' || s[start] == '\n') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\r' || s[end-1] == '\n') {
		end--
	}
	return s[start:end]
}
