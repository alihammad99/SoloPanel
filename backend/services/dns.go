package services

import (
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

type DNSVerifyResult struct {
	Domain    string   `json:"domain"`
	ServerIP  string   `json:"server_ip"`
	ResolvedA []string `json:"resolved_a"`
	Verified  bool     `json:"verified"`
	Message   string   `json:"message"`
}

func VerifyDomainDNS(domain string) DNSVerifyResult {
	result := DNSVerifyResult{Domain: domain}

	// Strip wildcard prefix for DNS lookup
	lookupDomain := domain
	if strings.HasPrefix(lookupDomain, "*.") {
		lookupDomain = strings.TrimPrefix(lookupDomain, "*.")
	}

	// Get this server's public IP
	serverIP := getPublicIP()
	result.ServerIP = serverIP

	// Resolve domain A records
	addrs, err := net.LookupHost(lookupDomain)
	if err != nil {
		result.Message = "DNS lookup failed: " + err.Error()
		return result
	}

	result.ResolvedA = addrs

	if serverIP == "" {
		// Can't verify without knowing our IP — report resolved IPs but no verdict
		result.Message = "Resolved to: " + strings.Join(addrs, ", ") + " (could not detect server IP to verify)"
		result.Verified = len(addrs) > 0
		return result
	}

	for _, addr := range addrs {
		if addr == serverIP {
			result.Verified = true
			result.Message = "✓ " + domain + " correctly points to this server (" + serverIP + ")"
			return result
		}
	}

	result.Verified = false
	result.Message = "✗ " + domain + " resolves to " + strings.Join(addrs, ", ") + " but this server is " + serverIP + ". Update your DNS A record."
	return result
}

func getPublicIP() string {
	client := &http.Client{Timeout: 4 * time.Second}
	for _, url := range []string{
		"https://api.ipify.org",
		"https://checkip.amazonaws.com",
		"https://icanhazip.com",
	} {
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			continue
		}
		ip := strings.TrimSpace(string(body))
		if net.ParseIP(ip) != nil {
			return ip
		}
	}
	return ""
}
