package api

import (
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/panel/backend/auth"
	"github.com/panel/backend/config"
	"github.com/panel/backend/db"
	"github.com/panel/backend/services"
)

func detectOutboundIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return ""
	}
	defer conn.Close()
	return conn.LocalAddr().(*net.UDPAddr).IP.String()
}

var (
	cachedPublicIP   string
	cachedPublicIPMu sync.RWMutex
)

func detectPublicIP() string {
	cachedPublicIPMu.RLock()
	if cachedPublicIP != "" {
		ip := cachedPublicIP
		cachedPublicIPMu.RUnlock()
		return ip
	}
	cachedPublicIPMu.RUnlock()

	ipProviders := []string{
		"https://api.ipify.org",
		"https://ifconfig.me/ip",
		"https://icanhazip.com",
	}
	client := &http.Client{Timeout: 3 * time.Second}
	var resolved string
	for _, svc := range ipProviders {
		resp, err := client.Get(svc)
		if err != nil {
			continue
		}
		body, err := io.ReadAll(io.LimitReader(resp.Body, 64))
		resp.Body.Close()
		if err != nil {
			continue
		}
		ip := strings.TrimSpace(string(body))
		if net.ParseIP(ip) != nil {
			resolved = ip
			break
		}
	}
	if resolved == "" {
		resolved = detectOutboundIP()
	}
	cachedPublicIPMu.Lock()
	cachedPublicIP = resolved
	cachedPublicIPMu.Unlock()
	return resolved
}

// storeGHToken encrypts (when a key is configured) and persists the GitHub OAuth
// token for the given username. Use loadGHToken to retrieve it.
func storeGHToken(username, token string) {
	val := token
	if config.C.Encryption.Key != "" {
		if enc, err := services.Encrypt(token, config.C.Encryption.Key); err == nil {
			val = enc
		}
	}
	db.SetSetting("gh_token_"+username, val)
}

// loadGHToken retrieves and decrypts the stored GitHub OAuth token. Falls back
// to treating the stored value as plaintext for backward compatibility.
func loadGHToken(username string) string {
	val := db.GetSetting("gh_token_" + username)
	if val == "" {
		return ""
	}
	if config.C.Encryption.Key != "" {
		if dec, err := services.Decrypt(val, config.C.Encryption.Key); err == nil {
			return dec
		}
	}
	return val
}

func handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	state := auth.GenerateState()
	authURL := auth.GetOAuthConf().AuthCodeURL(state)
	// Force GitHub to show the grant screen so scopes are always re-issued
	authURL += "&prompt=consent"
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func handleAuthCallback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	if !auth.ValidateAndConsumeState(state) {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	token, err := auth.GetOAuthConf().Exchange(r.Context(), code)
	if err != nil {
		http.Error(w, "token exchange failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	ghUser, err := auth.FetchGithubUser(r.Context(), token)
	if err != nil {
		http.Error(w, "github user fetch failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !auth.IsAllowed(ghUser.Login) {
		http.Error(w, "access denied: user not in allowlist", http.StatusForbidden)
		return
	}

	var user db.User
	result := db.DB.Where("github_id = ?", ghUser.ID).First(&user)
	if result.Error != nil {
		user = db.User{
			GithubID:  ghUser.ID,
			Username:  ghUser.Login,
			Email:     ghUser.Email,
			AvatarURL: ghUser.AvatarURL,
			Allowed:   true,
		}
		db.DB.Create(&user)
	} else {
		db.DB.Model(&user).Updates(map[string]interface{}{
			"avatar_url": ghUser.AvatarURL,
			"email":      ghUser.Email,
		})
	}

	// Store the GitHub token server-side (encrypted) so repos can be fetched without exposing it to the browser
	storeGHToken(user.Username, token.AccessToken)

	jwt, err := auth.IssueJWT(user)
	if err != nil {
		http.Error(w, "jwt issue failed", http.StatusInternalServerError)
		return
	}

	isSecure := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" ||
		strings.HasPrefix(config.C.Server.BaseURL, "https://")
	http.SetCookie(w, &http.Cookie{
		Name:     "panel_token",
		Value:    jwt,
		Path:     "/",
		MaxAge:   int((7 * 24 * time.Hour).Seconds()),
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
	})

	http.Redirect(w, r, config.C.Server.BaseURL+"/", http.StatusTemporaryRedirect)
}

func handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	isSecure := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" ||
		strings.HasPrefix(config.C.Server.BaseURL, "https://")
	http.SetCookie(w, &http.Cookie{
		Name:     "panel_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   isSecure,
	})
	writeJSON(w, map[string]string{"message": "logged out"})
}

func handleAuthMe(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r)
	hasToken := db.GetSetting("gh_token_"+claims.Username) != ""
	writeJSON(w, map[string]interface{}{
		"user_id":   claims.UserID,
		"username":  claims.Username,
		"avatar":    claims.Avatar,
		"has_token": hasToken,
		"base_url":  config.C.Server.BaseURL,
		"server_host": func() string {
			if config.C.Server.BaseURL != "" {
				return config.C.Server.BaseURL
			}
			host := r.Host
			if host == "" {
				return ""
			}
			scheme := "http"
			if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
				scheme = "https"
			}
			return scheme + "://" + host
		}(),
	})
}
