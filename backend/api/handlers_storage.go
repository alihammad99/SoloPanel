package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/panel/backend/auth"
	"github.com/panel/backend/config"
	"github.com/panel/backend/db"
)

func storageRoot() string {
	return filepath.Join(config.C.Storage.AppsDir, ".storage")
}

func bucketDir(name string) string {
	return filepath.Join(storageRoot(), name)
}

func objectPath(bucketName, key string) string {
	return filepath.Join(bucketDir(bucketName), filepath.Clean("/"+key))
}

func randomToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ── Buckets ──────────────────────────────────────────────────────────────────

func handleListBuckets(w http.ResponseWriter, r *http.Request) {
	var buckets []db.Bucket
	db.DB.Order("created_at desc").Find(&buckets)
	writeJSON(w, buckets)
}

func handleCreateBucket(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name   string `json:"name"`
		Public bool   `json:"public"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Name == "" {
		writeError(w, "invalid input", http.StatusBadRequest)
		return
	}
	input.Name = strings.ToLower(strings.ReplaceAll(input.Name, " ", "-"))

	claims := auth.GetClaims(r)
	var u db.User
	db.DB.Where("username = ?", claims.Username).First(&u)

	bucket := db.Bucket{Name: input.Name, Public: input.Public, UserID: u.ID, UploadToken: randomToken(), ReadToken: randomToken()}
	if err := db.DB.Create(&bucket).Error; err != nil {
		writeError(w, "bucket already exists", http.StatusConflict)
		return
	}
	os.MkdirAll(bucketDir(input.Name), 0755)
	writeJSON(w, bucket)
}

func handleUpdateBucket(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	var input struct {
		Public bool `json:"public"`
	}
	json.NewDecoder(r.Body).Decode(&input)

	db.DB.Model(&db.Bucket{}).Where("id = ?", id).Update("public", input.Public)
	var bucket db.Bucket
	db.DB.First(&bucket, id)
	writeJSON(w, bucket)
}

func handleDeleteBucket(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	var bucket db.Bucket
	if err := db.DB.First(&bucket, id).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}
	db.DB.Where("bucket_id = ?", id).Delete(&db.StorageObject{})
	os.RemoveAll(bucketDir(bucket.Name))
	db.DB.Delete(&bucket)
	writeJSON(w, map[string]string{"status": "deleted"})
}

// ── Objects ───────────────────────────────────────────────────────────────────

func handleListObjects(w http.ResponseWriter, r *http.Request) {
	bucketID, _ := strconv.ParseUint(chi.URLParam(r, "bucketID"), 10, 64)
	prefix := r.URL.Query().Get("prefix")

	var objs []db.StorageObject
	q := db.DB.Where("bucket_id = ?", bucketID)
	if prefix != "" {
		q = q.Where("key LIKE ?", prefix+"%")
	}
	q.Order("key asc").Find(&objs)
	writeJSON(w, objs)
}

func handleUploadObject(w http.ResponseWriter, r *http.Request) {
	bucketID, _ := strconv.ParseUint(chi.URLParam(r, "bucketID"), 10, 64)
	var bucket db.Bucket
	if err := db.DB.First(&bucket, bucketID).Error; err != nil {
		writeError(w, "bucket not found", http.StatusNotFound)
		return
	}

	r.ParseMultipartForm(512 << 20) // 512MB
	files := r.MultipartForm.File["files"]
	prefix := r.FormValue("prefix")
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}

	type result struct {
		Name  string `json:"name"`
		Key   string `json:"key"`
		Size  int64  `json:"size"`
		Error string `json:"error,omitempty"`
	}
	results := []result{}

	for _, fh := range files {
		key := prefix + fh.Filename
		destPath := objectPath(bucket.Name, key)
		os.MkdirAll(filepath.Dir(destPath), 0755)

		src, err := fh.Open()
		if err != nil {
			results = append(results, result{Name: fh.Filename, Error: err.Error()})
			continue
		}

		dst, err := os.Create(destPath)
		if err != nil {
			src.Close()
			results = append(results, result{Name: fh.Filename, Error: err.Error()})
			continue
		}
		n, _ := io.Copy(dst, src)
		src.Close()
		dst.Close()

		ct := fh.Header.Get("Content-Type")
		if ct == "" || ct == "application/octet-stream" {
			ct = mime.TypeByExtension(filepath.Ext(fh.Filename))
		}

		// Upsert object record
		var obj db.StorageObject
		db.DB.Where("bucket_id = ? AND key = ?", bucketID, key).First(&obj)
		if obj.ID == 0 {
			obj = db.StorageObject{
				BucketID:    uint(bucketID),
				Key:         key,
				OrigName:    fh.Filename,
				ContentType: ct,
				Size:        n,
				ShareToken:  randomToken(),
				Public:      bucket.Public,
			}
			db.DB.Create(&obj)
		} else {
			db.DB.Model(&obj).Updates(map[string]interface{}{
				"content_type": ct,
				"size":         n,
			})
		}

		// Update bucket size
		db.DB.Model(&db.Bucket{}).Where("id = ?", bucketID).
			UpdateColumn("size_bytes", db.DB.Model(&db.StorageObject{}).
				Select("COALESCE(SUM(size),0)").Where("bucket_id = ?", bucketID))

		results = append(results, result{Name: fh.Filename, Key: key, Size: n})
	}

	writeJSON(w, map[string]interface{}{"uploaded": len(results), "files": results})
}

func handleDeleteObject(w http.ResponseWriter, r *http.Request) {
	bucketID, _ := strconv.ParseUint(chi.URLParam(r, "bucketID"), 10, 64)
	objID, _ := strconv.ParseUint(chi.URLParam(r, "objID"), 10, 64)

	var obj db.StorageObject
	if err := db.DB.Where("id = ? AND bucket_id = ?", objID, bucketID).First(&obj).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}
	var bucket db.Bucket
	db.DB.First(&bucket, bucketID)

	os.Remove(objectPath(bucket.Name, obj.Key))
	db.DB.Delete(&obj)
	writeJSON(w, map[string]string{"status": "deleted"})
}

func handleCreateFolder(w http.ResponseWriter, r *http.Request) {
	bucketID, _ := strconv.ParseUint(chi.URLParam(r, "bucketID"), 10, 64)
	var input struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Path == "" {
		writeError(w, "invalid input", http.StatusBadRequest)
		return
	}
	var bucket db.Bucket
	if err := db.DB.First(&bucket, bucketID).Error; err != nil {
		writeError(w, "bucket not found", http.StatusNotFound)
		return
	}
	dir := objectPath(bucket.Name, input.Path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"path": input.Path})
}

func handleDeleteFolder(w http.ResponseWriter, r *http.Request) {
	bucketID, _ := strconv.ParseUint(chi.URLParam(r, "bucketID"), 10, 64)
	var input struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Path == "" {
		writeError(w, "invalid input", http.StatusBadRequest)
		return
	}
	var bucket db.Bucket
	if err := db.DB.First(&bucket, bucketID).Error; err != nil {
		writeError(w, "bucket not found", http.StatusNotFound)
		return
	}
	prefix := strings.Trim(input.Path, "/") + "/"
	db.DB.Where("bucket_id = ? AND key LIKE ?", bucketID, prefix+"%").Delete(&db.StorageObject{})
	os.RemoveAll(objectPath(bucket.Name, input.Path))
	writeJSON(w, map[string]string{"status": "deleted"})
}

// ── File serving by bucket name + key (clean URLs) ───────────────────────────

// GET /api/storage/files/{bucketName}/{key...}
// Public buckets: no auth needed. Private buckets: need valid session cookie.
func handleServeFileByKey(w http.ResponseWriter, r *http.Request) {
	bucketName := chi.URLParam(r, "bucketName")
	key := chi.URLParam(r, "*") // wildcard captures everything after /{bucketName}/

	var bucket db.Bucket
	if err := db.DB.Where("name = ?", bucketName).First(&bucket).Error; err != nil {
		http.Error(w, "bucket not found", http.StatusNotFound)
		return
	}

	if !bucket.Public {
		authed := false
		// Accept session cookie
		if cookie, err := r.Cookie("panel_token"); err == nil {
			if _, err := auth.ValidateJWT(cookie.Value); err == nil {
				authed = true
			}
		}
		// Accept read token from Authorization: Bearer <readToken> header
		if !authed && bucket.ReadToken != "" {
			if bearer := r.Header.Get("Authorization"); strings.HasPrefix(bearer, "Bearer ") {
				if strings.TrimPrefix(bearer, "Bearer ") == bucket.ReadToken {
					authed = true
				}
			}
		}
		if !authed {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	var obj db.StorageObject
	if err := db.DB.Where("bucket_id = ? AND key = ?", bucket.ID, key).First(&obj).Error; err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	filePath := objectPath(bucket.Name, obj.Key)
	ct := obj.ContentType
	if ct == "" {
		ct = mime.TypeByExtension(filepath.Ext(obj.OrigName))
	}
	if ct == "" {
		ct = "application/octet-stream"
	}
	if bucket.Public {
		w.Header().Set("Cache-Control", "public, max-age=3600")
	} else {
		w.Header().Set("Cache-Control", "private, no-store")
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, obj.OrigName))
	http.ServeFile(w, r, filePath)
}

// ── Share links ───────────────────────────────────────────────────────────────

func handleGetShareLink(w http.ResponseWriter, r *http.Request) {
	bucketID, _ := strconv.ParseUint(chi.URLParam(r, "bucketID"), 10, 64)
	objID, _ := strconv.ParseUint(chi.URLParam(r, "objID"), 10, 64)

	var obj db.StorageObject
	if err := db.DB.Where("id = ? AND bucket_id = ?", objID, bucketID).First(&obj).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}
	var bucket db.Bucket
	db.DB.First(&bucket, bucketID)

	baseURL := r.Header.Get("Origin")
	if baseURL == "" {
		baseURL = fmt.Sprintf("http://%s", r.Host)
	}
	// Use clean bucket/key URL for public buckets, token URL for private
	var shareURL string
	if bucket.Public {
		shareURL = fmt.Sprintf("%s/api/storage/files/%s/%s", baseURL, bucket.Name, obj.Key)
	} else {
		if obj.ShareToken == "" {
			obj.ShareToken = randomToken()
			db.DB.Model(&obj).Update("share_token", obj.ShareToken)
		}
		shareURL = fmt.Sprintf("%s/api/storage/share/%s", baseURL, obj.ShareToken)
	}
	writeJSON(w, map[string]interface{}{
		"url":    shareURL,
		"public": bucket.Public,
	})
}

// Public file serving via share token (no auth required)
func handleServeSharedFile(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	var obj db.StorageObject
	if err := db.DB.Where("share_token = ?", token).First(&obj).Error; err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var bucket db.Bucket
	db.DB.First(&bucket, obj.BucketID)

	if !bucket.Public && !obj.Public {
		authed := false
		// session cookie
		if cookie, err := r.Cookie("panel_token"); err == nil {
			if _, err := auth.ValidateJWT(cookie.Value); err == nil {
				authed = true
			}
		}
		// Authorization: Bearer <readToken>
		if !authed && bucket.ReadToken != "" {
			if bearer := r.Header.Get("Authorization"); strings.HasPrefix(bearer, "Bearer ") {
				if strings.TrimPrefix(bearer, "Bearer ") == bucket.ReadToken {
					authed = true
				}
			}
		}
		if !authed {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	path := objectPath(bucket.Name, obj.Key)
	ct := obj.ContentType
	if ct == "" {
		ct = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, obj.OrigName))
	http.ServeFile(w, r, path)
}

// Preview — serve file inline; authenticated users can access private files
func handlePreviewSharedFile(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	var obj db.StorageObject
	if err := db.DB.Where("share_token = ?", token).First(&obj).Error; err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var bucket db.Bucket
	db.DB.First(&bucket, obj.BucketID)

	// Allow if public, session cookie, or Authorization: Bearer <readToken>
	if !bucket.Public && !obj.Public {
		isAuthed := false
		if cookie, err := r.Cookie("panel_token"); err == nil {
			if _, err := auth.ValidateJWT(cookie.Value); err == nil {
				isAuthed = true
			}
		}
		if !isAuthed && bucket.ReadToken != "" {
			if bearer := r.Header.Get("Authorization"); strings.HasPrefix(bearer, "Bearer ") {
				if strings.TrimPrefix(bearer, "Bearer ") == bucket.ReadToken {
					isAuthed = true
				}
			}
		}
		if !isAuthed {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	path := objectPath(bucket.Name, obj.Key)
	ct := obj.ContentType
	if ct == "" {
		ct = mime.TypeByExtension(filepath.Ext(obj.OrigName))
	}
	if ct == "" {
		ct = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ct)
	if bucket.Public || obj.Public {
		w.Header().Set("Cache-Control", "public, max-age=3600")
	} else {
		w.Header().Set("Cache-Control", "private, no-store")
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, obj.OrigName))
	http.ServeFile(w, r, path)
}

// Public upload via upload token — POST multipart/form-data to /api/storage/upload/{token}
func handlePublicUpload(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	var bucket db.Bucket
	if err := db.DB.Where("upload_token = ?", token).First(&bucket).Error; err != nil {
		http.Error(w, "invalid upload link", http.StatusNotFound)
		return
	}

	r.ParseMultipartForm(512 << 20)
	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		// Also accept single "file" field
		files = r.MultipartForm.File["file"]
	}
	prefix := r.FormValue("prefix")
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}

	type result struct {
		Name  string `json:"name"`
		Key   string `json:"key"`
		Size  int64  `json:"size"`
		Error string `json:"error,omitempty"`
	}
	results := []result{}

	for _, fh := range files {
		key := prefix + fh.Filename
		destPath := objectPath(bucket.Name, key)
		os.MkdirAll(filepath.Dir(destPath), 0755)

		src, err := fh.Open()
		if err != nil {
			results = append(results, result{Name: fh.Filename, Error: err.Error()})
			continue
		}
		dst, err := os.Create(destPath)
		if err != nil {
			src.Close()
			results = append(results, result{Name: fh.Filename, Error: err.Error()})
			continue
		}
		n, _ := io.Copy(dst, src)
		src.Close()
		dst.Close()

		ct := fh.Header.Get("Content-Type")
		if ct == "" || ct == "application/octet-stream" {
			ct = mime.TypeByExtension(filepath.Ext(fh.Filename))
		}

		var obj db.StorageObject
		db.DB.Where("bucket_id = ? AND key = ?", bucket.ID, key).First(&obj)
		if obj.ID == 0 {
			obj = db.StorageObject{
				BucketID:    bucket.ID,
				Key:         key,
				OrigName:    fh.Filename,
				ContentType: ct,
				Size:        n,
				ShareToken:  randomToken(),
				Public:      bucket.Public,
			}
			db.DB.Create(&obj)
		} else {
			db.DB.Model(&obj).Updates(map[string]interface{}{"content_type": ct, "size": n})
		}
		results = append(results, result{Name: fh.Filename, Key: key, Size: n})
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(map[string]interface{}{"uploaded": len(results), "files": results})
}

// Regenerate upload token for a bucket
func handleRegenerateUploadToken(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	token := randomToken()
	db.DB.Model(&db.Bucket{}).Where("id = ?", id).Update("upload_token", token)
	var bucket db.Bucket
	db.DB.First(&bucket, id)
	writeJSON(w, bucket)
}

// Regenerate read token for a bucket
func handleRegenerateReadToken(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	token := randomToken()
	db.DB.Model(&db.Bucket{}).Where("id = ?", id).Update("read_token", token)
	var bucket db.Bucket
	db.DB.First(&bucket, id)
	writeJSON(w, bucket)
}

// Authenticated download
func handleDownloadObject(w http.ResponseWriter, r *http.Request) {
	bucketID, _ := strconv.ParseUint(chi.URLParam(r, "bucketID"), 10, 64)
	objID, _ := strconv.ParseUint(chi.URLParam(r, "objID"), 10, 64)

	var obj db.StorageObject
	if err := db.DB.Where("id = ? AND bucket_id = ?", objID, bucketID).First(&obj).Error; err != nil {
		writeError(w, "not found", http.StatusNotFound)
		return
	}
	var bucket db.Bucket
	db.DB.First(&bucket, obj.BucketID)

	path := objectPath(bucket.Name, obj.Key)
	ct := obj.ContentType
	if ct == "" {
		ct = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, obj.OrigName))
	http.ServeFile(w, r, path)
}
