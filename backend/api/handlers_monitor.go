package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/panel/backend/services"
)

func handleMetricsOnce(w http.ResponseWriter, r *http.Request) {
	m, err := services.CollectMetrics()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, m)
}

func handleMetricsStream(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			m, err := services.CollectMetrics()
			if err != nil {
				continue
			}
			data, _ := json.Marshal(m)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}
