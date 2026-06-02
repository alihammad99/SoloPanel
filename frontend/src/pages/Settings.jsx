import { useState, useEffect } from 'preact/hooks'
import { Save, Database, Cloud, Shield, RefreshCw } from 'lucide-preact'
import { api } from '../api/client'

function Section({ title, icon: Icon, children }) {
  return (
    <div class="card space-y-4">
      <div class="flex items-center gap-2 pb-3 border-b border-panel-border">
        <Icon size={16} class="text-panel-accent" />
        <h2 class="font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export function Settings() {
  const [settings, setSettings] = useState({})
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.settings.get().then(d => {
      setSettings(d || {})
      setForm(d || {})
    })
  }, [])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    setSaving(true)
    await api.settings.update(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div class="space-y-6 max-w-2xl">
      <div>
        <h1 class="text-2xl font-bold text-white">Settings</h1>
        <p class="text-panel-muted text-sm mt-1">Configure panel integrations and storage</p>
      </div>

      <Section title="S3-Compatible Backup Storage" icon={Cloud}>
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="label">Endpoint URL</label>
            <input class="input" value={form.s3_endpoint || ''} onInput={set('s3_endpoint')}
              placeholder="https://s3.amazonaws.com" />
          </div>
          <div>
            <label class="label">Bucket Name</label>
            <input class="input" value={form.s3_bucket || ''} onInput={set('s3_bucket')}
              placeholder="my-panel-backups" />
          </div>
          <div>
            <label class="label">Region</label>
            <input class="input" value={form.s3_region || ''} onInput={set('s3_region')}
              placeholder="us-east-1" />
          </div>
          <div>
            <label class="label">Access Key ID</label>
            <input class="input" value={form.s3_access_key || ''} onInput={set('s3_access_key')}
              placeholder="AKIAIOSFODNN7EXAMPLE" />
          </div>
          <div>
            <label class="label">Secret Access Key</label>
            <input class="input" type="password" value={form.s3_secret_key || ''} onInput={set('s3_secret_key')}
              placeholder="••••••••••••••••••" />
          </div>
        </div>
        <div>
          <label class="label">Restic Repository Password</label>
          <input class="input" type="password" value={form.restic_password || ''} onInput={set('restic_password')}
            placeholder="Strong password for backup encryption" />
          <p class="text-xs text-panel-muted mt-1">Required to initialize and access the Restic repository. Store this securely.</p>
        </div>
        <div class="pt-2">
          <button
            onClick={async () => {
              if (!confirm('Initialize Restic repo? Only do this once.')) return
              await api.backups.initRestic()
            }}
            class="btn-ghost text-xs"
          >
            <Database size={12} /> Initialize Restic Repo
          </button>
        </div>
      </Section>

      <Section title="Marketplace Registry" icon={RefreshCw}>
        <div>
          <label class="label">Registry URL</label>
          <input class="input" value={form.registry_url || ''} onInput={set('registry_url')}
            placeholder="https://raw.githubusercontent.com/panel-registry/templates/main/registry.json" />
          <p class="text-xs text-panel-muted mt-1">URL to a JSON array of template objects. Leave blank to use built-in templates only.</p>
        </div>
      </Section>

      <Section title="Security" icon={Shield}>
        <div class="space-y-2 text-sm">
          <div class="flex items-center gap-3 py-2 px-3 rounded-lg bg-panel-success/5 border border-panel-success/10">
            <div class="w-2 h-2 rounded-full bg-panel-success" />
            <span class="text-panel-muted">Panel runs as non-root <code class="text-white bg-panel-bg px-1 rounded">panel</code> user</span>
          </div>
          <div class="flex items-center gap-3 py-2 px-3 rounded-lg bg-panel-success/5 border border-panel-success/10">
            <div class="w-2 h-2 rounded-full bg-panel-success" />
            <span class="text-panel-muted">GitHub OAuth — only whitelisted users can log in</span>
          </div>
          <div class="flex items-center gap-3 py-2 px-3 rounded-lg bg-panel-success/5 border border-panel-success/10">
            <div class="w-2 h-2 rounded-full bg-panel-success" />
            <span class="text-panel-muted">Env vars AES-256 encrypted at rest in SQLite</span>
          </div>
          <div class="flex items-center gap-3 py-2 px-3 rounded-lg bg-panel-success/5 border border-panel-success/10">
            <div class="w-2 h-2 rounded-full bg-panel-success" />
            <span class="text-panel-muted">Per-app read-only SSH deploy keys for GitHub</span>
          </div>
        </div>
      </Section>

      <div class="flex justify-end">
        <button onClick={save} disabled={saving} class="btn-primary">
          <Save size={14} />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
