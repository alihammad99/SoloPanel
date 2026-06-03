import { useState, useEffect, useRef } from 'preact/hooks'
import { Plus, Rocket, Trash2, RefreshCw, Key, Code, Eye, Search, Lock, GitFork, Star, X, Copy, Check, ChevronDown, Globe, Terminal, Webhook } from 'lucide-preact'
import { api } from '../api/client'
import { LogViewer } from '../components/LogViewer'

function RepoPicker({ onSelect }) {
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    api.github.repos().then(d => {
      if (d?.error) { setError(d.error); setLoading(false); return }
      setRepos(d || [])
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const filtered = repos.filter(r =>
    !search || r.full_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div class="space-y-2">
      {[...Array(4)].map((_, i) => <div key={i} class="h-14 bg-panel-border/20 rounded-lg animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div class="text-center py-6">
      <p class="text-panel-danger text-sm mb-2">{error}</p>
      <p class="text-panel-muted text-xs">Try logging out and back in to refresh your GitHub token.</p>
    </div>
  )

  return (
    <div class="space-y-3">
      <div class="relative">
        <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-panel-muted" />
        <input class="input pl-9" placeholder="Search repositories…" value={search} onInput={e => setSearch(e.target.value)} />
      </div>
      <div class="max-h-72 overflow-y-auto space-y-1.5 pr-1">
        {filtered.map(repo => (
          <button
            key={repo.full_name}
            onClick={() => onSelect(repo)}
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-panel-accent/10 border border-transparent hover:border-panel-accent/20 transition-all text-left group"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-medium text-white truncate">{repo.full_name}</span>
                {repo.private && <Lock size={10} class="text-panel-muted flex-shrink-0" />}
                {repo.fork && <GitFork size={10} class="text-panel-muted flex-shrink-0" />}
              </div>
              {repo.description && <p class="text-xs text-panel-muted truncate mt-0.5">{repo.description}</p>}
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              {repo.language && <span class="text-xs text-panel-muted">{repo.language}</span>}
              {repo.stargazers_count > 0 && (
                <span class="flex items-center gap-0.5 text-xs text-panel-muted">
                  <Star size={10} />{repo.stargazers_count}
                </span>
              )}
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p class="text-panel-muted text-sm text-center py-4">No repos found</p>}
      </div>
    </div>
  )
}

function DeployKeyStep({ deployKey, keyAdded, appId, onClose }) {
  const [copied, setCopied] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryMsg, setRetryMsg] = useState(null)

  function copy() {
    navigator.clipboard.writeText(deployKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function retry() {
    setRetrying(true)
    const res = await api.post(`/apps/${appId}/add-deploy-key`, {})
    if (res?.error) {
      setRetryMsg({ ok: false, text: res.error })
    } else {
      setRetryMsg({ ok: true, text: 'Deploy key added to GitHub successfully.' })
    }
    setRetrying(false)
  }

  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-lg space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-panel-accent/10 flex items-center justify-center">
            <Key size={16} class="text-panel-accent" />
          </div>
          <div>
            <h2 class="font-semibold text-white">Deploy Key</h2>
            <p class="text-xs text-panel-muted">
              {keyAdded ? 'Auto-added to GitHub ✓' : 'May need to be added manually'}
            </p>
          </div>
        </div>

        {keyAdded && (
          <div class="p-3 rounded-lg bg-panel-success/5 border border-panel-success/20 text-sm text-panel-success">
            The deploy key was automatically added to your GitHub repo. You can deploy now.
          </div>
        )}

        {!keyAdded && (
          <>
            <ol class="text-sm text-panel-muted space-y-1.5 list-decimal list-inside">
              <li>Go to your repo → <strong class="text-panel-heading">Settings → Deploy keys</strong></li>
              <li>Click <strong class="text-panel-heading">Add deploy key</strong></li>
              <li>Paste the key below, check <strong class="text-panel-heading">Allow write access</strong> = off</li>
            </ol>
            {appId && (
              <button onClick={retry} disabled={retrying} class="btn-ghost text-xs w-full">
                <RefreshCw size={12} class={retrying ? 'animate-spin' : ''} />
                {retrying ? 'Retrying…' : 'Retry auto-add via GitHub API'}
              </button>
            )}
            {retryMsg && (
              <p class={`text-xs ${retryMsg.ok ? 'text-panel-success' : 'text-panel-danger'}`}>{retryMsg.text}</p>
            )}
          </>
        )}

        <div class="relative bg-panel-bg rounded-lg p-3 font-mono text-xs text-gray-300 break-all border border-panel-border">
          {deployKey}
          <button onClick={copy} class="absolute top-2 right-2 btn-ghost px-2 py-1 text-xs">
            {copied ? <Check size={11} class="text-panel-success" /> : <Copy size={11} />}
          </button>
        </div>
        <div class="flex justify-end">
          <button onClick={onClose} class="btn-primary">Done — App is ready</button>
        </div>
      </div>
    </div>
  )
}

function DomainPicker({ value, onChange }) {
  const [domains, setDomains] = useState([])
  const [open, setOpen] = useState(false)
  const [verify, setVerify] = useState(null)   // null | 'checking' | result object
  const [custom, setCustom] = useState(false)

  useEffect(() => {
    api.domains.list().then(d => setDomains(Array.isArray(d) ? d : []))
  }, [])

  async function checkDNS(domain) {
    if (!domain) { setVerify(null); return }
    setVerify('checking')
    const res = await api.domains.verify(domain)
    setVerify(res)
  }

  function select(domain) {
    onChange(domain)
    setOpen(false)
    checkDNS(domain)
  }

  function handleCustomInput(e) {
    onChange(e.target.value)
    setVerify(null)
  }

  const statusColor = !verify || verify === 'checking'
    ? ''
    : verify.verified ? 'border-panel-success' : 'border-yellow-500/60'

  return (
    <div class="relative">
      <label class="label">Domain <span class="text-panel-muted font-normal">(optional)</span></label>

      {/* Input + dropdown toggle */}
      <div class={`flex items-center input p-0 overflow-hidden ${statusColor}`}>
        <input
          class="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-panel-muted"
          value={value}
          onInput={handleCustomInput}
          onBlur={e => { if (e.target.value) checkDNS(e.target.value) }}
          placeholder="app.example.com"
        />
        {domains.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            class="px-2 py-2 border-l border-panel-border text-panel-muted hover:text-white transition-colors"
            title="Pick from registered domains"
          >
            <ChevronDown size={13} class={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && domains.length > 0 && (
        <div class="absolute z-20 top-full mt-1 w-full bg-panel-card border border-panel-border rounded-lg shadow-xl overflow-hidden">
          <div class="py-1 max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => select('')}
              class="w-full text-left px-3 py-2 text-xs text-panel-muted hover:bg-white/5 transition-colors"
            >
              — None (no domain) —
            </button>
            {domains.map(d => (
              <button
                key={d.ID}
                type="button"
                onClick={() => select(d.Domain)}
                class={`w-full text-left px-3 py-2 text-sm hover:bg-panel-accent/10 transition-colors flex items-center justify-between ${value === d.Domain ? 'text-panel-accent' : 'text-white'
                  }`}
              >
                <span>{d.Domain}</span>
                <span class={`text-xs ${d.SSLStatus === 'active' ? 'text-panel-success' : 'text-panel-muted'}`}>
                  {d.SSLStatus}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DNS status */}
      {verify === 'checking' && (
        <p class="text-xs text-panel-muted mt-1.5 flex items-center gap-1">
          <span class="inline-block w-2 h-2 rounded-full bg-panel-muted animate-pulse" /> Checking DNS…
        </p>
      )}
      {verify && verify !== 'checking' && (
        <p class={`text-xs mt-1.5 ${verify.verified ? 'text-panel-success' : 'text-yellow-400'}`}>
          {verify.message}
        </p>
      )}
      {value && !verify && (
        <button type="button" onClick={() => checkDNS(value)} class="text-xs text-panel-accent hover:underline mt-1.5 block">
          Verify DNS →
        </button>
      )}
    </div>
  )
}

function NewAppModal({ onClose, onCreated }) {
  const [step, setStep] = useState('pick') // pick | configure
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [form, setForm] = useState({ name: '', repo_url: '', branch: 'main', port: 3000, domain: '', env_vars: '' })
  const [loading, setLoading] = useState(false)
  const [deployKey, setDeployKey] = useState(null)
  const [keyAdded, setKeyAdded] = useState(false)
  const [createdAppId, setCreatedAppId] = useState(null)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  function selectRepo(repo) {
    setSelectedRepo(repo)
    setForm(f => ({
      ...f,
      repo_url: repo.ssh_url,
      name: repo.full_name.split('/')[1].toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    }))
    setStep('configure')
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const res = await api.apps.create({ ...form, port: Number(form.port) })
    setLoading(false)
    if (res?.app) {
      onCreated(res.app)
      setKeyAdded(res.key_added || false)
      setCreatedAppId(res.app.ID)
      if (res.deploy_key) setDeployKey(res.deploy_key)
      else onClose()
    }
  }

  if (deployKey) return <DeployKeyStep deployKey={deployKey} keyAdded={keyAdded} appId={createdAppId} onClose={onClose} />

  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-xl">
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-3">
            {step === 'configure' && (
              <button onClick={() => setStep('pick')} class="text-panel-muted hover:text-white transition-colors">
                ←
              </button>
            )}
            <h2 class="text-lg font-semibold text-white">
              {step === 'pick' ? 'Select Repository' : `Configure ${selectedRepo?.full_name.split('/')[1]}`}
            </h2>
          </div>
          <button onClick={onClose} class="text-panel-muted hover:text-white text-xl leading-none"><X size={18} /></button>
        </div>

        {step === 'pick' && (
          <>
            <div class="flex items-center gap-2 mb-4 p-3 rounded-lg bg-panel-bg border border-panel-border">
              <span class="text-xs text-panel-muted">Or paste a URL manually:</span>
              <input
                class="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-panel-muted"
                placeholder="git@github.com:user/repo.git"
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.target.value) {
                    const parts = e.target.value.split('/')
                    selectRepo({ ssh_url: e.target.value, full_name: parts.slice(-2).join('/').replace('.git', '') || 'my-app' })
                  }
                }}
              />
            </div>
            <RepoPicker onSelect={selectRepo} />
          </>
        )}

        {step === 'configure' && (
          <form onSubmit={submit} class="space-y-4">
            <div class="flex items-center gap-2 p-2.5 rounded-lg bg-panel-accent/5 border border-panel-accent/10 text-sm">
              <Rocket size={13} class="text-panel-accent" />
              <span class="text-panel-muted">{selectedRepo?.full_name}</span>
              <span class="font-mono text-xs text-panel-muted ml-auto truncate">{form.repo_url}</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">App Name</label>
                <input class="input" value={form.name} onInput={set('name')} placeholder="my-app" required />
              </div>
              <div>
                <label class="label">Branch</label>
                <input class="input" value={form.branch} onInput={set('branch')} placeholder="main" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">Port</label>
                <input class="input" type="number" value={form.port} onInput={set('port')} />
              </div>
              <div class="col-span-1">
                <DomainPicker
                  value={form.domain}
                  onChange={v => setForm(f => ({ ...f, domain: v }))}
                />
              </div>
            </div>
            <div>
              <label class="label">Environment Variables</label>
              <textarea class="input h-24 resize-none font-mono text-xs" value={form.env_vars} onInput={set('env_vars')} placeholder={"KEY=value\nSECRET=abc"} />
            </div>
            <div class="flex gap-3 justify-end pt-1">
              <button type="button" onClick={onClose} class="btn-ghost">Cancel</button>
              <button type="submit" class="btn-primary" disabled={loading}>
                {loading ? 'Creating…' : 'Create & Get Deploy Key'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function AppCard({ app, onDeploy, onDelete }) {
  const [deploying, setDeploying] = useState(false)
  const [deployID, setDeployID] = useState(null)
  const [showLogs, setShowLogs] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [showWebhook, setShowWebhook] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  const webhookURL = `${window.location.origin}/api/webhook/github`

  function copyWebhook() {
    navigator.clipboard.writeText(webhookURL)
    setCopiedWebhook(true)
    setTimeout(() => setCopiedWebhook(false), 2000)
  }

  const statusColor = {
    running: 'badge-success', idle: 'badge-muted',
    failed: 'badge-danger', building: 'badge-warning',
  }[app.Status] || 'badge-muted'

  async function deploy() {
    setDeploying(true)
    const res = await api.apps.deploy(app.ID)
    if (res?.deployment_id) {
      setDeployID(res.deployment_id)
      setShowLogs(true)
    }
    setDeploying(false)
  }

  return (
    <div class="card space-y-4">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-panel-accent/10 flex items-center justify-center">
            <Rocket size={18} class="text-panel-accent" />
          </div>
          <div>
            <div class="font-semibold text-white">{app.Name}</div>
            <div class="text-xs text-panel-muted">{app.Domain || 'no domain'}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class={statusColor}>{app.Status || 'idle'}</span>
          {app.TechStack && <span class="badge-accent">{app.TechStack}</span>}
        </div>
      </div>

      {app.RepoURL && (
        <div class="text-xs text-panel-muted font-mono bg-panel-bg rounded px-2 py-1 truncate">
          {app.RepoURL}
        </div>
      )}

      <div class="flex items-center gap-2 flex-wrap">
        <button onClick={deploy} disabled={deploying} class="btn-primary text-xs px-3 py-1.5">
          <RefreshCw size={12} class={deploying ? 'animate-spin' : ''} />
          {deploying ? 'Deploying…' : 'Deploy'}
        </button>
        <button onClick={async () => {
          if (showLogs) { setShowLogs(false); return }
          if (deployID) { setShowLogs(true); return }
          setLoadingLogs(true)
          const deps = await api.apps.deployments(app.ID)
          setLoadingLogs(false)
          if (deps && deps.length > 0) {
            setDeployID(deps[0].ID)
            setShowLogs(true)
          }
        }} disabled={loadingLogs} class="btn-ghost text-xs px-3 py-1.5">
          <Eye size={12} class={loadingLogs ? 'animate-pulse' : ''} />
          {loadingLogs ? 'Loading…' : (showLogs ? 'Hide Logs' : 'Logs')}
        </button>
        <a href={`/apps/${app.ID}`} class="btn-ghost text-xs px-3 py-1.5">
          <Code size={12} />
          Configure
        </a>
        <button onClick={() => setShowWebhook(v => !v)} class="btn-ghost text-xs px-3 py-1.5">
          <Webhook size={12} />
          Webhook
        </button>
        <button onClick={() => onDelete(app)} class="btn-danger text-xs px-3 py-1.5 ml-auto">
          <Trash2 size={12} />
        </button>
      </div>

      {showWebhook && (
        <div class="space-y-2 pt-1 border-t border-panel-border">
          <div class="text-xs text-panel-muted font-medium">Auto-deploy on push</div>
          <div class="flex items-center gap-2">
            <div class="flex-1 text-xs font-mono bg-panel-bg border border-panel-border rounded px-2 py-1.5 truncate text-gray-300">
              {webhookURL}
            </div>
            <button onClick={copyWebhook} class="btn-ghost text-xs px-2 py-1.5 shrink-0">
              {copiedWebhook ? <Check size={12} class="text-panel-success" /> : <Copy size={12} />}
            </button>
          </div>
          <div class="text-xs text-panel-muted space-y-1">
            <div>1. Go to your repo → <span class="text-white">Settings → Webhooks → Add webhook</span></div>
            <div>2. Paste URL above, set <span class="text-white">Content type: application/json</span></div>
            <div>3. Select <span class="text-white">Just the push event</span></div>
            <div>4. Push to <span class="text-white">{app.Branch || 'main'}</span> to trigger auto-deploy</div>
          </div>
        </div>
      )}

      {showLogs && deployID && (
        <LogViewer
          path={`/apps/${app.ID}/deployments/${deployID}/log`}
          onDone={() => { }}
        />
      )}
    </div>
  )
}

export function Apps() {
  const [apps, setApps] = useState([])
  const [showNew, setShowNew] = useState(false)

  useEffect(() => { api.apps.list().then(d => setApps(d || [])) }, [])

  async function deleteApp(app) {
    if (!confirm(`Delete app "${app.Name}"?`)) return
    await api.apps.delete(app.ID)
    setApps(a => a.filter(x => x.ID !== app.ID))
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Apps</h1>
          <p class="text-panel-muted text-sm mt-1">{apps.length} app{apps.length !== 1 ? 's' : ''} deployed</p>
        </div>
        <button onClick={() => setShowNew(true)} class="btn-primary">
          <Plus size={16} />
          New App
        </button>
      </div>

      {apps.length === 0 ? (
        <div class="card text-center py-16">
          <Rocket size={40} class="text-panel-border mx-auto mb-4" />
          <div class="text-white font-medium mb-1">No apps yet</div>
          <div class="text-panel-muted text-sm mb-4">Connect a GitHub repo and deploy your first app</div>
          <button onClick={() => setShowNew(true)} class="btn-primary mx-auto">
            <Plus size={14} /> Deploy App
          </button>
        </div>
      ) : (
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {apps.map(app => (
            <AppCard key={app.ID} app={app} onDelete={deleteApp} />
          ))}
        </div>
      )}

      {showNew && (
        <NewAppModal
          onClose={() => setShowNew(false)}
          onCreated={(app) => {
            setApps(a => [...a, app])
          }}
        />
      )}
    </div>
  )
}

export function AppDetail({ id }) {
  const [app, setApp] = useState(null)
  const [env, setEnv] = useState('')
  const [deployments, setDeployments] = useState([])
  const [editEnv, setEditEnv] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deployKey, setDeployKey] = useState(null)
  const [deploying, setDeploying] = useState(false)
  const [deployID, setDeployID] = useState(null)
  const [showLogs, setShowLogs] = useState(false)

  useEffect(() => {
    if (!id) return
    api.apps.get(id).then(setApp)
    api.apps.deployments(id).then(d => setDeployments(d || []))
    api.apps.env(id).then(d => setEnv(d?.env_vars || ''))
    api.apps.deployKey(id).then(d => setDeployKey(d?.public_key || ''))
  }, [id])

  if (!app) return <div class="text-panel-muted p-8">Loading…</div>

  async function deploy() {
    setDeploying(true)
    const res = await api.apps.deploy(id)
    setDeploying(false)
    if (res?.deployment_id) {
      setDeployID(res.deployment_id)
      setShowLogs(true)
      api.apps.deployments(id).then(d => setDeployments(d || []))
    }
  }

  async function saveEnv() {
    setSaving(true)
    await api.apps.update(id, { env_vars: env })
    setSaving(false)
    setEditEnv(false)
  }

  return (
    <div class="space-y-6 max-w-3xl">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a href="/apps" class="text-panel-muted hover:text-white text-sm">← Apps</a>
          <span class="text-panel-border">/</span>
          <span class="text-white font-semibold">{app.Name}</span>
        </div>
        <button onClick={deploy} disabled={deploying} class="btn-primary text-sm">
          <RefreshCw size={14} class={deploying ? 'animate-spin' : ''} />
          {deploying ? 'Deploying…' : 'Deploy'}
        </button>
      </div>

      {showLogs && deployID && (
        <div class="card space-y-2">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-white text-sm">Live Deployment Log</h2>
            <button onClick={() => setShowLogs(false)} class="text-panel-muted hover:text-white text-xs">Hide</button>
          </div>
          <LogViewer path={`/apps/${id}/deployments/${deployID}/log`} onDone={() => api.apps.get(id).then(setApp)} />
        </div>
      )}

      <div class="card space-y-4">
        <h2 class="font-semibold text-white">Configuration</h2>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><span class="text-panel-muted">Repo:</span> <span class="text-white font-mono text-xs">{app.RepoURL || '—'}</span></div>
          <div><span class="text-panel-muted">Branch:</span> <span class="text-white">{app.Branch}</span></div>
          <div><span class="text-panel-muted">Domain:</span> <span class="text-white">{app.Domain || '—'}</span></div>
          <div><span class="text-panel-muted">Port:</span> <span class="text-white">{app.Port}</span></div>
          <div><span class="text-panel-muted">Stack:</span> <span class="text-white">{app.TechStack || 'auto-detect'}</span></div>
          <div><span class="text-panel-muted">Status:</span> <span class="text-white">{app.Status}</span></div>
        </div>
      </div>

      <div class="card space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-white">Environment Variables</h2>
          <button onClick={() => setEditEnv(v => !v)} class="btn-ghost text-xs px-3 py-1.5">
            {editEnv ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {editEnv ? (
          <>
            <textarea
              class="input h-32 resize-none font-mono text-xs"
              value={env}
              onInput={e => setEnv(e.target.value)}
              placeholder={"KEY=value\nSECRET=abc123"}
            />
            <button onClick={saveEnv} class="btn-primary text-xs" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <div class="bg-panel-bg rounded-lg p-3 font-mono text-xs text-gray-400 whitespace-pre min-h-12">
            {env || '(empty)'}
          </div>
        )}
      </div>

      {deployKey && (
        <div class="card space-y-3">
          <h2 class="font-semibold text-white flex items-center gap-2"><Key size={14} /> Deploy Key</h2>
          <p class="text-xs text-panel-muted">Add this public key as a read-only Deploy Key in your GitHub repo settings.</p>
          <div class="bg-panel-bg rounded p-3 font-mono text-xs text-gray-400 break-all border border-panel-border">
            {deployKey}
          </div>
        </div>
      )}

      <div class="card space-y-3">
        <h2 class="font-semibold text-white">Deployment History</h2>
        {deployments.length === 0 ? (
          <div class="text-panel-muted text-sm">No deployments yet</div>
        ) : (
          <div class="space-y-2">
            {deployments.map(d => (
              <div key={d.ID} class="flex items-center gap-3 py-2 px-3 rounded-lg bg-panel-bg text-sm">
                <span class={`badge ${d.Status === 'success' ? 'badge-success' : d.Status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                  {d.Status}
                </span>
                <span class="text-panel-muted text-xs">{new Date(d.CreatedAt).toLocaleString()}</span>
                {d.CommitSHA && <span class="font-mono text-xs text-panel-muted">{d.CommitSHA.slice(0, 7)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
