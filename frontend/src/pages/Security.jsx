import { useState, useEffect } from 'preact/hooks'
import {
  ShieldAlert, ShieldCheck, ShieldX, Play, RefreshCw,
  AlertTriangle, CheckCircle, XCircle, FileX, Clock,
  ChevronDown, ChevronRight, Trash2, Info,
} from 'lucide-preact'
import { api } from '../api/client'

function formatDuration(start, end) {
  if (!start || !end) return ''
  const ms = new Date(end) - new Date(start)
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const severityColor = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  warning: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  ok: 'text-panel-success bg-panel-success/10 border-panel-success/20',
}

const severityIcon = {
  critical: <XCircle size={14} class="text-red-400" />,
  high: <AlertTriangle size={14} class="text-orange-400" />,
  medium: <AlertTriangle size={14} class="text-yellow-400" />,
  warning: <AlertTriangle size={14} class="text-yellow-400" />,
  ok: <CheckCircle size={14} class="text-panel-success" />,
}

function SeverityBadge({ s }) {
  const label = s?.toLowerCase() || 'ok'
  return (
    <span class={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${severityColor[label] || severityColor.medium}`}>
      {label}
    </span>
  )
}

function FindingRow({ f, onQuarantine }) {
  const [expanded, setExpanded] = useState(false)
  const severity = f.severity || f.Severity || 'medium'
  const rule = f.rule || f.Rule || ''
  const path = f.path || f.Path || ''
  const line = f.line || f.Line || 0
  const match = f.match || f.Match || ''
  return (
    <div class="border border-panel-border rounded-lg overflow-hidden">
      <button
        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] text-left transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {severityIcon[severity.toLowerCase()] || severityIcon.medium}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-medium text-white">{rule}</span>
            <SeverityBadge s={severity} />
          </div>
          <div class="text-xs text-panel-muted font-mono truncate mt-0.5">{path}:{line}</div>
        </div>
        {expanded ? <ChevronDown size={14} class="text-panel-muted shrink-0" /> : <ChevronRight size={14} class="text-panel-muted shrink-0" />}
      </button>
      {expanded && (
        <div class="px-4 pb-3 border-t border-panel-border bg-panel-bg/50 space-y-2">
          <div class="text-xs text-panel-muted mt-2">Matched line:</div>
          <pre class="text-xs text-red-300 bg-red-900/10 border border-red-400/10 rounded px-3 py-2 overflow-x-auto font-mono whitespace-pre-wrap">{match}</pre>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-xs text-panel-muted font-mono">{path}</span>
            <span class="text-xs text-panel-muted">line {line}</span>
            <button
              onClick={() => onQuarantine(path)}
              class="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-panel-danger/30 text-panel-danger hover:bg-panel-danger/10 transition-colors"
            >
              <Trash2 size={11} /> Quarantine File
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CheckRow({ c }) {
  const s = (c.status || c.Status || '').toLowerCase()
  const name = c.name || c.Name || ''
  const detail = c.detail || c.Detail || ''
  return (
    <div class="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
      <div class="shrink-0 mt-0.5">{severityIcon[s] || severityIcon.medium}</div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-medium text-white">{name}</div>
        {detail && <div class="text-xs text-panel-muted mt-0.5 leading-relaxed">{detail}</div>}
      </div>
      <div class="shrink-0 mt-0.5"><SeverityBadge s={s} /></div>
    </div>
  )
}

export function Security() {
  const [data, setData] = useState(null)
  const [running, setRunning] = useState(false)
  const [polling, setPolling] = useState(false)
  const [filter, setFilter] = useState('all') // all / critical / high / medium
  const [quarantining, setQuarantining] = useState(null)
  const [toast, setToast] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [scanStart, setScanStart] = useState(null)

  async function fetchStatus() {
    const res = await api.security.results()
    setData(res)
    setRunning(res?.running ?? false)
    return res
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  // Tick elapsed seconds while running
  useEffect(() => {
    if (!running) { setElapsed(0); return }
    const id = setInterval(() => {
      setElapsed(s => s + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!running) { setPolling(false); return }
    setPolling(true)
    const id = setInterval(async () => {
      const res = await fetchStatus()
      if (!res?.running) clearInterval(id)
    }, 2000)
    return () => clearInterval(id)
  }, [running])

  async function startScan() {
    setElapsed(0)
    setRunning(true)
    await api.security.scan()
    fetchStatus()
  }

  async function quarantine(path) {
    if (!confirm(`Quarantine "${path}"?\nThis moves the file out of its current location.`)) return
    setQuarantining(path)
    try {
      const res = await api.security.quarantine(path)
      showToast(`Quarantined to ${res.quarantined_to}`, 'ok')
      fetchStatus()
    } catch (e) {
      showToast('Quarantine failed: ' + e.message, 'error')
    } finally {
      setQuarantining(null)
    }
  }

  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const findings = data?.findings || []
  const checks = data?.checks || []

  const getSev = f => (f.severity || f.Severity || '').toLowerCase()

  const filteredFindings = filter === 'all'
    ? findings
    : findings.filter(f => getSev(f) === filter)

  const criticalCount = findings.filter(f => getSev(f) === 'critical').length
  const highCount = findings.filter(f => getSev(f) === 'high').length
  const getStatus = c => (c.status || c.Status || '').toLowerCase()
  const checksOk = checks.filter(c => getStatus(c) === 'ok').length
  const checksWarn = checks.filter(c => getStatus(c) === 'warning' || getStatus(c) === 'critical').length

  const overallStatus = criticalCount > 0 ? 'critical'
    : highCount > 0 || checksWarn > 0 ? 'warning'
      : data ? 'clean'
        : 'unknown'

  return (
    <div class="space-y-6 max-w-5xl">
      {/* Toast */}
      {toast && (
        <div class={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium flex items-center gap-2 ${toast.type === 'ok' ? 'bg-panel-success/10 border-panel-success/30 text-panel-success' : 'bg-red-900/20 border-red-400/30 text-red-300'}`}>
          {toast.type === 'ok' ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header card */}
      <div class="card !p-5 flex items-center gap-5">
        <div class={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${overallStatus === 'clean' ? 'bg-panel-success/10' : overallStatus === 'warning' ? 'bg-yellow-400/10' : overallStatus === 'critical' ? 'bg-red-400/10' : 'bg-panel-border/20'}`}>
          {overallStatus === 'clean'
            ? <ShieldCheck size={28} class="text-panel-success" />
            : overallStatus === 'critical'
              ? <ShieldX size={28} class="text-red-400" />
              : <ShieldAlert size={28} class="text-yellow-400" />}
        </div>
        <div class="flex-1">
          <div class="text-lg font-semibold text-white">
            {overallStatus === 'clean' ? 'Server is Clean'
              : overallStatus === 'critical' ? 'Critical Threats Detected'
                : overallStatus === 'warning' ? 'Security Warnings'
                  : 'Not Scanned Yet'}
          </div>
          <div class="text-sm text-panel-muted mt-0.5">
            {data?.finished_at
              ? `Last scan ${timeAgo(data.finished_at)} · ${data.scanned_files} files in ${formatDuration(data.started_at, data.finished_at)}`
              : 'Run a scan to check your server'}
          </div>
        </div>
        <button
          onClick={startScan}
          disabled={running}
          class="btn-primary flex items-center gap-2 px-5 py-2.5 shrink-0"
        >
          {running
            ? <><RefreshCw size={15} class="animate-spin" /> Scanning…</>
            : <><Play size={15} /> Run Scan</>}
        </button>
      </div>

      {/* Summary stats */}
      {data && !running && (
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Critical', value: criticalCount, color: 'text-red-400', bg: 'bg-red-400/5 border-red-400/20' },
            { label: 'High Risk', value: highCount, color: 'text-orange-400', bg: 'bg-orange-400/5 border-orange-400/20' },
            { label: 'Checks OK', value: checksOk, color: 'text-panel-success', bg: 'bg-panel-success/5 border-panel-success/20' },
            { label: 'Warnings', value: checksWarn, color: 'text-yellow-400', bg: 'bg-yellow-400/5 border-yellow-400/20' },
          ].map(({ label, value, color, bg }) => (
            <div class={`card !p-4 border ${bg}`}>
              <div class={`text-2xl font-bold ${color}`}>{value}</div>
              <div class="text-xs text-panel-muted mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {running && (
        <div class="card !p-8 flex flex-col items-center gap-4 text-panel-muted">
          <RefreshCw size={32} class="animate-spin text-panel-accent" />
          <div class="text-sm font-medium text-white">Scanning files and checking system security…</div>
          <div class="flex items-center gap-2 text-2xl font-mono font-bold text-panel-accent tabular-nums">
            <Clock size={20} class="text-panel-muted" />
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </div>
          <div class="text-xs text-panel-muted">This may take a minute depending on directory size</div>
        </div>
      )}

      {!running && data && (
        <>
          {/* Malware findings */}
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <FileX size={16} class="text-panel-accent" />
                <h2 class="text-sm font-semibold text-white">Malware Findings</h2>
                <span class="text-xs text-panel-muted">({findings.length})</span>
              </div>
              <div class="flex items-center gap-1.5">
                {['all', 'critical', 'high', 'medium'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    class={`text-xs px-2.5 py-1 rounded-lg border transition-colors capitalize ${filter === f ? 'bg-panel-accent/10 border-panel-accent/30 text-panel-accent' : 'border-panel-border text-panel-muted hover:text-white'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filteredFindings.length === 0 ? (
              <div class="card !p-8 flex flex-col items-center gap-2 text-panel-muted">
                <ShieldCheck size={28} class="text-panel-success" />
                <div class="text-sm">{filter === 'all' ? 'No malware signatures detected' : `No ${filter} findings`}</div>
              </div>
            ) : (
              <div class="space-y-2">
                {filteredFindings.map((f, i) => (
                  <FindingRow key={i} f={f} onQuarantine={quarantine} />
                ))}
              </div>
            )}
          </div>

          {/* System checks */}
          {checks.length > 0 && (
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <ShieldAlert size={16} class="text-panel-accent" />
                  <h2 class="text-sm font-semibold text-white">System Security Checks</h2>
                  <span class="text-xs text-panel-muted">({checks.length})</span>
                </div>
                <div class="flex items-center gap-2 text-xs text-panel-muted">
                  <span class="text-panel-success">{checks.filter(c => (c.status || c.Status) === 'ok').length} ok</span>
                  <span>·</span>
                  <span class="text-yellow-400">{checks.filter(c => (c.status || c.Status) === 'warning').length} warning</span>
                  <span>·</span>
                  <span class="text-red-400">{checks.filter(c => (c.status || c.Status) === 'critical').length} critical</span>
                </div>
              </div>
              <div class="card !p-0 divide-y divide-panel-border overflow-hidden">
                {checks.map((c, i) => <CheckRow key={i} c={c} />)}
              </div>
            </div>
          )}
        </>
      )}

      {!running && !data && (
        <div class="card !p-12 flex flex-col items-center gap-3 text-panel-muted">
          <ShieldAlert size={40} class="text-panel-border" />
          <div class="text-base font-medium text-panel-heading">No scan data</div>
          <div class="text-sm">Click <strong>Run Scan</strong> to analyze your server for malware and security issues.</div>
        </div>
      )}
    </div>
  )
}
