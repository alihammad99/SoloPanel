import { useState, useEffect } from 'preact/hooks'
import { Play, Square, Trash2, RefreshCw, HardDrive, Network, Terminal, X, Download, AlertTriangle, Box } from 'lucide-preact'
import { api } from '../api/client'

function TabBar({ tabs, active, onChange }) {
  return (
    <div class="flex gap-1 bg-panel-bg border border-panel-border rounded-lg p-1 w-fit">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => onChange(id)}
          class={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${active === id ? 'bg-panel-accent text-white' : 'text-panel-muted hover:text-white'
            }`}
        >
          <Icon size={13} />{label}
        </button>
      ))}
    </div>
  )
}

function StateIcon({ state }) {
  const c = state === 'running' ? 'bg-panel-success animate-pulse' : state === 'exited' ? 'bg-red-500/60' : 'bg-panel-border'
  return <span class={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${c}`} />
}

function LogModal({ container, onClose }) {
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(true)
  const name = container.Names?.[0]?.replace('/', '') || container.ID?.slice(0, 12)

  useEffect(() => {
    api.docker.containerLogs(container.ID, 300).then(d => {
      setLogs(d?.logs || d?.error || 'No logs')
      setLoading(false)
    })
  }, [container.ID])

  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-4xl h-[70vh] flex flex-col">
        <div class="flex items-center justify-between mb-3 flex-shrink-0">
          <div class="flex items-center gap-2">
            <Terminal size={14} class="text-panel-accent" />
            <h3 class="font-semibold text-white">{name}</h3>
            <span class="text-xs text-panel-muted">last 300 lines</span>
          </div>
          <button onClick={onClose} class="text-panel-muted hover:text-white"><X size={16} /></button>
        </div>
        <div class="flex-1 overflow-auto bg-panel-bg rounded-lg p-3 font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
          {loading ? <span class="text-panel-muted">Loading logs…</span> : logs}
        </div>
      </div>
    </div>
  )
}

