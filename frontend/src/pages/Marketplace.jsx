import { useState, useEffect, useMemo } from 'preact/hooks'
import { Plus, Play, Search, RefreshCw, ExternalLink, Package } from 'lucide-preact'
import { api } from '../api/client'
import { LogViewer } from '../components/LogViewer'

const TYPE_LABELS = { 1: 'Container', 2: 'Swarm Stack', 3: 'Compose' }

function DeployModal({ template, onClose }) {
  const [name, setName] = useState(template.id + '-' + Date.now().toString(36))
  const [envVals, setEnvVals] = useState(
    Object.fromEntries((template.env_vars || []).map(e => [e.key, e.default || '']))
  )
  const [stackID, setStackID] = useState(null)
  const [loading, setLoading] = useState(false)

  function setEnv(key) { return (e) => setEnvVals(v => ({ ...v, [key]: e.target.value })) }

  const envStr = Object.entries(envVals).map(([k, v]) => `${k}=${v}`).join('\n')

  async function deploy() {
    setLoading(true)
    const res = await api.stacks.create({
      name,
      template_id: template.id,
      env_vars: envStr,
    })
    if (res?.ID) {
      setStackID(res.ID)
    }
    setLoading(false)
  }

  if (stackID) {
    return (
      <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div class="card w-full max-w-2xl space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-white">{template.name} — Starting</h3>
            <button onClick={onClose} class="text-panel-muted hover:text-white text-xl">×</button>
          </div>
          <LogViewer path={`/stacks/${stackID}/start`} onDone={() => { }} />
          <button onClick={onClose} class="btn-ghost text-xs">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-lg space-y-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            {template.icon && (
              <img src={template.icon} alt="" class="w-8 h-8 rounded" onError={e => e.target.style.display = 'none'} />
            )}
            <div>
              <h3 class="font-semibold text-white">{template.name}</h3>
              <p class="text-xs text-panel-muted">{template.description}</p>
            </div>
          </div>
          <button onClick={onClose} class="text-panel-muted hover:text-white text-xl">×</button>
        </div>

        <div>
          <label class="label">Stack Name</label>
          <input class="input" value={name} onInput={e => setName(e.target.value)} />
        </div>

        {template.env_vars?.length > 0 && (
          <div class="space-y-3">
            <div class="text-sm font-medium text-white">Environment Variables</div>
            {template.env_vars.map(ev => (
              <div key={ev.key}>
                <label class="label">
                  {ev.key} {ev.required && <span class="text-panel-danger">*</span>}
                </label>
                <input
                  class="input"
                  value={envVals[ev.key] || ''}
                  onInput={setEnv(ev.key)}
                  placeholder={ev.description}
                  type={ev.key.toLowerCase().includes('password') || ev.key.toLowerCase().includes('secret') ? 'password' : 'text'}
                />
                {ev.description && <p class="text-xs text-panel-muted mt-1">{ev.description}</p>}
              </div>
            ))}
          </div>
        )}

        <div class="flex gap-3 justify-end">
          <button onClick={onClose} class="btn-ghost">Cancel</button>
          <button onClick={deploy} disabled={loading} class="btn-primary">
            <Play size={14} />
            {loading ? 'Deploying…' : 'Deploy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ template, onDeploy }) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <div class="card flex flex-col gap-3 hover:border-panel-accent/30 transition-colors">
      <div class="flex items-start gap-3">
        {template.icon && !imgErr ? (
          <img src={template.icon} alt="" class="w-9 h-9 rounded-lg flex-shrink-0 object-contain bg-white/5 p-0.5"
            onError={() => setImgErr(true)} />
        ) : (
          <div class="w-9 h-9 rounded-lg bg-panel-accent/10 flex items-center justify-center text-panel-accent font-bold flex-shrink-0">
            {template.name[0]}
          </div>
        )}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-semibold text-white text-sm truncate">{template.name}</span>
            {template.type && (
              <span class="badge-muted text-[10px] flex-shrink-0">{TYPE_LABELS[template.type] || 'App'}</span>
            )}
          </div>
          <div class="text-xs text-panel-muted mt-0.5 line-clamp-2 leading-relaxed">{template.description}</div>
        </div>
      </div>

      {template.ports?.length > 0 && (
        <div class="flex flex-wrap gap-1">
          {template.ports.slice(0, 4).map(p => (
            <span key={p} class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-panel-bg border border-panel-border/50 text-panel-muted">:{p}</span>
          ))}
        </div>
      )}

      <div class="flex flex-wrap gap-1">
        {template.tags?.slice(0, 3).map(tag => (
          <span key={tag} class="badge-muted text-[10px]">{tag}</span>
        ))}
      </div>

      <div class="flex gap-2 mt-auto pt-1">
        <button onClick={() => onDeploy(template)} class="btn-primary flex-1 justify-center text-xs py-1.5">
          <Plus size={12} /> Deploy
        </button>
        {template.website && (
          <a href={template.website} target="_blank" rel="noreferrer"
            class="btn-ghost px-2 py-1.5 text-xs" title="Website">
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div class="card space-y-3 animate-pulse">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-lg bg-panel-border/20 flex-shrink-0" />
        <div class="flex-1 space-y-2">
          <div class="h-3.5 bg-panel-border/20 rounded w-2/3" />
          <div class="h-2.5 bg-panel-border/20 rounded w-full" />
          <div class="h-2.5 bg-panel-border/20 rounded w-4/5" />
        </div>
      </div>
      <div class="h-7 bg-panel-border/20 rounded" />
    </div>
  )
}

export function Marketplace() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [deploying, setDeploying] = useState(null)

  async function load(refresh = false) {
    setLoading(true); setError(null)
    if (refresh) await api.post('/marketplace/refresh', {})
    const d = await api.marketplace.list()
    if (d?.error) { setError(d.error); setLoading(false); return }
    setTemplates(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category).filter(Boolean))
    return ['all', ...Array.from(cats).sort()]
  }, [templates])

  const filtered = useMemo(() => templates.filter(t => {
    const matchCat = category === 'all' || t.category === category
    const matchSearch = !search || (t.name + ' ' + (t.description || '') + ' ' + (t.tags || []).join(' '))
      .toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  }), [templates, category, search])

  return (
    <div class="space-y-6">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Marketplace</h1>
          <p class="text-panel-muted text-sm mt-1">
            {loading ? 'Loading from Portainer Community Registry…'
              : error ? 'Failed to load'
                : `${templates.length} apps available`}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={loading} class="btn-ghost text-xs px-3 py-1.5">
          <RefreshCw size={12} class={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div class="p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-sm text-red-400">{error}</div>
      )}

      <div class="flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
          <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-panel-muted" />
          <input class="input pl-9" placeholder="Search apps…" value={search} onInput={e => setSearch(e.target.value)} />
        </div>
        <div class="flex gap-1.5 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${category === c ? 'bg-panel-accent text-white' : 'bg-panel-card border border-panel-border text-panel-muted hover:text-white'
                }`}>{c}</button>
          ))}
        </div>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading
          ? [...Array(12)].map((_, i) => <SkeletonCard key={i} />)
          : filtered.map(t => <TemplateCard key={t.id} template={t} onDeploy={setDeploying} />)
        }
        {!loading && filtered.length === 0 && !error && (
          <div class="col-span-full text-center py-16 text-panel-muted">
            <Package size={32} class="mx-auto mb-3 opacity-30" />
            <p>No templates match your search</p>
          </div>
        )}
      </div>

      {deploying && <DeployModal template={deploying} onClose={() => setDeploying(null)} />}
    </div>
  )
}
