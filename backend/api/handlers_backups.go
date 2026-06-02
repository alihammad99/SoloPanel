package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/panel/backend/config"
	"github.com/panel/backend/db"
	"github.com/panel/backend/services"
)

func handleListBackups(w http.ResponseWriter, r *http.Request) {
	var backups []db.Backup
	db.DB.Order("created_at desc").Find(&backups)
	writeJSON(w, backups)
}

func handleCreateBackup(w http.ResponseWriter, r *http.Request) {
	var input struct {
		AppID   *uint  `json:"app_id"`
		StackID *uint  `json:"stack_id"`
		Tags    string `json:"tags"`
	}
	json.NewDecoder(r.Body).Decode(&input)

	var paths []string
	var tags []string

	if input.AppID != nil {
		var app db.App
		if err := db.DB.First(&app, *input.AppID).Error; err != nil {
			writeError(w, "app not found", http.StatusNotFound)
			return
		}
		paths = append(paths, filepath.Join(config.C.Storage.AppsDir, app.Name))
		tags = append(tags, "app="+app.Name)
	} else if input.StackID != nil {
		var stack db.DockerStack
		if err := db.DB.First(&stack, *input.StackID).Error; err != nil {
			writeError(w, "stack not found", http.StatusNotFound)
			return
		}
		paths = append(paths, filepath.Join(config.C.Storage.AppsDir, "stacks", stack.Name))
		tags = append(tags, "stack="+stack.Name)
	} else {
		paths = append(paths, config.C.Storage.AppsDir)
		paths = append(paths, config.C.DB.Path)
		tags = append(tags, "full-backup")
	}

	if input.Tags != "" {
		tags = append(tags, input.Tags)
	}

	backup := db.Backup{
		AppID:   input.AppID,
		StackID: input.StackID,
		Tags:    joinStrings(tags, ","),
		Status:  "running",
	}
	db.DB.Create(&backup)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, _ := w.(http.Flusher)

	ls := services.NewLogStreamer()
	go func() {
		snapshotID, err := services.ResticBackup(paths, tags, ls)
		if err != nil {
			ls.Write([]byte("[error] " + err.Error() + "\n"))
			db.DB.Model(&backup).Updates(map[string]interface{}{"status": "failed"})
		} else {
			db.DB.Model(&backup).Updates(map[string]interface{}{
				"snapshot_id": snapshotID,
				"status":      "success",
			})
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

func handleRestoreBackup(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var backup db.Backup
	if err := db.DB.First(&backup, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	restorePath := fmt.Sprintf("/tmp/restore_%s_%d", backup.SnapshotID, time.Now().Unix())

	ls := services.NewLogStreamer()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, _ := w.(http.Flusher)

	go func() {
		if err := services.ResticRestore(backup.SnapshotID, restorePath, ls); err != nil {
			ls.Write([]byte("[error] " + err.Error() + "\n"))
		} else {
			ls.Write([]byte("[done] restored to " + restorePath + "\n"))
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

func handleInitRestic(w http.ResponseWriter, r *http.Request) {
	ls := services.NewLogStreamer()
	go func() {
		services.ResticInit(ls)
		ls.Done()
	}()

	w.Header().Set("Content-Type", "text/event-stream")
	flusher, _ := w.(http.Flusher)
	ch := ls.Subscribe()
	for line := range ch {
		w.Write([]byte("data: " + line + "\n\n"))
		if flusher != nil {
			flusher.Flush()
		}
	}
}

func joinStrings(ss []string, sep string) string {
	out := ""
	for i, s := range ss {
		if i > 0 {
			out += sep
		}
		out += s
	}
	return out
}