function PullModal({ onClose, onDone }) {
  const [image, setImage] = useState('')
  const [pulling, setPulling] = useState(false)
  const [logs, setLogs] = useState('')

  async function pull() {
    if (!image.trim()) return
    setPulling(true)
    const res = await api.docker.pullImage(image.trim())
    setLogs(res?.logs || res?.error || 'Done')
    setPulling(false)
    onDone()
  }

  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-md space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-white flex items-center gap-2"><Download size={14} class="text-panel-accent" /> Pull Image</h3>
          <button onClick={onClose} class="text-panel-muted hover:text-white"><X size={16} /></button>
        </div>
        <input class="input" value={image} onInput={e => setImage(e.target.value)} placeholder="nginx:latest, postgres:16, …" />
        {logs && <pre class="bg-panel-bg rounded p-2 text-xs text-gray-300 max-h-32 overflow-auto">{logs}</pre>}
        <div class="flex gap-3 justify-end">
          <button onClick={onClose} class="btn-ghost">Cancel</button>
          <button onClick={pull} disabled={pulling} class="btn-primary">
            {pulling ? 'Pulling…' : 'Pull'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ErrorBanner({ error }) {
  if (!error) return null
  return (
    <div class="flex items-start gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
      <AlertTriangle size={16} class="text-red-400 flex-shrink-0 mt-0.5" />
      <div>
        <p class="text-red-300 font-medium">Docker error</p>
        <p class="text-red-400/80 text-xs mt-0.5">{error}</p>
      </div>
    </div>
  )
}

function ContainersTab() {
  const [containers, setContainers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [logModal, setLogModal] = useState(null)

  const load = () => {
    setLoading(true); setError(null)
    api.docker.containers().then(d => {
      if (d?.error) { setError(d.error); setLoading(false); return }
      setContainers(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }
  useEffect(load, [])

  async function start(id) { await api.docker.startContainer(id); load() }
  async function stop(id) { await api.docker.stopContainer(id); load() }
  async function remove(id) {
    if (!confirm('Force-remove container?')) return
    await api.docker.removeContainer(id); load()
  }

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-panel-muted">{containers.length} container{containers.length !== 1 ? 's' : ''}</span>
        <button onClick={load} class="btn-ghost text-xs px-3 py-1.5"><RefreshCw size={12} /> Refresh</button>
      </div>
      <ErrorBanner error={error} />
      {loading && !error && (
        <div class="space-y-2">{[...Array(3)].map((_, i) => <div key={i} class="h-14 bg-panel-border/10 rounded-lg animate-pulse" />)}</div>
      )}
      {!loading && !error && containers.length === 0 && (
        <div class="text-center py-12 text-panel-muted">
          <Box size={32} class="mx-auto mb-3 opacity-30" />
          <p>No containers</p>
        </div>
      )}
      {!loading && !error && containers.length > 0 && (
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-panel-muted border-b border-panel-border">
                <th class="pb-2 pr-4 font-medium">Name</th>
                <th class="pb-2 pr-4 font-medium">Image</th>
                <th class="pb-2 pr-4 font-medium">State</th>
                <th class="pb-2 pr-4 font-medium">Ports</th>
                <th class="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-panel-border/20">
              {containers.map(c => (
                <tr key={c.ID} class="hover:bg-white/[0.02] group">
                  <td class="py-3 pr-4">
                    <div class="flex items-center gap-2">
                      <StateIcon state={c.State} />
                      <span class="text-white font-medium">{c.Names?.[0]?.replace('/', '') || c.ID?.slice(0, 12)}</span>
                    </div>
                  </td>
                  <td class="py-3 pr-4 font-mono text-xs text-panel-muted max-w-[160px] truncate">{c.Image}</td>
                  <td class="py-3 pr-4">
                    <span class={c.State === 'running' ? 'badge-success' : c.State === 'exited' ? 'badge-danger' : 'badge-muted'}>
                      {c.Status || c.State}
                    </span>
                  </td>
                  <td class="py-3 pr-4 text-xs text-panel-muted">
                    {c.Ports?.filter(p => p.PublicPort).map(p => `${p.PublicPort}→${p.PrivatePort}`).join(', ') || '—'}
                  </td>
                  <td class="py-3">
                    <div class="flex items-center gap-1">
                      {c.State === 'running' ? (
                        <button onClick={() => stop(c.ID)} class="btn-ghost px-2 py-1 text-xs" title="Stop"><Square size={11} /></button>
                      ) : (
                        <button onClick={() => start(c.ID)} class="btn-ghost px-2 py-1 text-xs text-panel-success" title="Start"><Play size={11} /></button>
                      )}
                      <button onClick={() => setLogModal(c)} class="btn-ghost px-2 py-1 text-xs" title="Logs"><Terminal size={11} /></button>
                      <button onClick={() => remove(c.ID)} class="btn-ghost px-2 py-1 text-xs text-panel-danger hover:bg-red-500/10" title="Remove"><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {logModal && <LogModal container={logModal} onClose={() => setLogModal(null)} />}
    </div>
  )
}

function ImagesTab() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pullModal, setPullModal] = useState(false)

  const load = () => {
    setLoading(true)
    api.docker.images().then(d => {
      if (d?.error) { setError(d.error); setLoading(false); return }
      setImages(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }
  useEffect(load, [])

  async function remove(id) {
    if (!confirm('Remove image?')) return
    await api.docker.removeImage(id); load()
  }

  function fmtSize(b) { return b > 1e9 ? (b / 1e9).toFixed(1) + 'GB' : (b / 1e6).toFixed(0) + 'MB' }

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-panel-muted">{images.length} image{images.length !== 1 ? 's' : ''}</span>
        <div class="flex gap-2">
          <button onClick={() => setPullModal(true)} class="btn-primary text-xs px-3 py-1.5"><Download size={12} /> Pull Image</button>
          <button onClick={load} class="btn-ghost text-xs px-3 py-1.5"><RefreshCw size={12} /></button>
        </div>
      </div>
      <ErrorBanner error={error} />
      {!loading && images.map(img => (
        <div key={img.ID} class="flex items-center gap-3 py-2.5 px-3 bg-panel-bg rounded-lg border border-panel-border/40 hover:border-panel-border/70 transition-colors">
          <div class="w-7 h-7 rounded bg-panel-border/20 flex items-center justify-center flex-shrink-0">
            <Box size={13} class="text-panel-muted" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-white font-mono truncate">{img.RepoTags?.[0] || '<none>'}</div>
            <div class="text-xs text-panel-muted">{img.ID?.slice(7, 19)} · {fmtSize(img.Size || 0)}</div>
          </div>
          <button onClick={() => remove(img.ID)} class="btn-ghost px-2 py-1 text-xs text-panel-danger hover:bg-red-500/10">
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      {!loading && images.length === 0 && !error && <div class="text-panel-muted text-center py-12">No images</div>}
      {pullModal && <PullModal onClose={() => setPullModal(false)} onDone={load} />}
    </div>
  )
}

function VolumesTab() {
  const [volumes, setVolumes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.docker.volumes().then(d => {
      if (d?.error) { setError(d.error); setLoading(false); return }
      setVolumes(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  return (
    <div class="space-y-3">
      <ErrorBanner error={error} />
      {!loading && volumes.map(v => (
        <div key={v.Name} class="flex items-center gap-3 py-2.5 px-3 bg-panel-bg rounded-lg border border-panel-border/40">
          <HardDrive size={14} class="text-panel-muted flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="text-sm text-white font-medium truncate">{v.Name}</div>
            <div class="text-xs text-panel-muted truncate">{v.Driver} · {v.Mountpoint}</div>
          </div>
        </div>
      ))}
      {!loading && volumes.length === 0 && !error && <div class="text-panel-muted text-center py-12">No volumes</div>}
    </div>
  )
}

function NetworksTab() {
  const [networks, setNetworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.docker.networks().then(d => {
      if (d?.error) { setError(d.error); setLoading(false); return }
      setNetworks(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  return (
    <div class="space-y-3">
      <ErrorBanner error={error} />
      {!loading && networks.map(n => (
        <div key={n.ID} class="flex items-center gap-3 py-2.5 px-3 bg-panel-bg rounded-lg border border-panel-border/40">
          <Network size={14} class="text-panel-muted flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="text-sm text-white font-medium">{n.Name}</div>
            <div class="text-xs text-panel-muted">{n.Driver} · {n.Scope} · {n.ID?.slice(0, 12)}</div>
          </div>
        </div>
      ))}
      {!loading && networks.length === 0 && !error && <div class="text-panel-muted text-center py-12">No networks</div>}
    </div>
  )
}

const TABS = [
  { id: 'containers', label: 'Containers', icon: Box },
  { id: 'images', label: 'Images', icon: HardDrive },
  { id: 'volumes', label: 'Volumes', icon: HardDrive },
  { id: 'networks', label: 'Networks', icon: Network },
]

export function Docker() {
  const [tab, setTab] = useState('containers')
  const [version, setVersion] = useState(null)
  const [dockerError, setDockerError] = useState(null)

  useEffect(() => {
    api.docker.version().then(d => {
      if (d?.error) setDockerError(d.error)
      else setVersion(d?.version)
    })
  }, [])

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Docker</h1>
          <p class="text-panel-muted text-sm mt-1">
            {version ? `Engine v${version}` : dockerError ? <span class="text-red-400">Not connected — {dockerError}</span> : 'Connecting…'}
          </p>
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <div class="card">
        {tab === 'containers' && <ContainersTab />}
        {tab === 'images' && <ImagesTab />}
        {tab === 'volumes' && <VolumesTab />}
        {tab === 'networks' && <NetworksTab />}
      </div>
    </div>
  )
}
