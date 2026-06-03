import { useState, useEffect } from 'preact/hooks'
import { Globe, Plus, Trash2, ShieldCheck, ShieldAlert, ShieldOff, ExternalLink, RefreshCw, X, Lock } from 'lucide-preact'
import { api } from '../api/client'

const SSL_MODES = [
  { value: 'auto', label: 'Auto (Let\'s Encrypt)', desc: 'Caddy automatically provisions and renews certificates' },
  { value: 'custom', label: 'Custom Certificate', desc: 'Upload your own PEM certificate and private key' },
  { value: 'redirect', label: 'HTTP → HTTPS Redirect', desc: 'Redirect all HTTP traffic to HTTPS (no proxy)' },
]

function AddDomainModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ domain: '', target_port: 3000, ssl_mode: 'auto', custom_cert: '', custom_key: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await api.domains.add({ ...form, target_port: Number(form.target_port) })
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    if (res?.ID) { onAdded(res); onClose() }
  }

  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-lg">
        <div class="flex items-center justify-between mb-5">
          <h2 class="font-semibold text-white">Add Domain</h2>
          <button onClick={onClose} class="text-panel-muted hover:text-white"><X /></button>
        </div>
        <form onSubmit={submit} class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="label">Domain</label>
              <input class="input" value={form.domain} onInput={set('domain')} placeholder="app.example.com or *.example.com" required />
              <p class="text-xs text-panel-muted mt-1">Use <code class="text-white">*.example.com</code> for wildcard (requires DNS challenge setup in Caddy)</p>
            </div>
            {form.ssl_mode !== 'redirect' && (
              <div class="col-span-2">
                <label class="label">Target Port</label>
                <input class="input" type="number" value={form.target_port} onInput={set('target_port')} placeholder="3000" />
              </div>
            )}
          </div>

          <div>
            <label class="label">SSL Mode</label>
            <div class="space-y-2">
              {SSL_MODES.map(m => (
                <label key={m.value} class={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${form.ssl_mode === m.value ? 'border-panel-accent bg-panel-accent/5' : 'border-panel-border hover:border-panel-border/80'
                  }`}>
                  <input type="radio" name="ssl_mode" value={m.value} checked={form.ssl_mode === m.value}
                    onChange={e => setForm(f => ({ ...f, ssl_mode: e.target.value }))} class="mt-0.5" />
                  <div>
                    <div class="text-sm font-medium text-white">{m.label}</div>
                    <div class="text-xs text-panel-muted">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {form.ssl_mode === 'custom' && (
            <div class="space-y-3 p-3 rounded-lg bg-panel-bg border border-panel-border">
              <div>
                <label class="label">Certificate (PEM)</label>
                <textarea class="input h-28 resize-none font-mono text-xs" value={form.custom_cert} onInput={set('custom_cert')}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" />
              </div>
              <div>
                <label class="label">Private Key (PEM)</label>
                <textarea class="input h-28 resize-none font-mono text-xs" value={form.custom_key} onInput={set('custom_key')}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" />
              </div>
            </div>
          )}

          {error && <p class="text-panel-danger text-sm bg-panel-danger/5 border border-panel-danger/20 rounded-lg px-3 py-2">{error}</p>}

          <div class="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} class="btn-ghost">Cancel</button>
            <button type="submit" disabled={loading} class="btn-primary">
              {loading ? 'Adding…' : 'Add Domain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function Domains() {
  const [domains, setDomains] = useState([])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { api.domains.list().then(d => setDomains(d || [])) }, [])

  async function remove(domain) {
    if (!confirm(`Remove domain "${domain.Domain}"?`)) return
    await api.domains.remove(domain.ID)
    setDomains(d => d.filter(x => x.ID !== domain.ID))
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Domains & SSL</h1>
          <p class="text-panel-muted text-sm mt-1">Managed by Caddy with automatic Let's Encrypt</p>
        </div>
        <button onClick={() => setShowModal(true)} class="btn-primary">
          <Plus size={16} /> Add Domain
        </button>
      </div>

      {domains.length === 0 ? (
        <div class="card text-center py-16">
          <Globe size={40} class="text-panel-border mx-auto mb-4" />
          <div class="text-white font-medium mb-1">No domains configured</div>
          <div class="text-panel-muted text-sm mb-4">Add a domain and Caddy will auto-provision SSL</div>
          <button onClick={() => setShowModal(true)} class="btn-primary mx-auto">
            <Plus size={14} /> Add Domain
          </button>
        </div>
      ) : (
        <div class="card overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-panel-muted border-b border-panel-border">
                <th class="pb-3 pr-4">Domain</th>
                <th class="pb-3 pr-4">Target</th>
                <th class="pb-3 pr-4">SSL</th>
                <th class="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-panel-border/30">
              {domains.map(d => (
                <tr key={d.ID} class="hover:bg-white/2">
                  <td class="py-3 pr-4">
                    <div class="flex items-center gap-2">
                      <Globe size={14} class="text-panel-muted" />
                      <span class="text-white font-medium">{d.Domain}</span>
                      <a href={`https://${d.Domain}`} target="_blank" rel="noreferrer" class="text-panel-muted hover:text-panel-accent">
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </td>
                  <td class="py-3 pr-4 text-panel-muted font-mono text-xs">
                    :{d.TargetPort}
                  </td>
                  <td class="py-3 pr-4">
                    {d.SSLStatus === 'active' ? (
                      <span class="badge-success flex items-center gap-1"><ShieldCheck size={10} /> active</span>
                    ) : d.SSLStatus === 'redirect' ? (
                      <span class="badge-muted flex items-center gap-1"><ShieldOff size={10} /> redirect</span>
                    ) : d.SSLStatus === 'error' ? (
                      <span class="badge-danger flex items-center gap-1"><ShieldAlert size={10} /> error</span>
                    ) : (
                      <span class="badge-warning flex items-center gap-1"><Lock size={10} /> provisioning</span>
                    )}
                  </td>
                  <td class="py-3">
                    <button onClick={() => remove(d)} class="btn-danger px-2 py-1 text-xs">
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AddDomainModal
          onClose={() => setShowModal(false)}
          onAdded={d => setDomains(prev => [...prev, d])}
        />
      )}
    </div>
  )
}
