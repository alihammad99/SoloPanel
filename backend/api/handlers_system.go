package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
)

var PanelVersion = "dev"

func handleVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{
		"version": PanelVersion,
		"go":      runtime.Version(),
		"os":      runtime.GOOS + "/" + runtime.GOARCH,
	})
}

func handleSelfUpdate(w http.ResponseWriter, r *http.Request) {
	var input struct {
		BinaryURL string `json:"binary_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.BinaryURL == "" {
		writeError(w, "binary_url required", http.StatusBadRequest)
		return
	}

	binaryPath, err := os.Executable()
	if err != nil {
		writeError(w, "cannot find executable: "+err.Error(), http.StatusInternalServerError)
		return
	}

	resp, err := http.Get(input.BinaryURL)
	if err != nil {
		writeError(w, "download failed: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		writeError(w, fmt.Sprintf("download returned %d", resp.StatusCode), http.StatusBadGateway)
		return
	}

	tmpPath := binaryPath + ".new"
	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		writeError(w, "write failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		os.Remove(tmpPath)
		writeError(w, "copy failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	f.Close()

	backupPath := binaryPath + ".bak"
	os.Rename(binaryPath, backupPath)
	if err := os.Rename(tmpPath, binaryPath); err != nil {
		os.Rename(backupPath, binaryPath)
		writeError(w, "replace failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"status": "ok", "message": "update applied, restarting..."})

	go func() {
		exec.Command("systemctl", "restart", "panel").Run()
	}()
}
