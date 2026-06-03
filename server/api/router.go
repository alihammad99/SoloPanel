package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/panel/backend/auth"
	"github.com/panel/backend/config"
)

func NewRouter() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	allowedOrigins := []string{config.C.Server.BaseURL}
	if config.C.Server.BaseURL != "http://localhost:5173" {
		allowedOrigins = append(allowedOrigins, "http://localhost:5173")
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Github-Token"},
		AllowCredentials: true,
	}))

	r.Route("/api", func(r chi.Router) {
		r.Post("/webhook/github", handleGithubWebhook)
		r.Get("/preview/{slug}", handleAppPreview)
		r.Get("/preview/{slug}/*", handleAppPreview)
		r.Get("/storage/share/{token}", handleServeSharedFile)
		r.Get("/storage/preview/{token}", handlePreviewSharedFile)
		r.Get("/storage/files/{bucketName}/*", handleServeFileByKey)
		r.Post("/storage/upload/{token}", handlePublicUpload)
		r.Options("/storage/upload/{token}", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusNoContent)
		})

		r.Route("/auth", func(r chi.Router) {
			r.Get("/login", handleAuthLogin)
			r.Get("/callback", handleAuthCallback)
			r.With(auth.Middleware).Get("/logout", handleAuthLogout)
			r.With(auth.Middleware).Get("/me", handleAuthMe)
		})

		r.Group(func(r chi.Router) {
			r.Use(auth.Middleware)

			r.Get("/metrics", handleMetricsOnce)
			r.Get("/metrics/stream", handleMetricsStream)

			r.Route("/apps", func(r chi.Router) {
				r.Get("/", handleListApps)
				r.Post("/", handleCreateApp)
				r.Get("/{id}", handleGetApp)
				r.Put("/{id}", handleUpdateApp)
				r.Delete("/{id}", handleDeleteApp)
				r.Post("/{id}/deploy", handleDeployApp)
				r.Post("/{id}/cancel", handleCancelDeploy)
				r.Get("/{id}/rollback", handleRollbackApp)
				r.Post("/{id}/stop", handleStopApp)
				r.Get("/{id}/deployments", handleListDeployments)
				r.Get("/{id}/deployments/{deployID}/log", handleGetDeploymentLog)
				r.Get("/{id}/env", handleGetEnvVars)
				r.Get("/{id}/deploy-key", handleGetDeployKey)
				r.Post("/{id}/add-deploy-key", handleAddDeployKeyToGithub)
				r.Get("/{id}/detect", handleDetectStack)
			})

			r.Route("/docker", func(r chi.Router) {
				r.Get("/version", handleDockerVersion)
				r.Get("/containers", handleListContainers)
				r.Post("/containers/{id}/start", handleStartContainer)
				r.Post("/containers/{id}/stop", handleStopContainer)
				r.Delete("/containers/{id}", handleRemoveContainer)
				r.Get("/containers/{id}/logs", handleContainerLogs)
				r.Get("/images", handleListImages)
				r.Post("/images/pull", handlePullImage)
				r.Delete("/images/{id}", handleRemoveImage)
				r.Get("/volumes", handleListVolumes)
				r.Get("/networks", handleListNetworks)
			})

			r.Route("/stacks", func(r chi.Router) {
				r.Get("/", handleListStacks)
				r.Post("/", handleCreateStack)
				r.Get("/{id}", handleGetStack)
				r.Delete("/{id}", handleDeleteStack)
				r.Post("/{id}/start", handleStartStack)
				r.Post("/{id}/stop", handleStopStack)
			})

			r.Get("/marketplace", handleGetMarketplace)
			r.Post("/marketplace/refresh", handleRefreshMarketplace)

			r.Route("/domains", func(r chi.Router) {
				r.Get("/", handleListDomains)
				r.Post("/", handleAddDomain)
				r.Delete("/{id}", handleRemoveDomain)
				r.Get("/caddy-config", handleGetCaddyConfig)
				r.Get("/verify", handleVerifyDomain)
			})

			r.Route("/backups", func(r chi.Router) {
				r.Get("/", handleListBackups)
				r.Post("/", handleCreateBackup)
				r.Get("/stream", handleStreamBackup)
				r.Post("/{id}/restore", handleRestoreBackup)
				r.Post("/init", handleInitRestic)
			})

			r.Route("/settings", func(r chi.Router) {
				r.Get("/", handleGetSettings)
				r.Post("/", handleUpdateSettings)
			})

			r.Route("/storage", func(r chi.Router) {
				r.Get("/buckets", handleListBuckets)
				r.Post("/buckets", handleCreateBucket)
				r.Put("/buckets/{id}", handleUpdateBucket)
				r.Delete("/buckets/{id}", handleDeleteBucket)
				r.Get("/buckets/{bucketID}/objects", handleListObjects)
				r.Post("/buckets/{bucketID}/objects", handleUploadObject)
				r.Delete("/buckets/{bucketID}/objects/{objID}", handleDeleteObject)
				r.Get("/buckets/{bucketID}/objects/{objID}/download", handleDownloadObject)
				r.Get("/buckets/{bucketID}/objects/{objID}/share", handleGetShareLink)
				r.Post("/buckets/{bucketID}/folders", handleCreateFolder)
				r.Delete("/buckets/{bucketID}/folders", handleDeleteFolder)
				r.Post("/buckets/{id}/regenerate-upload-token", handleRegenerateUploadToken)
				r.Post("/buckets/{id}/regenerate-read-token", handleRegenerateReadToken)
			})

			r.Route("/security", func(r chi.Router) {
				r.Get("/status", handleGetSecurityStatus)
				r.Post("/scan", handleRunScan)
				r.Get("/results", handleGetScanResult)
				r.Post("/quarantine", handleQuarantineFile)
			})

			r.Get("/github/repos", handleGithubRepos)
			r.Get("/github/branches", handleGithubBranches)
			r.Get("/version", handleVersion)
			r.Post("/system/update", handleSelfUpdate)
		})
	})

	return r
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("writeJSON encode error: %v", err)
	}
}

func writeError(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(map[string]string{"error": msg}); err != nil {
		log.Printf("writeError encode error: %v", err)
	}
}
