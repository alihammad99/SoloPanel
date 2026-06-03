import { useState, useEffect, useRef } from 'preact/hooks'
import { Plus, Rocket, Trash2, RefreshCw, Key, Code, Eye, Search, Lock, GitFork, Star, X, Copy, Check, ChevronDown, Globe, Terminal, Webhook, RotateCcw, Square, ExternalLink } from 'lucide-preact'
import { api } from '../api/client'
import { serverInfo } from '../api/serverInfo'
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
          <button onClick={() => { api.apps.deploy(appId); onClose() }} class="btn-primary">Done — Deploy now</button>
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

function BranchPicker({ repo, value, onChange }) {
  const [branches, setBranches] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!repo?.full_name) return
    const [owner, name] = repo.full_name.split('/')
    if (!owner || !name) return
    setLoading(true)
    api.github.branches(owner, name).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        const priority = ['main', 'master']
        const sorted = [...data].sort((a, b) => {
          const ai = priority.indexOf(a), bi = priority.indexOf(b)
          if (ai !== -1 && bi !== -1) return ai - bi
          if (ai !== -1) return -1
          if (bi !== -1) return 1
          return a.localeCompare(b)
        })
        setBranches(sorted)
        onChange(sorted[0])
      }
      setLoading(false)
    })
  }, [repo?.full_name])
  return (
    <div class="relative">
      <label class="label">Branch</label>
      <div class="flex items-center input p-0 overflow-hidden cursor-pointer" onClick={() => branches.length > 0 && setOpen(o => !o)}>
        <span class="flex-1 px-3 py-2 text-sm text-white truncate">{value || 'main'}</span>
        {loading
          ? <span class="px-2 text-xs text-panel-muted animate-pulse">…</span>
          : <ChevronDown size={13} class={`mr-2 text-panel-muted transition-transform ${open ? 'rotate-180' : ''}`} />}
      </div>
      {open && branches.length > 0 && (
        <div class="absolute z-20 top-full mt-1 w-full bg-panel-card border border-panel-border rounded-lg shadow-xl overflow-hidden">
          <div class="py-1 max-h-48 overflow-y-auto">
            {branches.map(b => (
              <button key={b} type="button" onClick={() => { onChange(b); setOpen(false) }}
                class={`w-full text-left px-3 py-2 text-sm hover:bg-panel-accent/10 transition-colors ${value === b ? 'text-panel-accent font-medium' : 'text-white'}`}>
                {b}
              </button>
            ))}
          </div>
        </div>
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
      else { api.apps.deploy(res.app.ID); onClose() }
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
              <BranchPicker
                repo={selectedRepo}
                value={form.branch}
                onChange={v => setForm(f => ({ ...f, branch: v }))}
              />
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

const STACK_META = {
  react: { color: '#61dafb', label: 'React' },
  next: { color: '#e8eaf2', label: 'Next.js' },
  nextjs: { color: '#e8eaf2', label: 'Next.js' },
  nuxt: { color: '#00dc82', label: 'Nuxt' },
  vue: { color: '#42b883', label: 'Vue' },
  svelte: { color: '#ff3e00', label: 'Svelte' },
  angular: { color: '#dd0031', label: 'Angular' },
  vite: { color: '#bd34fe', label: 'Vite' },
  remix: { color: '#e8eaf2', label: 'Remix' },
  astro: { color: '#ff5d01', label: 'Astro' },
  node: { color: '#84cc16', label: 'Node.js' },
  nodejs: { color: '#84cc16', label: 'Node.js' },
  python: { color: '#3b82f6', label: 'Python' },
  django: { color: '#44b78b', label: 'Django' },
  fastapi: { color: '#009688', label: 'FastAPI' },
  flask: { color: '#e8eaf2', label: 'Flask' },
  go: { color: '#06b6d4', label: 'Go' },
  rust: { color: '#fb923c', label: 'Rust' },
  php: { color: '#a78bfa', label: 'PHP' },
  ruby: { color: '#f43f5e', label: 'Ruby' },
  rails: { color: '#cc0000', label: 'Rails' },
  java: { color: '#f59e0b', label: 'Java' },
  docker: { color: '#38bdf8', label: 'Docker' },
  bun: { color: '#f5deb3', label: 'Bun' },
  npm: { color: '#cb3837', label: 'npm' },
  pnpm: { color: '#f69220', label: 'pnpm' },
  yarn: { color: '#2c8ebb', label: 'Yarn' },
  pip: { color: '#3b82f6', label: 'pip' },
  cargo: { color: '#fb923c', label: 'Cargo' },
  bundler: { color: '#f43f5e', label: 'Bundler' },
  static: { color: '#94a3b8', label: 'Static' },
}

const STATUS_META = {
  running: { color: '#34d399', label: 'Running', pulse: true },
  building: { color: '#fbbf24', label: 'Building', pulse: true },
  failed: { color: '#fb7185', label: 'Failed', pulse: false },
  idle: { color: '#4b5268', label: 'Idle', pulse: false },
}

function AppRow({ app, onDelete }) {
  const [open, setOpen] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployID, setDeployID] = useState(null)
  const [showLogs, setShowLogs] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [showWebhook, setShowWebhook] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  const webhookURL = `${window.location.origin}/api/webhook/github`
  const stackKey = app.TechStack?.toLowerCase()
  const stack = STACK_META[stackKey] || { color: '#3b82f6', label: app.TechStack || '—' }
  const toolKey = app.Tool?.toLowerCase()
  const tool = toolKey ? (STACK_META[toolKey] || { color: '#6b7280', label: app.Tool }) : null
  const previewURL = app.Status === 'running'
    ? (app.Domain ? `https://${app.Domain}` : (app.preview_url || null))
    : null
  const status = STATUS_META[app.Status] || STATUS_META.idle
  const repoShort = app.RepoURL
    ?.replace('https://github.com/', '')
    ?.replace('git@github.com:', '')
    ?.replace(/\.git$/, '')

  function copyWebhook() {
    navigator.clipboard.writeText(webhookURL)
    setCopiedWebhook(true)
    setTimeout(() => setCopiedWebhook(false), 2000)
  }

  async function deploy(e) {
    e.stopPropagation()
    setDeploying(true)
    const res = await api.apps.deploy(app.ID)
    if (res?.deployment_id) { setDeployID(res.deployment_id); setShowLogs(true); setOpen(true) }
    setDeploying(false)
  }

  async function toggleLogs(e) {
    e.stopPropagation()
    if (showLogs) { setShowLogs(false); return }
    if (deployID) { setShowLogs(true); return }
    setLoadingLogs(true)
    const deps = await api.apps.deployments(app.ID)
    setLoadingLogs(false)
    if (deps?.length > 0) { setDeployID(deps[0].ID); setShowLogs(true) }
  }

  return (
    <div class="group"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

      {/* ── Main row — same grid as header ── */}
      <div
        class="grid items-center px-4 py-3.5 cursor-pointer transition-colors duration-100"
        style={{
          background: open ? 'rgba(59,130,246,0.03)' : 'transparent',
          gridTemplateColumns: '16px 1fr 72px 72px 1.2fr 80px 160px 70px auto',
          gap: '0 12px',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.015)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = open ? 'rgba(59,130,246,0.03)' : 'transparent' }}
        onClick={() => setOpen(v => !v)}
      >
        {/* Status dot */}
        <div class="relative flex items-center justify-center shrink-0">
          <span class="w-2 h-2 rounded-full block"
            style={{
              background: status.color,
              boxShadow: status.pulse ? `0 0 6px ${status.color}80` : 'none',
            }} />
          {status.pulse && (
            <span class="absolute inset-0 rounded-full animate-ping opacity-40"
              style={{ background: status.color }} />
          )}
        </div>

        {/* Name */}
        <span class="text-[13px] font-semibold text-white truncate">{app.Name}</span>

        {/* Stack chip */}
        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate block"
          style={{ background: `${stack.color}12`, color: stack.color, border: `1px solid ${stack.color}20` }}>
          {stack.label}
        </span>

        {/* Tool chip */}
        {tool
          ? <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate block"
            style={{ background: `${tool.color}12`, color: tool.color, border: `1px solid ${tool.color}20` }}>
            {tool.label}
          </span>
          : <span />}

        {/* Repo */}
        <span class="text-[12px] font-mono truncate" style={{ color: '#4b5268' }}>
          {repoShort || '—'}
        </span>

        {/* Branch */}
        <span class="text-[11px] px-2 py-0.5 rounded-md block truncate"
          style={{ background: 'rgba(59,130,246,0.06)', color: app.Branch ? '#3b82f6' : '#2e3148', border: '1px solid rgba(59,130,246,0.1)' }}>
          {app.Branch || '—'}
        </span>

        {/* Domain */}
        <span class="text-[11px] truncate flex items-center gap-1" style={{ color: app.Domain ? '#4b5268' : '#2e3148' }}>
          {app.Domain ? <><Globe size={10} style={{ flexShrink: 0 }} />{app.Domain}</> : '—'}
        </span>

        {/* Status */}
        <span class="text-[11px] font-medium" style={{ color: status.color }}>
          {status.label}
        </span>

        {/* Actions */}
        <div class="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={deploy} disabled={deploying}
            class="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all"
            style={{
              background: deploying ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
              color: '#3b82f6',
              border: '1px solid rgba(59,130,246,0.15)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = deploying ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)'}>
            <RefreshCw size={10} class={deploying ? 'animate-spin' : ''} />
            {deploying ? '…' : 'Deploy'}
          </button>

          {/* Preview */}
          {previewURL && (
            <a
              href={previewURL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              class="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all"
              style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)', textDecoration: 'none' }}
              title={previewURL}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(52,211,153,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(52,211,153,0.08)'}>
              <ExternalLink size={10} />
              Preview
            </a>
          )}

          <a href={`/apps/${app.ID}`}
            class="p-1.5 rounded-lg transition-colors"
            style={{ color: '#4b5268' }}
            title="Configure"
            onMouseEnter={e => { e.currentTarget.style.color = '#e8eaf2'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4b5268'; e.currentTarget.style.background = 'transparent' }}>
            <Code size={13} />
          </a>

          <button onClick={e => { e.stopPropagation(); onDelete(app) }}
            class="p-1.5 rounded-lg transition-all"
            style={{ color: '#4b5268' }}
            title="Delete"
            onMouseEnter={e => { e.currentTarget.style.color = '#fb7185'; e.currentTarget.style.background = 'rgba(251,113,133,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4b5268'; e.currentTarget.style.background = 'transparent' }}>
            <Trash2 size={13} />
          </button>

          <ChevronDown size={13} class="transition-transform duration-200 ml-auto"
            style={{ color: '#2e3148', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {open && (
        <div class="px-4 pb-4 space-y-3"
          style={{ background: 'rgba(59,130,246,0.02)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>

          {/* Sub-action row */}
          <div class="flex items-center gap-2 pt-3">
            <button onClick={toggleLogs} disabled={loadingLogs}
              class="btn-ghost text-xs px-3 py-1.5 gap-1.5">
              <Terminal size={11} class={loadingLogs ? 'animate-pulse' : ''} />
              {showLogs ? 'Hide Logs' : 'View Logs'}
            </button>
            <button onClick={e => { e.stopPropagation(); setShowWebhook(v => !v) }}
              class="btn-ghost text-xs px-3 py-1.5 gap-1.5"
              style={showWebhook ? { color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)' } : {}}>
              <Webhook size={11} />
              Webhook
            </button>
            <span class="flex-1" />
            <span class="text-[11px] font-mono" style={{ color: '#2e3148' }}>
              {repoShort}{app.Branch ? ` · ${app.Branch}` : ''}
            </span>
          </div>

          {/* Webhook panel */}
          {showWebhook && (
            <div class="rounded-xl p-3 space-y-2"
              style={{ background: '#080a10', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div class="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#4b5268' }}>Auto-deploy on git push</div>
              <div class="flex items-center gap-2">
                <span class="flex-1 text-[11px] font-mono truncate" style={{ color: '#6b7280' }}>{webhookURL}</span>
                <button onClick={copyWebhook} class="btn-ghost text-xs p-1.5 shrink-0">
                  {copiedWebhook ? <Check size={11} class="text-panel-success" /> : <Copy size={11} />}
                </button>
              </div>
              <div class="text-[11px] space-y-0.5" style={{ color: '#4b5268' }}>
                <div>Repo → <span class="text-white">Settings → Webhooks</span> → paste URL → push event → push to <span style={{ color: stack.color }}>{app.Branch || 'main'}</span></div>
              </div>
            </div>
          )}

          {/* Log viewer */}
          {showLogs && deployID && (
            <LogViewer path={`/apps/${app.ID}/deployments/${deployID}/log`} onDone={() => { }} />
          )}
        </div>
      )}
    </div>
  )
}

export function Apps() {
  const [apps, setApps] = useState([])
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    api.apps.list().then(d => setApps(d || []))
    const iv = setInterval(() => {
      api.apps.list().then(d => { if (d) setApps(d) })
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  async function deleteApp(app) {
    if (!confirm(`Delete "${app.Name}"?`)) return
    await api.apps.delete(app.ID)
    setApps(a => a.filter(x => x.ID !== app.ID))
  }

  const running = apps.filter(a => a.Status === 'running').length
  const building = apps.filter(a => a.Status === 'building').length
  const failed = apps.filter(a => a.Status === 'failed').length

  return (
    <div class="space-y-5">

      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-[22px] font-bold text-white tracking-tight">Apps</h1>
          <div class="flex items-center gap-3 mt-1">
            <span class="text-[13px]" style={{ color: '#4b5268' }}>{apps.length} total</span>
            {running > 0 && <span class="text-[12px] flex items-center gap-1.5" style={{ color: '#34d399' }}><span class="w-1.5 h-1.5 rounded-full bg-panel-success animate-pulse" />{running} running</span>}
            {building > 0 && <span class="text-[12px] flex items-center gap-1.5" style={{ color: '#fbbf24' }}><span class="w-1.5 h-1.5 rounded-full" style={{ background: '#fbbf24' }} />{building} building</span>}
            {failed > 0 && <span class="text-[12px] flex items-center gap-1.5" style={{ color: '#fb7185' }}><span class="w-1.5 h-1.5 rounded-full bg-panel-danger" />{failed} failed</span>}
          </div>
        </div>
        <button onClick={() => setShowNew(true)} class="btn-primary gap-2">
          <Plus size={14} /> New App
        </button>
      </div>

      {apps.length === 0 ? (
        <div class="rounded-2xl py-20 text-center"
          style={{ background: '#0f1119', border: '1px dashed rgba(59,130,246,0.12)' }}>
          <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-5"
            style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.1)' }}>
            <Rocket size={24} style={{ color: '#3b82f6', opacity: 0.7 }} />
          </div>
          <div class="text-[15px] font-semibold text-white mb-1.5">No apps yet</div>
          <div class="text-[13px] mb-6" style={{ color: '#4b5268' }}>Connect a GitHub repo and deploy in seconds</div>
          <button onClick={() => setShowNew(true)} class="btn-primary mx-auto gap-2">
            <Plus size={13} /> Deploy first app
          </button>
        </div>
      ) : (
        <div class="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.06)', background: '#0f1119' }}>

          {/* Table header */}
          <div class="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.01)',
              color: '#4b5268',
              gridTemplateColumns: '16px 1fr 72px 72px 1.2fr 80px 160px 70px auto',
              gap: '0 12px',
            }}>
            <span />
            <span>Name</span>
            <span>Stack</span>
            <span>Tool</span>
            <span>Repository</span>
            <span>Branch</span>
            <span>Domain</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {apps.map(app => (
            <AppRow key={app.ID} app={app} onDelete={deleteApp} />
          ))}
        </div>
      )}

      {showNew && (
        <NewAppModal
          onClose={() => setShowNew(false)}
          onCreated={app => setApps(a => [...a, app])}
        />
      )}
    </div>
  )
}

// ── Phase timeline ─────────────────────────────────────────────────────────────

const PHASE_ICONS = {
  clone: '⬇',
  install: '📦',
  build: '🔨',
  start: '🚀',
}

function PhaseStep({ phase }) {
  const isRunning = phase.status === 'running'
  const isSuccess = phase.status === 'success'
  const isFailed = phase.status === 'failed'
  const isSkipped = phase.status === 'skipped'

  const dot = isRunning ? 'bg-yellow-400 animate-pulse' :
    isSuccess ? 'bg-panel-success' :
      isFailed ? 'bg-panel-danger' :
        isSkipped ? 'bg-panel-border' :
          'bg-panel-border/40'

  const label = isRunning ? 'text-yellow-300' :
    isSuccess ? 'text-panel-success' :
      isFailed ? 'text-panel-danger' :
        isSkipped ? 'text-panel-muted line-through' :
          'text-panel-muted'

  return (
    <div class="flex items-center gap-3 py-2">
      <span class={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
      <span class="text-sm">{PHASE_ICONS[phase.name] || '•'}</span>
      <span class={`text-sm font-medium capitalize flex-1 ${label}`}>{phase.name}</span>
      {isRunning && <span class="text-xs text-yellow-400 animate-pulse">running…</span>}
      {phase.duration_ms > 0 && !isRunning && (
        <span class="text-xs text-panel-muted font-mono">
          {phase.duration_ms < 1000 ? `${phase.duration_ms}ms` : `${(phase.duration_ms / 1000).toFixed(1)}s`}
        </span>
      )}
      {isSkipped && <span class="text-xs text-panel-border">skipped</span>}
    </div>
  )
}

function DeploymentRow({ dep, onViewLogs, onRollback, isLatest }) {
  const phases = (() => { try { return JSON.parse(dep.Phases || '[]') } catch { return [] } })()
  const isActive = dep.Status === 'building'
  const statusBadge = {
    success: 'badge-success',
    failed: 'badge-danger',
    building: 'badge-warning',
    queued: 'badge-muted',
  }[dep.Status] || 'badge-muted'

  return (
    <div class={`rounded-xl border p-4 space-y-3 transition-all ${isActive ? 'border-yellow-500/40 bg-yellow-500/3' : 'border-panel-border bg-panel-bg/50'}`}>
      {/* Header row */}
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class={statusBadge}>{dep.Status}</span>
            {dep.CommitSHA && (
              <span class="font-mono text-xs text-panel-accent bg-panel-accent/10 px-1.5 py-0.5 rounded">
                {dep.CommitSHA}
              </span>
            )}
            {dep.Branch && (
              <span class="text-xs text-panel-muted bg-panel-border/30 px-1.5 py-0.5 rounded font-mono">
                {dep.Branch}
              </span>
            )}
            {isLatest && dep.Status === 'success' && (
              <span class="text-xs text-panel-success bg-panel-success/10 px-1.5 py-0.5 rounded">current</span>
            )}
          </div>
          {dep.CommitMessage && (
            <p class="text-sm text-white mt-1 truncate">{dep.CommitMessage}</p>
          )}
          <div class="flex items-center gap-3 mt-1 text-xs text-panel-muted">
            {dep.CommitAuthor && <span>{dep.CommitAuthor}</span>}
            <span>{new Date(dep.CreatedAt).toLocaleString()}</span>
            {dep.Duration > 0 && <span>{dep.Duration}s total</span>}
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => onViewLogs(dep)} class="btn-ghost text-xs px-2 py-1">
            <Terminal size={11} /> Logs
          </button>
          {dep.Status === 'success' && !isLatest && (
            <button onClick={() => onRollback(dep)} class="btn-ghost text-xs px-2 py-1 text-yellow-400 hover:text-yellow-300">
              <RotateCcw size={11} /> Rollback
            </button>
          )}
        </div>
      </div>

      {/* Phase steps */}
      {phases.length > 0 && (
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1 pt-1 border-t border-panel-border/40">
          {phases.map(p => <PhaseStep key={p.name} phase={p} />)}
        </div>
      )}
    </div>
  )
}

// ── AppDetail ──────────────────────────────────────────────────────────────────

export function AppDetail({ id }) {
  const [app, setApp] = useState(null)
  const [env, setEnv] = useState('')
  const [deployments, setDeployments] = useState([])
  const [editEnv, setEditEnv] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deployKey, setDeployKey] = useState(null)
  const [deploying, setDeploying] = useState(false)
  const [logDep, setLogDep] = useState(null)       // deployment whose logs are shown
  const [rollbackDep, setRollbackDep] = useState(null)
  const pollRef = useRef(null)

  function loadAll() {
    api.apps.get(id).then(setApp)
    api.apps.deployments(id).then(d => setDeployments(d || []))
  }

  useEffect(() => {
    if (!id) return
    loadAll()
    api.apps.env(id).then(d => setEnv(d?.env_vars || ''))
    api.apps.deployKey(id).then(d => setDeployKey(d?.public_key || ''))
  }, [id])

  // Poll deployments while one is active
  useEffect(() => {
    const hasActive = deployments.some(d => d.Status === 'building' || d.Status === 'queued')
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(() => {
        api.apps.deployments(id).then(d => setDeployments(d || []))
        api.apps.get(id).then(setApp)
      }, 2000)
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { }
  }, [deployments])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  if (!app) return <div class="text-panel-muted p-8">Loading…</div>

  const isBuilding = app.Status === 'building'

  async function deploy() {
    setDeploying(true)
    const res = await api.apps.deploy(id)
    setDeploying(false)
    if (res?.deployment_id) {
      setLogDep({ ID: res.deployment_id, Status: 'building' })
      api.apps.deployments(id).then(d => setDeployments(d || []))
    }
  }

  async function cancel() {
    await api.apps.cancel(id)
  }

  async function stop() {
    await api.apps.stop(id)
    api.apps.get(id).then(setApp)
  }

  async function saveEnv() {
    setSaving(true)
    await api.apps.update(id, { env_vars: env })
    setSaving(false)
    setEditEnv(false)
  }

  const statusColor = {
    running: 'text-panel-success',
    building: 'text-yellow-400',
    failed: 'text-panel-danger',
    idle: 'text-panel-muted',
  }[app.Status] || 'text-panel-muted'

  const statusDot = {
    running: 'bg-panel-success animate-pulse',
    building: 'bg-yellow-400 animate-pulse',
    failed: 'bg-panel-danger',
    idle: 'bg-panel-muted/40',
  }[app.Status] || 'bg-panel-muted/40'

  return (
    <div class="space-y-6 max-w-4xl">

      {/* ── Header ── */}
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <a href="/apps" class="text-panel-muted hover:text-white text-sm transition-colors">← Apps</a>
          <span class="text-panel-border">/</span>
          <div class="flex items-center gap-2">
            <span class={`w-2 h-2 rounded-full ${statusDot}`} />
            <span class="text-white font-semibold text-lg">{app.Name}</span>
            <span class={`text-xs font-medium ${statusColor}`}>{app.Status}</span>
            {app.Pid > 0 && <span class="text-xs text-panel-muted font-mono">PID {app.Pid}</span>}
          </div>
        </div>
        <div class="flex items-center gap-2">
          {isBuilding ? (
            <button onClick={cancel} class="btn-ghost text-xs text-panel-danger hover:text-red-400">
              <X size={12} /> Cancel
            </button>
          ) : (
            <>
              {app.Status === 'running' && (
                <button onClick={stop} class="btn-ghost text-xs">
                  <Square size={12} /> Stop
                </button>
              )}
              <button onClick={deploy} disabled={deploying} class="btn-primary text-sm">
                <RefreshCw size={14} class={deploying ? 'animate-spin' : ''} />
                {deploying ? 'Starting…' : 'Deploy'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Live log panel (for current deploy) ── */}
      {logDep && (
        <div class="card space-y-2 border border-panel-accent/20">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal size={14} class="text-panel-accent" /> Live Deployment Log
            </span>
            <button onClick={() => setLogDep(null)} class="text-panel-muted hover:text-white text-xs">Hide</button>
          </div>
          <LogViewer
            path={`/apps/${id}/deployments/${logDep.ID}/log`}
            onDone={() => { loadAll(); }}
          />
        </div>
      )}

      {/* ── Rollback streaming panel ── */}
      {rollbackDep && (
        <div class="card space-y-2 border border-yellow-500/30">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-white flex items-center gap-2">
              <RotateCcw size={14} class="text-yellow-400" /> Rolling back…
            </span>
            <button onClick={() => setRollbackDep(null)} class="text-panel-muted hover:text-white text-xs">Close</button>
          </div>
          <LogViewer path={api.apps.rollbackPath(id)} onDone={() => { setRollbackDep(null); loadAll() }} />
        </div>
      )}

      <div class="grid lg:grid-cols-3 gap-6">

        {/* ── Left col: config + env + key ── */}
        <div class="lg:col-span-1 space-y-4">

          {/* Config */}
          <div class="card space-y-3">
            <h2 class="font-semibold text-white text-sm">Configuration</h2>
            <dl class="space-y-2 text-sm">
              {[
                ['Repo', app.RepoURL && <span class="font-mono text-xs break-all">{app.RepoURL}</span>],
                ['Branch', app.Branch],
                ['Stack', app.TechStack || <span class="text-panel-muted">auto-detect</span>],
                ['Port', app.Port || '—'],
                ['Domain', app.Domain || '—'],
              ].map(([k, v]) => (
                <div key={k} class="flex gap-2">
                  <dt class="text-panel-muted w-14 flex-shrink-0">{k}</dt>
                  <dd class="text-white min-w-0">{v || '—'}</dd>
                </div>
              ))}
            </dl>
            {app.Domain && (
              <a href={`https://${app.Domain}`} target="_blank" rel="noreferrer"
                class="flex items-center gap-1.5 text-xs text-panel-accent hover:underline mt-1">
                <Globe size={11} /> {app.Domain}
              </a>
            )}
          </div>

          {/* Env vars */}
          <div class="card space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="font-semibold text-white text-sm">Environment Variables</h2>
              <button onClick={() => setEditEnv(v => !v)} class="btn-ghost text-xs px-2 py-1">
                {editEnv ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editEnv ? (
              <>
                <textarea class="input h-32 resize-none font-mono text-xs"
                  value={env} onInput={e => setEnv(e.target.value)}
                  placeholder={"KEY=value\nSECRET=abc123"} />
                <button onClick={saveEnv} class="btn-primary text-xs" disabled={saving}>
                  {saving ? 'Saving…' : 'Save & Redeploy Recommended'}
                </button>
              </>
            ) : (
              <div class="bg-panel-bg rounded-lg p-3 font-mono text-xs text-gray-400 whitespace-pre min-h-10 max-h-40 overflow-y-auto">
                {env || <span class="text-panel-muted">(empty)</span>}
              </div>
            )}
          </div>

          {/* Deploy key */}
          {deployKey && (
            <div class="card space-y-3">
              <h2 class="font-semibold text-white text-sm flex items-center gap-2"><Key size={13} /> Deploy Key</h2>
              <p class="text-xs text-panel-muted">Add as a read-only deploy key in your GitHub repo settings.</p>
              <div class="bg-panel-bg rounded p-2.5 font-mono text-xs text-gray-400 break-all border border-panel-border max-h-24 overflow-y-auto">
                {deployKey}
              </div>
            </div>
          )}
        </div>

        {/* ── Right col: deployment history ── */}
        <div class="lg:col-span-2 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-white text-sm">Deployments</h2>
            <button onClick={loadAll} class="btn-ghost text-xs px-2 py-1">
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          {deployments.length === 0 ? (
            <div class="card text-center py-10 text-panel-muted text-sm">No deployments yet</div>
          ) : (
            <div class="space-y-3">
              {deployments.map((dep, i) => (
                <DeploymentRow
                  key={dep.ID}
                  dep={dep}
                  isLatest={i === 0 && dep.Status === 'success'}
                  onViewLogs={d => setLogDep(d)}
                  onRollback={d => { setRollbackDep(d) }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
