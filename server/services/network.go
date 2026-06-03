package services

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/panel/backend/db"
)

var (
	cachedIP   string
	cachedIPMu sync.RWMutex
)

// isPrivateIP returns true if the IP is private/link-local.
func isPrivateIP(ip string) bool {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return true
	}
	if parsed.IsPrivate() || parsed.IsLoopback() {
		return true
	}
	// Reject link-local (169.254.0.0/16)
	if parsed.To4() != nil && parsed.To4()[0] == 169 && parsed.To4()[1] == 254 {
		return true
	}
	// Reject 169.224.0.0/16 (common VPN/NAT range, not publicly routable)
	if parsed.To4() != nil && parsed.To4()[0] == 169 && parsed.To4()[1] == 224 {
		return true
	}
	return false
}

// GetPublicIP returns the server's public IP, cached after the first successful lookup.
// Checks for manual override in settings first, then auto-detects.
func GetPublicIP() string {
	cachedIPMu.RLock()
	if cachedIP != "" {
		ip := cachedIP
		cachedIPMu.RUnlock()
		return ip
	}
	cachedIPMu.RUnlock()

	// Check for manual override in settings
	if manualIP := db.GetSetting("public_ip_override"); manualIP != "" {
		if net.ParseIP(manualIP) != nil && !isPrivateIP(manualIP) {
			cachedIPMu.Lock()
			cachedIP = manualIP
			cachedIPMu.Unlock()
			return manualIP
		}
	}

	providers := []string{
		"https://api.ipify.org",
		"https://ifconfig.me/ip",
		"https://icanhazip.com",
		"https://checkip.amazonaws.com",
		"https://ipinfo.io/ip",
	}
	client := &http.Client{Timeout: 3 * time.Second}
	var resolved string
	for _, svc := range providers {
		resp, err := client.Get(svc)
		if err != nil {
			continue
		}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 64))
		resp.Body.Close()
		ip := strings.TrimSpace(string(body))
		if net.ParseIP(ip) != nil && !isPrivateIP(ip) {
			resolved = ip
			break
		}
	}
	// Fallback to outbound IP only if it's not private
	if resolved == "" {
		if outbound := outboundIP(); outbound != "" && !isPrivateIP(outbound) {
			resolved = outbound
		}
	}

	cachedIPMu.Lock()
	cachedIP = resolved
	cachedIPMu.Unlock()
	return resolved
}

func outboundIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return ""
	}
	defer conn.Close()
	return conn.LocalAddr().(*net.UDPAddr).IP.String()
}

// PreviewDomain returns the sslip.io hostname for a given preview slug and public IP.
// Example: "myapp-a1b2c3d4.1-2-3-4.sslip.io"
func PreviewDomain(slug, ip string) string {
	if slug == "" || ip == "" {
		return ""
	}
	return fmt.Sprintf("%s.%s.sslip.io", slug, strings.ReplaceAll(ip, ".", "-"))
}
