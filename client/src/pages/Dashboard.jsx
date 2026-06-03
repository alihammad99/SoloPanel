import { useState, useEffect } from 'preact/hooks'
import { Rocket, Container, Globe, Archive, Activity, ArrowUpRight, Boxes } from 'lucide-preact'
import { api } from '../api/client'
import { ResourceMonitor } from '../components/ResourceMonitor'

const STAT_CONFIG = [
  {
    key: 'apps', label: 'Apps', icon: Rocket, href: '/apps',
    color: '#3b82f6', glow: 'rgba(59,130,246,0.15)',
    bg: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(59,130,246,0.06))',
  },
  {
    key: 'containers', label: 'Running Containers', icon: Container, href: '/docker',
    color: '#34d399', glow: 'rgba(52,211,153,0.15)',
    bg: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(52,211,153,0.06))',
  },
  {
    key: 'domains', label: 'Domains', icon: Globe, href: '/domains',
    color: '#38bdf8', glow: 'rgba(56,189,248,0.15)',
    bg: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(56,189,248,0.06))',
  },
  {
    key: 'backups', label: 'Backups', icon: Archive, href: '/backups',
    color: '#fbbf24', glow: 'rgba(251,191,36,0.15)',
    bg: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.06))',
  },
]

function StatCard({ config, value }) {
  const { label, icon: Icon, href, color, glow, bg } = config
  return (
    <a href={href} class="relative overflow-hidden rounded-2xl p-5 group cursor-pointer transition-all duration-200"
      style={{
        background: bg,
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: `0 1px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>
      {/* Glow blob */}
      <div class="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-60 transition-opacity group-hover:opacity-100"
        style={{ background: glow }} />

      <div class="relative z-10 flex items-start justify-between">
        <div>
          <div class="text-[32px] font-bold leading-none tracking-tight" style={{ color }}>
            {value}
          </div>
          <div class="text-[12px] font-medium mt-1.5" style={{ color: '#6b7280' }}>{label}</div>
        </div>
        <div class="p-2 rounded-xl transition-transform group-hover:scale-110 group-hover:-rotate-6"
          style={{ background: `${color}15` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>

      <div class="relative z-10 flex items-center gap-1 mt-3 text-[11px] font-medium transition-colors"
        style={{ color: '#2e3148' }}>
        <span class="group-hover:underline">View all</span>
        <ArrowUpRight size={11} class="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </a>
  )
}

const STATUS_BADGE = {
  running: 'badge-success',
  idle: 'badge-muted',
  failed: 'badge-danger',
  building: 'badge-warning',
}

const STACK_COLOR = {
  node: '#84cc16', nodejs: '#84cc16',
  python: '#60a5fa', go: '#06b6d4',
  rust: '#fb923c', php: '#a78bfa',
  ruby: '#f43f5e', java: '#f59e0b',
  docker: '#38bdf8',
}

function AppRow({ app }) {
  const badge = STATUS_BADGE[app.Status] || 'badge-muted'
  const stackColor = STACK_COLOR[app.TechStack?.toLowerCase()] || '#3b82f6'
  const statusDot = {
    running: '#34d399', building: '#fbbf24', failed: '#fb7185', idle: '#2e3148'
  }[app.Status] || '#2e3148'

  return (
    <a href={`/apps/${app.ID}`}
      class="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-150 group cursor-pointer"
      style={{ ':hover': { background: 'rgba(255,255,255,0.03)' } }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

      {/* App icon */}
      <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 relative"
        style={{ background: `${stackColor}15`, border: `1px solid ${stackColor}20` }}>
        <Rocket size={14} style={{ color: stackColor }} />
        <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#080a10]"
          style={{ background: statusDot }} />
      </div>

      <div class="flex-1 min-w-0">
        <div class="text-[13px] font-medium text-white truncate">{app.Name}</div>
        <div class="text-[11px] truncate mt-0.5" style={{ color: '#4b5268' }}>
          {app.Domain || (app.RepoURL ? app.RepoURL.replace('https://github.com/', '') : 'no domain')}
        </div>
      </div>

      <div class="flex items-center gap-1.5 flex-shrink-0">
        {app.TechStack && (
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ background: `${stackColor}12`, color: stackColor, border: `1px solid ${stackColor}20` }}>
            {app.TechStack}
          </span>
        )}
        <span class={badge}>{app.Status || 'idle'}</span>
        <ArrowUpRight size={12} class="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#4b5268' }} />
      </div>
    </a>
  )
}

function SectionHeader({ icon: Icon, title, href, linkLabel = 'View all' }) {
  return (
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="p-1.5 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)' }}>
          <Icon size={13} class="text-panel-accent" />
        </div>
        <h2 class="text-[13px] font-semibold text-white">{title}</h2>
      </div>
      <a href={href} class="text-[11px] font-medium transition-colors flex items-center gap-1"
        style={{ color: '#4b5268' }}
        onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
        onMouseLeave={e => e.currentTarget.style.color = '#4b5268'}>
        {linkLabel} <ArrowUpRight size={10} />
      </a>
    </div>
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
  const runningApps = apps.filter(a => a.Status === 'running').length

  const stats = {
    apps: apps.length,
    containers: runningContainers,
    domains: domains.length,
    backups: backups.length,
  }

  return (
    <div class="space-y-7 max-w-6xl">

      {/* Welcome header */}
      <div class="flex items-end justify-between">
        <div>
          <h1 class="text-[22px] font-bold text-white tracking-tight">Overview</h1>
          <p class="text-[13px] mt-0.5" style={{ color: '#4b5268' }}>
            {runningApps > 0 ? `${runningApps} app${runningApps > 1 ? 's' : ''} running` : 'No apps running'} · {runningContainers} container{runningContainers !== 1 ? 's' : ''} active
          </p>
        </div>
        <a href="/apps" class="btn-primary text-sm gap-2 hidden sm:flex">
          <Rocket size={14} /> Deploy App
        </a>
      </div>

      {/* Stats grid */}
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {STAT_CONFIG.map(cfg => (
          <StatCard key={cfg.key} config={cfg} value={stats[cfg.key]} />
        ))}
      </div>

      {/* Resource monitor */}
      <div class="card">
        <SectionHeader icon={Activity} title="System Resources" href="#" linkLabel="" />
        <ResourceMonitor />
      </div>

      {/* Bottom two-col */}
      <div class="grid lg:grid-cols-2 gap-4">

        {/* Recent apps */}
        <div class="card">
          <SectionHeader icon={Rocket} title="Recent Apps" href="/apps" />
          <div class="space-y-0.5">
            {apps.slice(0, 6).map(app => <AppRow key={app.ID} app={app} />)}
            {apps.length === 0 && (
              <div class="py-8 text-center space-y-3">
                <div class="w-10 h-10 rounded-xl mx-auto flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.1)' }}>
                  <Boxes size={18} class="text-panel-accent opacity-50" />
                </div>
                <div class="text-[13px]" style={{ color: '#4b5268' }}>
                  No apps yet.{' '}
                  <a href="/apps" class="text-panel-accent hover:underline">Deploy your first →</a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Containers */}
        <div class="card">
          <SectionHeader icon={Container} title="Docker Containers" href="/docker" />
          <div class="space-y-0.5">
            {containers.slice(0, 6).map(c => {
              const isRunning = c.State === 'running'
              return (
                <div key={c.Id}
                  class="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all"
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isRunning ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isRunning ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                    <Container size={14} style={{ color: isRunning ? '#34d399' : '#4b5268' }} />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-[13px] font-medium text-white truncate">
                      {c.Names?.[0]?.replace('/', '') || c.Id.slice(0, 12)}
                    </div>
                    <div class="text-[11px] truncate mt-0.5" style={{ color: '#4b5268' }}>{c.Image}</div>
                  </div>
                  <span class={isRunning ? 'badge-success' : 'badge-muted'}>{c.State}</span>
                </div>
              )
            })}
            {containers.length === 0 && (
              <div class="py-8 text-center space-y-3">
                <div class="w-10 h-10 rounded-xl mx-auto flex items-center justify-center"
                  style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.1)' }}>
                  <Container size={18} class="opacity-40" style={{ color: '#34d399' }} />
                </div>
                <div class="text-[13px]" style={{ color: '#4b5268' }}>No containers running</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
