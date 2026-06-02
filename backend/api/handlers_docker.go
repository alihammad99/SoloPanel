package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/panel/backend/services"
)

func handleListContainers(w http.ResponseWriter, r *http.Request) {
	containers, err := services.ListContainers(r.Context())
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, containers)
}

func handleStartContainer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := services.StartContainer(r.Context(), id); err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"message": "started"})
}

func handleStopContainer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := services.StopContainer(r.Context(), id); err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"message": "stopped"})
}

func handleRemoveContainer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := services.RemoveContainer(r.Context(), id, false); err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"message": "removed"})
}

func handleContainerLogs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "100"
	}
	logs, err := services.ContainerLogs(r.Context(), id, tail)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"logs": logs})
}

func handleListImages(w http.ResponseWriter, r *http.Request) {
	images, err := services.ListImages(r.Context())
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, images)
}

func handlePullImage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Image string `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Image == "" {
		writeError(w, "image required", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, _ := w.(http.Flusher)

	ls := services.NewLogStreamer()
	go func() {
		services.PullImage(r.Context(), body.Image, ls)
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

func handleRemoveImage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := services.RemoveImage(r.Context(), id, false); err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"message": "removed"})
}

func handleListVolumes(w http.ResponseWriter, r *http.Request) {
	volumes, err := services.ListVolumes(r.Context())
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, volumes)
}

func handleListNetworks(w http.ResponseWriter, r *http.Request) {
	networks, err := services.ListNetworks(r.Context())
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, networks)
}

func handleDockerVersion(w http.ResponseWriter, r *http.Request) {
	ver, err := services.DockerVersion(r.Context())
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"version": ver})
}
