package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func StaticHandler(staticDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		if strings.HasPrefix(path, "/api/") {
			http.NotFound(w, r)
			return
		}

		filePath := filepath.Join(staticDir, filepath.Clean(path))
		info, err := os.Stat(filePath)
		if err != nil || info.IsDir() {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}
		http.ServeFile(w, r, filePath)
	}
}
