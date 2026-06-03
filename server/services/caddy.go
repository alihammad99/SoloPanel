package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/panel/backend/config"
)

type CaddyRoute struct {
	ID     string
	Domain string
	Target string
}

func caddyAPI(method, path string, body interface{}) ([]byte, error) {
	base := config.C.Caddy.AdminAPI
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, base+path, bodyReader)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("caddy API error %d: %s", resp.StatusCode, string(data))
	}
	return data, nil
}

type DomainConfig struct {
	Domain      string // e.g. "app.example.com" or "*.example.com"
	TargetAddr  string // e.g. "localhost:3000"
	SSLMode     string // "auto" | "custom" | "wildcard" | "redirect"
	CustomCert  string // PEM cert (for custom mode)
	CustomKey   string // PEM key (for custom mode)
	WildcardDNS string // DNS provider for wildcard (e.g. "cloudflare")
	DNSToken    string // DNS provider API token
}

func AddDomain(domain, targetAddr string, useHTTPS bool) error {
	return AddDomainAdvanced(DomainConfig{
		Domain:     domain,
		TargetAddr: targetAddr,
		SSLMode:    "auto",
	})
}

func AddDomainAdvanced(cfg DomainConfig) error {
	routeID := "panel_" + sanitizeID(cfg.Domain)

	matcher := map[string]interface{}{"host": []string{cfg.Domain}}

	var handles []interface{}

	switch cfg.SSLMode {
	case "redirect":
		handles = []interface{}{
			map[string]interface{}{
				"handler": "static_response",
				"headers": map[string]interface{}{
					"Location": []string{"https://{http.request.host}{http.request.uri}"},
				},
				"status_code": "301",
			},
		}
	default:
		handles = []interface{}{
			map[string]interface{}{
				"handler": "reverse_proxy",
				"upstreams": []map[string]interface{}{
					{"dial": cfg.TargetAddr},
				},
				"health_checks": map[string]interface{}{
					"passive": map[string]interface{}{
						"fail_duration": "30s",
					},
				},
			},
		}
	}

	route := map[string]interface{}{
		"@id":    routeID,
		"match":  []interface{}{matcher},
		"handle": handles,
	}

	if _, err := caddyAPI("POST", "/config/apps/http/servers/srv0/routes/...", route); err != nil {
		return err
	}

	// For custom certs, load them into Caddy's TLS store
	if cfg.SSLMode == "custom" && cfg.CustomCert != "" && cfg.CustomKey != "" {
		tlsCfg := map[string]interface{}{
			"certificates": map[string]interface{}{
				"load_pem": []map[string]interface{}{
					{
						"certificate": cfg.CustomCert,
						"key":         cfg.CustomKey,
						"tags":        []string{"panel_custom_" + sanitizeID(cfg.Domain)},
					},
				},
			},
		}
		if _, err := caddyAPI("POST", "/config/apps/tls", tlsCfg); err != nil {
			return fmt.Errorf("custom cert load failed: %w", err)
		}
	}

	return nil
}

func RemoveDomain(domain string) error {
	routeID := "panel_" + sanitizeID(domain)
	_, err := caddyAPI("DELETE", "/id/"+routeID, nil)
	return err
}

func GetCaddyConfig() (map[string]interface{}, error) {
	data, err := caddyAPI("GET", "/config/", nil)
	if err != nil {
		return nil, err
	}
	var cfg map[string]interface{}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func InitCaddyBase() error {
	cfg := map[string]interface{}{
		"admin": map[string]interface{}{
			"listen": "localhost:2019",
		},
		"apps": map[string]interface{}{
			"http": map[string]interface{}{
				"servers": map[string]interface{}{
					"srv0": map[string]interface{}{
						"listen": []string{":80", ":443"},
						"routes": []interface{}{},
					},
				},
			},
			"tls": map[string]interface{}{},
		},
	}
	_, err := caddyAPI("POST", "/load", cfg)
	return err
}

func sanitizeID(s string) string {
	out := make([]byte, 0, len(s))
	for _, c := range []byte(s) {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') {
			out = append(out, c)
		} else {
			out = append(out, '_')
		}
	}
	return string(out)
}
