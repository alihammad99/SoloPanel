const BASE = '/api'

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (res.status === 401) {
    window.location.href = '/api/auth/login'
    return
  }
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b),
  put: (p, b) => req('PUT', p, b),
  delete: (p) => req('DELETE', p),

  auth: {
    me: () => api.get('/auth/me'),
    logout: () => api.get('/auth/logout'),
  },

  security: {
    status: () => api.get('/security/status'),
    scan: () => api.post('/security/scan', {}),
    results: () => api.get('/security/results'),
    quarantine: (path) => api.post('/security/quarantine', { path }),
  },

  apps: {
    list: () => api.get('/apps/'),
    create: (b) => api.post('/apps/', b),
    get: (id) => api.get(`/apps/${id}`),
    update: (id, b) => api.put(`/apps/${id}`, b),
    delete: (id) => api.delete(`/apps/${id}`),
    deploy: (id) => api.post(`/apps/${id}/deploy`, {}),
    deployments: (id) => api.get(`/apps/${id}/deployments`),
    env: (id) => api.get(`/apps/${id}/env`),
    deployKey: (id) => api.get(`/apps/${id}/deploy-key`),
    detect: (id) => api.get(`/apps/${id}/detect`),
  },

  docker: {
    version: () => api.get('/docker/version'),
    containers: () => api.get('/docker/containers'),
    startContainer: (id) => api.post(`/docker/containers/${id}/start`, {}),
    stopContainer: (id) => api.post(`/docker/containers/${id}/stop`, {}),
    removeContainer: (id) => api.delete(`/docker/containers/${id}`),
    containerLogs: (id, tail = 100) => api.get(`/docker/containers/${id}/logs?tail=${tail}`),
    images: () => api.get('/docker/images'),
    removeImage: (id) => api.delete(`/docker/images/${id}`),
    pullImage: (image) => api.post('/docker/images/pull', { image }),
    volumes: () => api.get('/docker/volumes'),
    networks: () => api.get('/docker/networks'),
  },

  stacks: {
    list: () => api.get('/stacks/'),
    create: (b) => api.post('/stacks/', b),
    get: (id) => api.get(`/stacks/${id}`),
    delete: (id) => api.delete(`/stacks/${id}`),
    start: (id) => api.post(`/stacks/${id}/start`, {}),
    stop: (id) => api.post(`/stacks/${id}/stop`, {}),
  },

  marketplace: {
    list: () => api.get('/marketplace'),
  },

  domains: {
    list: () => api.get('/domains/'),
    add: (b) => api.post('/domains/', b),
    remove: (id) => api.delete(`/domains/${id}`),
    caddyConfig: () => api.get('/domains/caddy-config'),
    verify: (domain) => api.get(`/domains/verify?domain=${encodeURIComponent(domain)}`),
  },

  backups: {
    list: () => api.get('/backups/'),
    create: (b) => api.post('/backups/', b),
    streamPath: (appID) => `/backups/stream${appID ? `?app_id=${appID}` : ''}`,
    initRestic: () => api.post('/backups/init', {}),
  },

  settings: {
    get: () => api.get('/settings/'),
    update: (b) => api.post('/settings/', b),
  },

  github: {
    repos: (page = 1) => api.get(`/github/repos?page=${page}`),
  },

  metrics: {
    once: () => api.get('/metrics'),
  },

  storage: {
    listBuckets: () => api.get('/storage/buckets'),
    createBucket: (b) => api.post('/storage/buckets', b),
    updateBucket: (id, b) => api.put(`/storage/buckets/${id}`, b),
    deleteBucket: (id) => api.delete(`/storage/buckets/${id}`),
    listObjects: (bucketID, prefix = '') => api.get(`/storage/buckets/${bucketID}/objects?prefix=${encodeURIComponent(prefix)}`),
    uploadObjects: (bucketID, formData) => fetch(`/api/storage/buckets/${bucketID}/objects`, {
      method: 'POST', credentials: 'include', body: formData,
    }).then(r => r.json()),
    deleteObject: (bucketID, objID) => api.delete(`/storage/buckets/${bucketID}/objects/${objID}`),
    shareLink: (bucketID, objID) => api.get(`/storage/buckets/${bucketID}/objects/${objID}/share`),
    downloadURL: (bucketID, objID) => `/api/storage/buckets/${bucketID}/objects/${objID}/download`,
    fileURL: (bucketName, key) => `/api/storage/files/${bucketName}/${key}`,
    previewURL: (shareToken) => `/api/storage/preview/${shareToken}`,
    uploadURL: (uploadToken) => `${window.location.origin}/api/storage/upload/${uploadToken}`,
    createFolder: (bucketID, path) => api.post(`/storage/buckets/${bucketID}/folders`, { path }),
    deleteFolder: (bucketID, path) => fetch(`/api/storage/buckets/${bucketID}/folders`, {
      method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }).then(r => r.json()),
    regenerateUploadToken: (bucketID) => api.post(`/storage/buckets/${bucketID}/regenerate-upload-token`, {}),
    regenerateReadToken: (bucketID) => api.post(`/storage/buckets/${bucketID}/regenerate-read-token`, {}),
  },
}

export function streamSSE(path, onData, onDone) {
  const es = new EventSource('/api' + path, { withCredentials: true })
  es.onmessage = (e) => onData(e.data)
  es.onerror = () => { es.close(); if (onDone) onDone() }
  es.onopen = null
  return () => es.close()
}
