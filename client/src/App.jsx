import { useState } from 'preact/hooks'
import Router, { route } from 'preact-router'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Apps, AppDetail } from './pages/Apps'
import { Docker } from './pages/Docker'
import { Marketplace } from './pages/Marketplace'
import { Domains } from './pages/Domains'
import { Backups } from './pages/Backups'
import { Settings } from './pages/Settings'
import { Storage } from './pages/Storage'
import { Security } from './pages/Security'
import { useAuth } from './hooks/useAuth'
import { Loader2, Zap } from 'lucide-preact'

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

function LoginPage() {
  return (
    <div class="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#080a10' }}>

      {/* Background elements */}
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] blur-[160px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, #2563eb, #1d4ed8, transparent)' }} />
        <div class="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] blur-[120px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(ellipse, #38bdf8, transparent)' }} />
        {/* Grid pattern */}
        <div class="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(59,130,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
      </div>

      <div class="relative z-10 w-full max-w-[380px] px-4">
        {/* Card */}
        <div class="card-elevated text-center space-y-7">
          {/* Logo mark */}
          <div class="flex flex-col items-center gap-4">
            <div class="relative">
              <div class="w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                  boxShadow: '0 0 40px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                }}>
                <Zap size={24} class="text-white relative z-10" strokeWidth={2.5} />
                <div class="absolute inset-0" style={{ background: 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.3), transparent 60%)' }} />
              </div>
              <div class="absolute -inset-2 blur-xl opacity-30 rounded-2xl"
                style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }} />
            </div>
            <div>
              <h1 class="text-2xl font-bold tracking-tight gradient-text">Panel</h1>
              <p class="text-[13px] mt-1" style={{ color: '#4b5268' }}>Self-hosted deployment platform</p>
            </div>
          </div>

          {/* Features row */}
          <div class="grid grid-cols-3 gap-2">
            {['Deploy Apps', 'Manage Infra', 'Monitor All'].map(f => (
              <div key={f} class="rounded-xl py-2 px-1 text-center text-[11px] font-medium"
                style={{ background: 'rgba(59,130,246,0.06)', color: '#6b7280', border: '1px solid rgba(59,130,246,0.08)' }}>
                {f}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div class="space-y-3">
            <a href="/api/auth/login" class="btn-primary w-full justify-center py-3 text-[14px] gap-2.5">
              <GithubIcon />
              Continue with GitHub
            </a>
            <p class="text-[11px]" style={{ color: '#2e3148' }}>
              Access restricted to allowlisted GitHub accounts
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const PAGE_META = {
  '/': { title: 'Dashboard', subtitle: 'System overview' },
  '/apps': { title: 'Apps', subtitle: 'Manage deployed applications' },
  '/docker': { title: 'Docker', subtitle: 'Containers & images' },
  '/marketplace': { title: 'Marketplace', subtitle: 'One-click stack templates' },
  '/domains': { title: 'Domains & SSL', subtitle: 'Custom domains and certificates' },
  '/storage': { title: 'Storage', subtitle: 'S3-compatible object storage' },
  '/security': { title: 'Security', subtitle: 'Malware scanning & SSH keys' },
  '/backups': { title: 'Backups', subtitle: 'Restic-powered backup management' },
  '/settings': { title: 'Settings', subtitle: 'Platform configuration' },
}

function Layout({ children, currentPath, user }) {
  // Match /apps/123 → /apps meta
  const metaKey = Object.keys(PAGE_META).find(k => k !== '/' && currentPath.startsWith(k)) || currentPath
  const meta = PAGE_META[metaKey] || { title: 'Panel', subtitle: '' }

  return (
    <div class="flex min-h-screen" style={{ background: '#080a10' }}>
      <Sidebar currentPath={currentPath} user={user} />

      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header class="h-13 flex items-center justify-between px-6 shrink-0 sticky top-0 z-30"
          style={{
            background: 'rgba(8,10,16,0.8)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            boxShadow: '0 1px 0 rgba(59,130,246,0.04)',
            height: '52px',
          }}>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-white">{meta.title}</span>
            {meta.subtitle && (
              <>
                <span style={{ color: '#1e2130' }}>·</span>
                <span class="text-xs hidden sm:inline" style={{ color: '#4b5268' }}>{meta.subtitle}</span>
              </>
            )}
          </div>
          <div class="flex items-center gap-3">
            {/* Status pill */}
            <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.12)' }}>
              <span class="w-1.5 h-1.5 rounded-full bg-panel-success animate-pulse" />
              Online
            </div>
          </div>
        </header>

        {/* Page content */}
        <main class="flex-1 overflow-auto p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  if (loading) {
    return (
      <div class="min-h-screen flex items-center justify-center bg-panel-bg">
        <Loader2 size={32} class="text-panel-accent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  function handleRoute(e) {
    setCurrentPath(e.url)
  }

  return (
    <Layout currentPath={currentPath} user={user}>
      <Router onChange={handleRoute}>
        <Dashboard path="/" />
        <Apps path="/apps" />
        <AppDetail path="/apps/:id" />
        <Docker path="/docker" />
        <Marketplace path="/marketplace" />
        <Domains path="/domains" />
        <Storage path="/storage" />
        <Security path="/security" />
        <Backups path="/backups" />
        <Settings path="/settings" />
      </Router>
    </Layout>
  )
}
