import { useState, useEffect, useRef } from 'preact/hooks'
import {
  HardDrive, Plus, Trash2, Upload, FolderPlus,
  Link, Download, Globe, Lock, Copy, Check, X, ChevronRight,
  RefreshCw, AlertCircle, Eye, RotateCcw, ExternalLink, KeyRound,
} from 'lucide-preact'
import { api } from '../api/client'

function formatBytes(b) {
  if (!b) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function fileIcon(ct = '') {
  if (ct.startsWith('image/')) return '🖼️'
  if (ct.startsWith('video/')) return '🎬'
  if (ct.startsWith('audio/')) return '🎵'
  if (ct.includes('pdf')) return '📄'
  if (ct.includes('zip') || ct.includes('tar') || ct.includes('gzip')) return '🗜️'
  if (ct.includes('json') || ct.includes('javascript') || ct.includes('html') || ct.includes('css')) return '💻'
  return '📁'
}

// ── New Bucket Modal ──────────────────────────────────────────────────────────
function NewBucketModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [pub, setPub] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    const res = await api.storage.createBucket({ name: name.trim(), public: pub })
    setLoading(false)
    if (res?.error || res?.message?.includes('exists')) { setError('Name already taken'); return }
    onCreated(res)
  }

  return (
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="bg-panel-card border border-panel-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-semibold text-white">New Bucket</h2>
          <button onClick={onClose} class="text-panel-muted hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={submit} class="space-y-4">
          <div>
            <label class="label">Bucket name</label>
            <input class="input" placeholder="my-bucket" value={name} onInput={e => setName(e.target.value)} autoFocus />
          </div>
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <div onClick={() => setPub(v => !v)} class={`w-9 h-5 rounded-full transition-colors ${pub ? 'bg-panel-accent' : 'bg-panel-border'} relative`}>
              <span class={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${pub ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span class="text-sm text-panel-muted">Public bucket <span class="text-xs">(files accessible without auth)</span></span>
          </label>
          {error && <div class="text-panel-danger text-sm">{error}</div>}
          <div class="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} class="btn-ghost">Cancel</button>
            <button type="submit" class="btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── New Folder Modal ──────────────────────────────────────────────────────────
function NewFolderModal({ bucket, prefix, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const path = prefix ? `${prefix}/${name.trim()}` : name.trim()
    await api.storage.createFolder(bucket.ID, path)
    setLoading(false)
    onCreated(path)
  }

  return (
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="bg-panel-card border border-panel-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-semibold text-white">New Folder</h2>
          <button onClick={onClose} class="text-panel-muted hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={submit} class="space-y-4">
          <div>
            <label class="label">Folder name</label>
            {prefix && <div class="text-xs text-panel-muted mb-1">in: /{prefix}</div>}
            <input class="input" placeholder="folder-name" value={name} onInput={e => setName(e.target.value)} autoFocus />
          </div>
          <div class="flex gap-3 justify-end">
            <button type="button" onClick={onClose} class="btn-ghost">Cancel</button>
            <button type="submit" class="btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ bucket, obj, onClose }) {
  const [url, setUrl] = useState('')
  const [isPublic, setIsPublic] = useState(bucket.Public)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.storage.shareLink(bucket.ID, obj.ID).then(res => {
      setUrl(res?.url || '')
      setIsPublic(res?.public ?? bucket.Public)
      setLoading(false)
    })
  }, [])

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="bg-panel-card border border-panel-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-semibold text-white">Share Link</h2>
          <button onClick={onClose} class="text-panel-muted hover:text-white"><X size={18} /></button>
        </div>
        <div class="space-y-4">
          <div class="text-sm text-panel-muted">
            <span class="font-medium text-white">{obj.OrigName}</span>
          </div>
          {!isPublic && (
            <div class="flex items-center gap-1.5 text-amber-400 text-xs bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
              <AlertCircle size={12} />
              Private bucket — this link only works for logged-in users. Make the bucket public for a truly shareable link.
            </div>
          )}
          {loading ? (
            <div class="text-panel-muted text-sm animate-pulse">Generating link…</div>
          ) : (
            <div class="flex items-center gap-2">
              <input class="input flex-1 text-xs font-mono" readOnly value={url} />
              <button onClick={copy} class="btn-ghost px-3 py-2">
                {copied ? <Check size={14} class="text-panel-success" /> : <Copy size={14} />}
              </button>
            </div>
          )}
          {isPublic && url && (
            <div class="text-xs text-panel-muted">
              URL: <span class="text-gray-300 font-mono">/api/storage/files/{bucket.Name}/{obj.Key}</span>
            </div>
          )}
          <div class="flex justify-end">
            <button onClick={onClose} class="btn-ghost">Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Preview Modal ────────────────────────────────────────────────────────────
function PreviewModal({ obj, bucket, onClose }) {
  const publicUrl = bucket.Public ? api.storage.fileURL(bucket.Name, obj.Key) : null
  const authUrl = api.storage.downloadURL(bucket.ID, obj.ID)

  const ct = obj.ContentType || ''
  const isImage = ct.startsWith('image/')
  const isVideo = ct.startsWith('video/')
  const isAudio = ct.startsWith('audio/')
  const isPDF = ct.includes('pdf')
  const isText = ct.startsWith('text/') || ct.includes('json') || ct.includes('javascript')
  const canPreview = isImage || isVideo || isAudio || isPDF || isText

  // For private files, fetch with credentials and create a blob URL
  const [blobUrl, setBlobUrl] = useState(null)
  const [text, setText] = useState(null)
  const [loadErr, setLoadErr] = useState(null)

  useEffect(() => {
    if (!canPreview) return
    if (bucket.Public) return // public: use direct URL, no blob needed

    const fetchUrl = authUrl
    if (isText) {
      fetch(fetchUrl, { credentials: 'include' })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.text() })
        .then(setText)
        .catch(e => setLoadErr(e.message))
    } else {
      fetch(fetchUrl, { credentials: 'include' })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.blob() })
        .then(blob => setBlobUrl(URL.createObjectURL(blob)))
        .catch(e => setLoadErr(e.message))
    }
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [])

  // Which URL to actually pass to <img>, <video>, <iframe>
  const mediaUrl = bucket.Public ? publicUrl : blobUrl

  return (
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div class="bg-panel-card border border-panel-border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div class="flex items-center justify-between px-5 py-4 border-b border-panel-border shrink-0">
          <div class="flex items-center gap-3">
            <span class="text-lg">{fileIcon(ct)}</span>
            <div>
              <div class="text-sm font-medium text-white">{obj.OrigName}</div>
              <div class="text-xs text-panel-muted">{formatBytes(obj.Size)} · {ct || 'unknown'}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            {bucket.Public && publicUrl && (
              <a href={publicUrl} target="_blank" rel="noreferrer" class="btn-ghost text-xs px-2 py-1">
                <ExternalLink size={12} /> Open
              </a>
            )}
            <a href={api.storage.downloadURL(bucket.ID, obj.ID)} download={obj.OrigName} class="btn-ghost text-xs px-2 py-1">
              <Download size={12} /> Download
            </a>
            <button onClick={onClose} class="text-panel-muted hover:text-white ml-2"><X size={18} /></button>
          </div>
        </div>
        <div class="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
          {loadErr && (
            <div class="text-center text-panel-danger space-y-1">
              <AlertCircle size={24} class="mx-auto" />
              <div class="text-sm">Failed to load: {loadErr}</div>
            </div>
          )}
          {!loadErr && !canPreview && (
            <div class="text-center text-panel-muted space-y-2">
              <div class="text-4xl">{fileIcon(ct)}</div>
              <div class="text-sm">{obj.OrigName}</div>
              <div class="text-xs">No preview available for this file type</div>
            </div>
          )}
          {!loadErr && canPreview && !bucket.Public && !mediaUrl && !isText && (
            <div class="text-panel-muted text-sm animate-pulse">Loading…</div>
          )}
          {!loadErr && canPreview && isImage && mediaUrl && (
            <img src={mediaUrl} alt={obj.OrigName} class="max-w-full max-h-full object-contain rounded-lg" />
          )}
          {!loadErr && canPreview && isVideo && mediaUrl && (
            <video src={mediaUrl} controls class="max-w-full max-h-full rounded-lg" />
          )}
          {!loadErr && canPreview && isAudio && mediaUrl && (
            <audio src={mediaUrl} controls class="w-full" />
          )}
          {!loadErr && canPreview && isPDF && mediaUrl && (
            <iframe src={mediaUrl} class="w-full h-full min-h-[60vh] rounded-lg border-0" />
          )}
          {!loadErr && canPreview && isText && (
            <pre class="text-xs text-gray-300 bg-panel-bg rounded-lg p-4 overflow-auto w-full max-h-[60vh] font-mono">
              {text ?? 'Loading…'}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Upload Link Modal ─────────────────────────────────────────────────────────
function UploadLinkModal({ bucket, onClose, onRegenerate }) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const url = api.storage.uploadURL(bucket.UploadToken)

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerate() {
    setRegenerating(true)
    const updated = await api.storage.regenerateUploadToken(bucket.ID)
    setRegenerating(false)
    onRegenerate(updated)
  }

  const curlExample = `curl -X POST "${url}" \\
  -F "files=@yourfile.png"`

  return (
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="bg-panel-card border border-panel-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-semibold text-white">Upload Link</h2>
          <button onClick={onClose} class="text-panel-muted hover:text-white"><X size={18} /></button>
        </div>
        <div class="space-y-4">
          <div class="text-sm text-panel-muted">Anyone with this link can upload files to <span class="text-white font-medium">{bucket.Name}</span>.</div>
          <div class="flex items-center gap-2">
            <input class="input flex-1 text-xs font-mono" readOnly value={url} />
            <button onClick={copy} class="btn-ghost px-3 py-2">
              {copied ? <Check size={14} class="text-panel-success" /> : <Copy size={14} />}
            </button>
          </div>
          <div class="bg-panel-bg rounded-lg p-3 border border-panel-border">
            <div class="text-xs text-panel-muted mb-2 font-medium">cURL example</div>
            <pre class="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">{curlExample}</pre>
          </div>
          <div class="text-xs text-panel-muted">
            <span class="text-white font-medium">Note:</span> Uploaded files inherit bucket privacy (currently <span class={bucket.Public ? 'text-panel-success' : 'text-amber-400'}>{bucket.Public ? 'public' : 'private'}</span>).
          </div>
          <div class="flex items-center justify-between pt-1">
            <button onClick={regenerate} disabled={regenerating} class="btn-ghost text-xs text-panel-danger hover:text-panel-danger flex items-center gap-1">
              <RotateCcw size={12} class={regenerating ? 'animate-spin' : ''} />
              {regenerating ? 'Regenerating…' : 'Regenerate link'}
            </button>
            <button onClick={onClose} class="btn-ghost">Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Upload Drop Zone ──────────────────────────────────────────────────────────
function UploadZone({ bucket, prefix, onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState([])
  const inputRef = useRef(null)

  async function uploadFiles(files) {
    if (!files.length) return
    setUploading(true)
    setProgress(Array.from(files).map(f => ({ name: f.name, status: 'uploading' })))

    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    if (prefix) fd.append('prefix', prefix)

    const res = await api.storage.uploadObjects(bucket.ID, fd)
    setUploading(false)
    setProgress(
      (res?.files || []).map(f => ({ name: f.name, status: f.error ? 'error' : 'done', error: f.error }))
    )
    setTimeout(() => setProgress([]), 3000)
    onUploaded()
  }

  return (
    <div
      class={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${dragging ? 'border-panel-accent bg-panel-accent/5' : 'border-panel-border hover:border-panel-accent/50'
        }`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple class="hidden" onChange={e => uploadFiles(e.target.files)} />
      <Upload size={24} class={`mx-auto mb-2 ${dragging ? 'text-panel-accent' : 'text-panel-muted'}`} />
      <div class="text-sm text-panel-muted">
        {uploading ? 'Uploading…' : <><span class="text-white font-medium">Click to upload</span> or drag & drop</>}
      </div>
      {progress.length > 0 && (
        <div class="mt-3 space-y-1 text-left">
          {progress.map((p, i) => (
            <div key={i} class="flex items-center gap-2 text-xs">
              <span class={p.status === 'done' ? 'text-panel-success' : p.status === 'error' ? 'text-panel-danger' : 'text-panel-muted animate-pulse'}>
                {p.status === 'done' ? '✓' : p.status === 'error' ? '✗' : '…'}
              </span>
              <span class="text-gray-300 truncate">{p.name}</span>
              {p.error && <span class="text-panel-danger">{p.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Object Row ────────────────────────────────────────────────────────────────
function ObjectRow({ obj, bucket, onDelete, onShare, onPreview }) {
  const isFolder = obj._type === 'folder'

  return (
    <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-panel-bg/50 group transition-colors">
      <span class="text-lg w-6 shrink-0">{isFolder ? '📂' : fileIcon(obj.ContentType)}</span>
      <div class="flex-1 min-w-0">
        <button
          class="text-sm text-white truncate text-left w-full hover:text-panel-accent transition-colors"
          onClick={() => !isFolder && onPreview(obj)}
        >
          {isFolder ? obj._name : obj.OrigName}
        </button>
        {!isFolder && <div class="text-xs text-panel-muted">{formatBytes(obj.Size)} · {obj.ContentType || 'unknown'}</div>}
      </div>
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isFolder && (
          <>
            <button class="btn-ghost text-xs px-2 py-1" title="Preview" onClick={() => onPreview(obj)}>
              <Eye size={12} />
            </button>
            <a
              href={api.storage.downloadURL(bucket.ID, obj.ID)}
              download={obj.OrigName}
              class="btn-ghost text-xs px-2 py-1"
              onClick={e => e.stopPropagation()}
            >
              <Download size={12} />
            </a>
            <button class="btn-ghost text-xs px-2 py-1" title="Share link" onClick={() => onShare(obj)}>
              <Link size={12} />
            </button>
          </>
        )}
        <button
          class="btn-danger text-xs px-2 py-1"
          onClick={() => isFolder ? onDelete(obj, true) : onDelete(obj, false)}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Bucket View ───────────────────────────────────────────────────────────────
function CopyField({ label, value, mono = true }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div class="space-y-1">
      <div class="text-xs text-panel-muted font-medium">{label}</div>
      <div class="flex items-center gap-2">
        <input class={`input flex-1 text-xs ${mono ? 'font-mono' : ''}`} readOnly value={value} />
        <button onClick={copy} class="btn-ghost px-2 py-1.5 shrink-0">
          {copied ? <Check size={12} class="text-panel-success" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  )
}

function BucketView({ bucket, onBack, onBucketUpdate }) {
  const [objects, setObjects] = useState([])
  const [prefix, setPrefix] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [shareObj, setShareObj] = useState(null)
  const [previewObj, setPreviewObj] = useState(null)
  const [showUploadLink, setShowUploadLink] = useState(false)
  const [showTokens, setShowTokens] = useState(false)
  const [regenerating, setRegenerating] = useState(null)
  const [currentBucket, setCurrentBucket] = useState(bucket)
  const [isPublic, setIsPublic] = useState(bucket.Public)

  async function load() {
    setLoading(true)
    const objs = await api.storage.listObjects(bucket.ID, prefix)
    setObjects(objs || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [prefix])

  // Build virtual folder tree from flat keys
  function buildTree(objs, currentPrefix) {
    const folders = new Set()
    const files = []
    for (const obj of objs) {
      const rel = currentPrefix ? obj.Key.slice(currentPrefix.length + 1) : obj.Key
      const parts = rel.split('/')
      if (parts.length > 1) {
        folders.add(parts[0])
      } else {
        files.push(obj)
      }
    }
    return {
      folders: Array.from(folders).map(f => ({ _type: 'folder', _name: f, _path: currentPrefix ? `${currentPrefix}/${f}` : f })),
      files,
    }
  }

  const { folders, files } = buildTree(objects, prefix)

  const breadcrumbs = prefix ? prefix.split('/') : []

  async function togglePublic() {
    const next = !isPublic
    setIsPublic(next)
    const updated = await api.storage.updateBucket(currentBucket.ID, { public: next })
    setCurrentBucket(updated)
    onBucketUpdate(updated)
  }

  function handleUploadTokenRegenerate(updated) {
    setCurrentBucket(updated)
    onBucketUpdate(updated)
  }

  async function regenToken(type) {
    setRegenerating(type)
    const updated = type === 'read'
      ? await api.storage.regenerateReadToken(currentBucket.ID)
      : await api.storage.regenerateUploadToken(currentBucket.ID)
    setCurrentBucket(updated)
    onBucketUpdate(updated)
    setRegenerating(null)
  }

  async function deleteObj(obj, isFolder) {
    if (!confirm(`Delete ${isFolder ? 'folder' : 'file'} "${isFolder ? obj._name : obj.OrigName}"?`)) return
    if (isFolder) {
      await api.storage.deleteFolder(bucket.ID, obj._path)
    } else {
      await api.storage.deleteObject(bucket.ID, obj.ID)
    }
    load()
  }

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button onClick={onBack} class="btn-ghost text-xs px-2 py-1">← Buckets</button>
          <div class="flex items-center gap-2">
            <HardDrive size={18} class="text-panel-accent" />
            <span class="font-semibold text-white">{bucket.Name}</span>
            <button
              onClick={togglePublic}
              class={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${isPublic
                ? 'text-panel-success border-panel-success/30 bg-panel-success/5'
                : 'text-panel-muted border-panel-border'
                }`}
            >
              {isPublic ? <><Globe size={10} /> Public</> : <><Lock size={10} /> Private</>}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          {!isPublic && (
            <button onClick={() => setShowTokens(v => !v)} class={`btn-ghost text-xs px-3 py-1.5 ${showTokens ? 'text-panel-accent' : ''}`}>
              <KeyRound size={13} /> Access Tokens
            </button>
          )}
          <button onClick={() => setShowUploadLink(true)} class="btn-ghost text-xs px-3 py-1.5">
            <Link size={13} /> Upload Link
          </button>
          <button onClick={() => setShowNewFolder(true)} class="btn-ghost text-xs px-3 py-1.5">
            <FolderPlus size={13} /> New Folder
          </button>
          <button onClick={load} class="btn-ghost text-xs px-2 py-1.5">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Access Tokens panel */}
      {showTokens && !isPublic && (
        <div class="card !p-4 space-y-4 border-panel-accent/20">
          <div class="flex items-center gap-2">
            <KeyRound size={14} class="text-panel-accent" />
            <span class="text-sm font-medium text-white">Access Tokens</span>
            <span class="text-xs text-panel-muted ml-1">Use these to access private bucket files without logging in</span>
          </div>

          <div class="space-y-3">
            <div class="space-y-1">
              <div class="text-xs text-panel-muted font-medium">Read Token <span class="text-gray-500">(access files via URL)</span></div>
              <div class="flex items-center gap-2">
                <input class="input flex-1 text-xs font-mono" readOnly value={currentBucket.ReadToken || '—'} />
                <button
                  onClick={() => { navigator.clipboard.writeText(currentBucket.ReadToken); }}
                  class="btn-ghost px-2 py-1.5 shrink-0"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={() => regenToken('read')}
                  disabled={regenerating === 'read'}
                  class="btn-ghost px-2 py-1.5 shrink-0 text-panel-danger"
                  title="Regenerate"
                >
                  <RotateCcw size={12} class={regenerating === 'read' ? 'animate-spin' : ''} />
                </button>
              </div>
              <div class="bg-panel-bg rounded-lg px-3 py-2 border border-panel-border space-y-1">
                <div class="text-xs text-panel-muted font-medium">Example</div>
                <pre class="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">{`curl "${window.location.origin}/api/storage/files/${currentBucket.Name}/yourfile.jpg" \\\n  -H "Authorization: Bearer ${currentBucket.ReadToken}"`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <div class="flex items-center gap-1 text-sm">
        <button onClick={() => setPrefix('')} class="text-panel-muted hover:text-white transition-colors">
          {bucket.Name}
        </button>
        {breadcrumbs.map((crumb, i) => (
          <>
            <ChevronRight size={12} class="text-panel-border" />
            <button
              key={i}
              onClick={() => setPrefix(breadcrumbs.slice(0, i + 1).join('/'))}
              class={i === breadcrumbs.length - 1 ? 'text-white font-medium' : 'text-panel-muted hover:text-white transition-colors'}
            >
              {crumb}
            </button>
          </>
        ))}
      </div>

      {/* Upload */}
      <UploadZone bucket={bucket} prefix={prefix} onUploaded={load} />

      {/* File listing */}
      <div class="card !p-2 space-y-0.5">
        {loading && (
          <div class="text-panel-muted text-sm text-center py-8 animate-pulse">Loading…</div>
        )}
        {!loading && folders.length === 0 && files.length === 0 && (
          <div class="text-panel-muted text-sm text-center py-8">Empty folder</div>
        )}
        {folders.map(f => (
          <div
            key={f._path}
            class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-panel-bg/50 cursor-pointer group transition-colors"
            onClick={() => setPrefix(f._path)}
          >
            <span class="text-lg w-6 shrink-0">📂</span>
            <div class="flex-1 text-sm text-white">{f._name}/</div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                class="btn-danger text-xs px-2 py-1"
                onClick={e => { e.stopPropagation(); deleteObj(f, true) }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {files.map(obj => (
          <ObjectRow key={obj.ID} obj={obj} bucket={currentBucket} onDelete={deleteObj} onShare={setShareObj} onPreview={setPreviewObj} />
        ))}
      </div>

      {showNewFolder && (
        <NewFolderModal
          bucket={bucket}
          prefix={prefix}
          onClose={() => setShowNewFolder(false)}
          onCreated={() => { setShowNewFolder(false); load() }}
        />
      )}
      {shareObj && <ShareModal bucket={currentBucket} obj={shareObj} onClose={() => setShareObj(null)} />}
      {previewObj && <PreviewModal bucket={currentBucket} obj={previewObj} onClose={() => setPreviewObj(null)} />}
      {showUploadLink && (
        <UploadLinkModal
          bucket={currentBucket}
          onClose={() => setShowUploadLink(false)}
          onRegenerate={handleUploadTokenRegenerate}
        />
      )}
    </div>
  )
}

// ── Main Storage Page ─────────────────────────────────────────────────────────
export function Storage() {
  const [buckets, setBuckets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [activeBucket, setActiveBucket] = useState(null)

  async function load() {
    setLoading(true)
    const b = await api.storage.listBuckets()
    setBuckets(b || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteBucket(b) {
    if (!confirm(`Delete bucket "${b.Name}" and all its files?`)) return
    await api.storage.deleteBucket(b.ID)
    setBuckets(prev => prev.filter(x => x.ID !== b.ID))
  }

  function onBucketUpdate(updated) {
    setBuckets(prev => prev.map(b => b.ID === updated.ID ? updated : b))
    if (activeBucket?.ID === updated.ID) setActiveBucket(updated)
  }

  if (activeBucket) {
    return (
      <div class="space-y-6">
        <BucketView
          bucket={activeBucket}
          onBack={() => { setActiveBucket(null); load() }}
          onBucketUpdate={onBucketUpdate}
        />
      </div>
    )
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Storage</h1>
          <p class="text-panel-muted text-sm mt-1">{buckets.length} bucket{buckets.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowNew(true)} class="btn-primary">
          <Plus size={16} /> New Bucket
        </button>
      </div>

      {loading && (
        <div class="text-panel-muted text-center py-16 animate-pulse">Loading buckets…</div>
      )}

      {!loading && buckets.length === 0 && (
        <div class="card text-center py-16">
          <HardDrive size={40} class="text-panel-border mx-auto mb-4" />
          <div class="text-white font-medium mb-1">No buckets yet</div>
          <div class="text-panel-muted text-sm mb-4">Create a bucket to start storing files</div>
          <button onClick={() => setShowNew(true)} class="btn-primary mx-auto">
            <Plus size={14} /> New Bucket
          </button>
        </div>
      )}

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {buckets.map(b => (
          <div
            key={b.ID}
            class="card hover:border-panel-accent/40 transition-colors cursor-pointer group"
            onClick={() => setActiveBucket(b)}
          >
            <div class="flex items-start justify-between mb-3">
              <div class="w-10 h-10 rounded-xl bg-panel-accent/10 flex items-center justify-center">
                <HardDrive size={18} class="text-panel-accent" />
              </div>
              <div class="flex items-center gap-2">
                <span class={`text-xs px-2 py-0.5 rounded-full border ${b.Public
                  ? 'text-panel-success border-panel-success/30 bg-panel-success/5'
                  : 'text-panel-muted border-panel-border'
                  }`}>
                  {b.Public ? '🌐 Public' : '🔒 Private'}
                </span>
                <button
                  class="opacity-0 group-hover:opacity-100 btn-danger text-xs px-2 py-1 transition-opacity"
                  onClick={e => { e.stopPropagation(); deleteBucket(b) }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <div class="font-semibold text-white mb-1">{b.Name}</div>
            <div class="text-xs text-panel-muted">{formatBytes(b.SizeBytes)}</div>
          </div>
        ))}
      </div>

      {showNew && (
        <NewBucketModal
          onClose={() => setShowNew(false)}
          onCreated={b => { setBuckets(prev => [b, ...prev]); setShowNew(false); setActiveBucket(b) }}
        />
      )}
    </div>
  )
}
