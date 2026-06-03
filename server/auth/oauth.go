package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/panel/backend/config"
	"github.com/panel/backend/db"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
)

var oauthConf *oauth2.Config

// stateStore holds valid OAuth states server-side (avoids cookie issues through proxies)
var stateStore sync.Map

type Claims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
	jwt.RegisteredClaims
}

type GithubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

func Init() {
	oauthConf = &oauth2.Config{
		ClientID:     config.C.Auth.GithubClientID,
		ClientSecret: config.C.Auth.GithubClientSecret,
		Scopes:       []string{"read:user", "user:email", "repo", "read:org"},
		Endpoint:     github.Endpoint,
		RedirectURL:  config.C.Server.BaseURL + "/api/auth/callback",
	}
}

func GetOAuthConf() *oauth2.Config {
	return oauthConf
}

func GenerateState() string {
	b := make([]byte, 16)
	rand.Read(b)
	state := base64.URLEncoding.EncodeToString(b)
	stateStore.Store(state, time.Now())
	// Clean up states older than 10 minutes
	go func() {
		time.Sleep(10 * time.Minute)
		stateStore.Delete(state)
	}()
	return state
}

func ValidateAndConsumeState(state string) bool {
	_, ok := stateStore.LoadAndDelete(state)
	return ok
}

func FetchGithubUser(ctx context.Context, token *oauth2.Token) (*GithubUser, error) {
	client := oauthConf.Client(ctx, token)
	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var user GithubUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

func IsAllowed(username string) bool {
	for _, u := range config.C.Auth.AllowedUsers {
		if u == username {
			return true
		}
	}
	return false
}

func IssueJWT(user db.User) (string, error) {
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Avatar:   user.AvatarURL,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.C.Auth.JWTSecret))
}

func ValidateJWT(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(config.C.Auth.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, fmt.Errorf("invalid token")
}

func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("panel_token")
		if err != nil {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		claims, err := ValidateJWT(cookie.Value)
		if err != nil {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ClaimsKey{}, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

type ClaimsKey struct{}

func GetClaims(r *http.Request) *Claims {
	if c, ok := r.Context().Value(ClaimsKey{}).(*Claims); ok {
		return c
	}
	return nil
}
