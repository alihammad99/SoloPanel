package api

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/panel/backend/db"
)

func handleAppPreview(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	var app db.App
	if err := db.DB.Where("preview_slug = ?", slug).First(&app).Error; err != nil {
		http.Error(w, "app not found", http.StatusNotFound)
		return
	}
	if app.Port == 0 {
		http.Error(w, "app has no port configured", http.StatusBadGateway)
		return
	}

	target, _ := url.Parse(fmt.Sprintf("http://localhost:%d", app.Port))
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Strip /preview/{slug} prefix so the app sees the correct path
	r.URL.Path = "/" + strings.TrimPrefix(chi.URLParam(r, "*"), "/")
	if r.URL.Path == "" {
		r.URL.Path = "/"
	}
	r.URL.RawPath = r.URL.Path
	r.Host = target.Host

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, "app unreachable: "+err.Error(), http.StatusBadGateway)
	}

	proxy.ServeHTTP(w, r)
}
