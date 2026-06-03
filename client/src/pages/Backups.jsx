import { useState, useEffect } from 'preact/hooks'
import { Archive, Plus, RotateCcw, RefreshCw } from 'lucide-preact'
import { api } from '../api/client'
import { LogViewer } from '../components/LogViewer'

function BackupRow({ backup, onRestore }) {
  const statusColor = { success: 'badge-success', failed: 'badge-danger', running: 'badge-warning' }[backup.Status] || 'badge-muted'

  return (
    <tr class="hover:bg-white/2">
      <td class="py-3 pr-4">
        <div class="text-white text-sm font-mono">{backup.SnapshotID || '—'}</div>
        <div class="text-xs text-panel-muted">{backup.Tags}</div>
      </td>
      <td class="py-3 pr-4">
        <span class={statusColor}>{backup.Status}</span>
      </td>
      <td class="py-3 pr-4 text-panel-muted text-xs">
        {backup.Size > 0 ? (backup.Size / 1e6).toFixed(1) + ' MB' : '—'}
      </td>
      <td class="py-3 pr-4 text-panel-muted text-xs">
        {new Date(backup.CreatedAt).toLocaleString()}
      </td>
      <td class="py-3">
        {backup.SnapshotID && (
          <button onClick={() => onRestore(backup)} class="btn-ghost px-2 py-1 text-xs">
            <RotateCcw size={11} /> Restore
          </button>
        )}
      </td>
    </tr>
  )
}

function NewBackupModal({ onClose }) {
  const [apps, setApps] = useState([])
  const [appID, setAppID] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamPath, setStreamPath] = useState(null)

  useEffect(() => { api.apps.list().then(d => setApps(d || [])) }, [])

  function start() {
    setStreamPath(api.backups.streamPath(appID))
    setStreaming(true)
  }

  if (streaming && streamPath) {
    return (
      <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div class="card w-full max-w-2xl space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-white">Running Backup…</h2>
            <button onClick={onClose} class="text-panel-muted hover:text-white text-xl">×</button>
          </div>
          <LogViewer path={streamPath} onDone={onClose} />
          <button onClick={onClose} class="btn-ghost text-xs">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-md space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-white">New Backup</h2>
          <button onClick={onClose} class="text-panel-muted hover:text-white text-xl">×</button>
        </div>
        <div>
          <label class="label">Scope</label>
          <select class="input" value={appID} onInput={e => setAppID(e.target.value)}>
            <option value="">Full backup (all apps + DB)</option>
            {apps.map(a => <option key={a.ID} value={a.ID}>{a.Name}</option>)}
          </select>
        </div>
        <p class="text-xs text-panel-muted">
          Backups are stored in your configured S3-compatible bucket via Restic.
          Make sure S3 settings are configured in <a href="/settings" class="text-panel-accent hover:underline">Settings</a>.
        </p>
        <div class="flex gap-3 justify-end">
          <button onClick={onClose} class="btn-ghost">Cancel</button>
          <button onClick={start} class="btn-primary">Start Backup</button>
        </div>
      </div>
    </div>
  )
}

export function Backups() {
  const [backups, setBackups] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [restoring, setRestoring] = useState(null)

  useEffect(() => { load() }, [])

  function load() { api.backups.list().then(d => setBackups(d || [])) }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Backups</h1>
          <p class="text-panel-muted text-sm mt-1">Powered by Restic → S3-compatible storage</p>
        </div>
        <div class="flex gap-2">
          <button onClick={load} class="btn-ghost">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowModal(true)} class="btn-primary">
            <Plus size={16} /> New Backup
          </button>
        </div>
      </div>

      {backups.length === 0 ? (
        <div class="card text-center py-16">
          <Archive size={40} class="text-panel-border mx-auto mb-4" />
          <div class="text-white font-medium mb-1">No backups yet</div>
          <div class="text-panel-muted text-sm mb-4">
            Configure S3 settings first, then create your first backup
          </div>
          <div class="flex gap-3 justify-center">
            <a href="/settings" class="btn-ghost text-sm">Configure S3</a>
            <button onClick={() => setShowModal(true)} class="btn-primary text-sm">
              <Plus size={14} /> New Backup
            </button>
          </div>
        </div>
      ) : (
        <div class="card overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-panel-muted border-b border-panel-border">
                <th class="pb-3 pr-4">Snapshot</th>
                <th class="pb-3 pr-4">Status</th>
                <th class="pb-3 pr-4">Size</th>
                <th class="pb-3 pr-4">Created</th>
                <th class="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-panel-border/30">
              {backups.map(b => (
                <BackupRow key={b.ID} backup={b} onRestore={setRestoring} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <NewBackupModal onClose={() => { setShowModal(false); load() }} />}

      {restoring && (
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div class="card w-full max-w-2xl space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-white">Restore {restoring.SnapshotID}</h3>
              <button onClick={() => setRestoring(null)} class="text-panel-muted hover:text-white text-xl">×</button>
            </div>
            <LogViewer path={`/backups/${restoring.ID}/restore`} onDone={() => { }} />
            <button onClick={() => setRestoring(null)} class="btn-ghost text-xs">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
