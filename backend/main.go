package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/panel/backend/api"
	"github.com/panel/backend/auth"
	"github.com/panel/backend/config"
	"github.com/panel/backend/db"
	"github.com/panel/backend/services"
)

func main() {
	configPath := flag.String("config", "/etc/panel/config.yaml", "path to config file")
	flag.Parse()

	if err := config.Load(*configPath); err != nil {
		log.Printf("config load error: %v, using defaults", err)
		config.C = config.Default()
	}

	if config.C.Auth.JWTSecret == "" {
		config.C.Auth.JWTSecret = os.Getenv("JWT_SECRET")
	}
	if config.C.Auth.GithubClientID == "" {
		config.C.Auth.GithubClientID = os.Getenv("GITHUB_CLIENT_ID")
	}
	if config.C.Auth.GithubClientSecret == "" {
		config.C.Auth.GithubClientSecret = os.Getenv("GITHUB_CLIENT_SECRET")
	}
	if config.C.Encryption.Key == "" {
		config.C.Encryption.Key = os.Getenv("ENCRYPTION_KEY")
	}

	for _, dir := range []string{
		config.C.Storage.AppsDir,
		config.C.Storage.BackupsDir,
		config.C.Storage.KeysDir,
	} {
		if err := os.MkdirAll(dir, 0750); err != nil {
			log.Fatalf("mkdir %s: %v", dir, err)
		}
	}

	if err := db.Init(config.C.DB.Path); err != nil {
		log.Fatalf("db init: %v", err)
	}

	auth.Init()

	if err := services.InitDocker(); err != nil {
		log.Printf("docker init warning: %v (docker features disabled)", err)
	}

	mux := http.NewServeMux()
	router := api.NewRouter()
	mux.Handle("/api/", router)

	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		exe, _ := os.Executable()
		staticDir = filepath.Join(filepath.Dir(exe), "static")
	}
	if _, err := os.Stat(staticDir); err == nil {
		mux.HandleFunc("/", api.StaticHandler(staticDir))
		log.Printf("serving frontend from %s", staticDir)
	} else {
		log.Printf("no static dir found at %s, frontend not served", staticDir)
	}

	addr := fmt.Sprintf("%s:%d", config.C.Server.Host, config.C.Server.Port)
	log.Printf("panel listening on http://%s", addr)

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server: %v", err)
	}
}
