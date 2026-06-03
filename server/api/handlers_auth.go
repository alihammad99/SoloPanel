package api

import (
	"net/http"
	"time"

	"github.com/panel/backend/auth"
	"github.com/panel/backend/config"
	"github.com/panel/backend/db"
)

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

	// Store the GitHub token server-side so repos can be fetched without exposing it to the browser
	db.SetSetting("gh_token_"+user.Username, token.AccessToken)

	jwt, err := auth.IssueJWT(user)
	if err != nil {
		http.Error(w, "jwt issue failed", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "panel_token",
		Value:    jwt,
		Path:     "/",
		MaxAge:   int((7 * 24 * time.Hour).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	http.Redirect(w, r, config.C.Server.BaseURL+"/", http.StatusTemporaryRedirect)
}

func handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "panel_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
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
	})
}
