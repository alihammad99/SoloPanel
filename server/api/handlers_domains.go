package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/panel/backend/db"
	"github.com/panel/backend/services"
)

func handleListDomains(w http.ResponseWriter, r *http.Request) {
	var domains []db.Domain
	db.DB.Find(&domains)
	writeJSON(w, domains)
}

func handleAddDomain(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Domain     string `json:"domain"`
		TargetPort int    `json:"target_port"`
		AppID      *uint  `json:"app_id"`
		StackID    *uint  `json:"stack_id"`
		SSLMode    string `json:"ssl_mode"`    // auto|custom|redirect
		CustomCert string `json:"custom_cert"` // PEM
		CustomKey  string `json:"custom_key"`  // PEM
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Domain == "" {
		writeError(w, "domain required", http.StatusBadRequest)
		return
	}

	if input.SSLMode == "" {
		input.SSLMode = "auto"
	}

	targetAddr := ""
	if input.TargetPort > 0 {
		targetAddr = "localhost:" + itoa(input.TargetPort)
	}

	cfg := services.DomainConfig{
		Domain:     input.Domain,
		TargetAddr: targetAddr,
		SSLMode:    input.SSLMode,
		CustomCert: input.CustomCert,
		CustomKey:  input.CustomKey,
	}
	if err := services.AddDomainAdvanced(cfg); err != nil {
		writeError(w, "caddy error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	sslStatus := "pending"
	if input.SSLMode == "custom" {
		sslStatus = "active"
	} else if input.SSLMode == "redirect" {
		sslStatus = "redirect"
	}

	domain := db.Domain{
		Domain:     input.Domain,
		AppID:      input.AppID,
		StackID:    input.StackID,
		TargetPort: input.TargetPort,
		SSLStatus:  sslStatus,
	}
	db.DB.Create(&domain)
	writeJSON(w, domain)
}

func handleRemoveDomain(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var domain db.Domain
	if err := db.DB.First(&domain, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	services.RemoveDomain(domain.Domain)
	db.DB.Delete(&domain)
	writeJSON(w, map[string]string{"message": "removed"})
}

func handleGetCaddyConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := services.GetCaddyConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, cfg)
}

func handleVerifyDomain(w http.ResponseWriter, r *http.Request) {
	domain := r.URL.Query().Get("domain")
	if domain == "" {
		writeError(w, "domain required", http.StatusBadRequest)
		return
	}

	result := services.VerifyDomainDNS(domain)
	writeJSON(w, result)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	if neg {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}
