import { useState, useEffect } from 'preact/hooks'
import { Rocket, Container, Globe, Archive, Activity, ChevronRight } from 'lucide-preact'
import { api } from '../api/client'
import { ResourceMonitor } from '../components/ResourceMonitor'

function StatCard({ icon: Icon, label, value, color, href }) {
  return (
    <a href={href} class="card flex items-center gap-4 hover:border-panel-accent/40 transition-colors cursor-pointer">
      <div class="p-3 rounded-xl" style={{ background: color + '18' }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div class="flex-1">
        <div class="text-2xl font-bold text-white">{value}</div>
        <div class="text-xs text-panel-muted mt-0.5">{label}</div>
      </div>
      <ChevronRight size={16} class="text-panel-border" />
    </a>
  )
}

function AppRow({ app }) {
  const statusColor = {
    running: 'badge-success',
    idle: 'badge-muted',
    failed: 'badge-danger',
    building: 'badge-warning',
  }[app.Status] || 'badge-muted'

  return (
    <a href={`/apps/${app.ID}`} class="flex items-center gap-3 py-3 px-4 hover:bg-white/3 rounded-lg transition-colors group">
      <div class="w-8 h-8 rounded-lg bg-panel-accent/10 flex items-center justify-center">
        <Rocket size={14} class="text-panel-accent" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-white truncate">{app.Name}</div>
        <div class="text-xs text-panel-muted truncate">{app.Domain || app.RepoURL || 'no domain'}</div>
      </div>
      <div class="flex items-center gap-2">
        <span class={statusColor}>{app.Status || 'idle'}</span>
        {app.TechStack && <span class="badge-accent">{app.TechStack}</span>}
      </div>
    </a>
  )
}

export function Dashboard() {
  const [apps, setApps] = useState([])
  const [containers, setContainers] = useState([])
  const [domains, setDomains] = useState([])
  const [backups, setBackups] = useState([])

  useEffect(() => {
    api.apps.list().then(d => setApps(d || []))
    api.docker.containers().then(d => setContainers(d || []))
    api.domains.list().then(d => setDomains(d || []))
    api.backups.list().then(d => setBackups(d || []))
  }, [])

  const runningContainers = containers.filter(c => c.State === 'running').length

  return (
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-bold text-white">Dashboard</h1>
        <p class="text-panel-muted text-sm mt-1">System overview and quick actions</p>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Rocket} label="Total Apps" value={apps.length} color="#6366f1" href="/apps" />
        <StatCard icon={Container} label="Running Containers" value={runningContainers} color="#22c55e" href="/docker" />
        <StatCard icon={Globe} label="Domains" value={domains.length} color="#38bdf8" href="/domains" />
        <StatCard icon={Archive} label="Backups" value={backups.length} color="#f59e0b" href="/backups" />
      </div>

      <div>
        <div class="flex items-center gap-2 mb-4">
          <Activity size={16} class="text-panel-accent" />
          <h2 class="text-sm font-semibold text-white uppercase tracking-wide">System Resources</h2>
        </div>
        <ResourceMonitor />
      </div>

      <div class="grid lg:grid-cols-2 gap-6">
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-white">Recent Apps</h2>
            <a href="/apps" class="text-xs text-panel-accent hover:underline">View all</a>
          </div>
          <div class="space-y-1">
            {apps.slice(0, 5).map(app => <AppRow key={app.ID} app={app} />)}
            {apps.length === 0 && (
              <div class="text-panel-muted text-sm py-4 text-center">
                No apps yet. <a href="/apps" class="text-panel-accent hover:underline">Deploy your first app →</a>
              </div>
            )}
          </div>
        </div>

        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-white">Containers</h2>
            <a href="/docker" class="text-xs text-panel-accent hover:underline">View all</a>
          </div>
          <div class="space-y-2">
            {containers.slice(0, 5).map(c => (
              <div key={c.Id} class="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/3">
                <div class={`w-2 h-2 rounded-full ${c.State === 'running' ? 'bg-panel-success' : 'bg-panel-border'}`} />
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-white truncate">{c.Names?.[0]?.replace('/', '') || c.Id.slice(0, 12)}</div>
                  <div class="text-xs text-panel-muted truncate">{c.Image}</div>
                </div>
                <span class={c.State === 'running' ? 'badge-success' : 'badge-muted'}>{c.State}</span>
              </div>
            ))}
            {containers.length === 0 && (
              <div class="text-panel-muted text-sm py-4 text-center">No containers running</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
