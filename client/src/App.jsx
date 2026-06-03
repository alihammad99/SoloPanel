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
import { Loader2, Box } from 'lucide-preact'

function LoginPage() {
  return (
    <div class="min-h-screen flex items-center justify-center bg-panel-bg relative overflow-hidden">
      {/* Ambient glow */}
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20 blur-[120px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #6366f1, transparent)' }} />

      <div class="card-elevated w-full max-w-sm text-center space-y-6 relative z-10">
        <div class="space-y-3">
          <div class="w-12 h-12 rounded-xl mx-auto flex items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
            <Box size={22} class="text-white relative z-10" />
            <div class="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 30% 30%, white, transparent)' }} />
          </div>
          <div>
            <h1 class="text-xl font-bold text-white tracking-tight">Welcome to Panel</h1>
            <p class="text-panel-muted text-sm mt-1">Self-hosted deployment platform</p>
          </div>
        </div>
        <a href="/api/auth/login" class="btn-primary w-full justify-center py-2.5 text-base">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Sign in with GitHub
        </a>
        <p class="text-xs text-panel-muted">
          Only GitHub users in the allowlist can access this panel.
        </p>
      </div>
    </div>
  )
}

function Layout({ children, currentPath, user }) {
  const pathNames = {
    '/': 'Dashboard',
    '/apps': 'Apps',
    '/docker': 'Docker',
    '/marketplace': 'Marketplace',
    '/domains': 'Domains & SSL',
    '/storage': 'Storage',
    '/security': 'Security',
    '/backups': 'Backups',
    '/settings': 'Settings',
  }
  const pageTitle = pathNames[currentPath] || 'Panel'

  return (
    <div class="flex min-h-screen bg-panel-bg">
      <Sidebar currentPath={currentPath} user={user} />
      <div class="flex-1 flex flex-col min-w-0">
        <header class="h-14 flex items-center justify-between px-6 border-b border-panel-border/50 shrink-0 bg-panel-bg/80 backdrop-blur-sm sticky top-0 z-30">
          <h2 class="text-sm font-semibold text-panel-heading">{pageTitle}</h2>
          <div class="flex items-center gap-3">
            {user && (
              <div class="flex items-center gap-2 text-xs text-panel-muted">
                <img src={user.avatar} alt="" class="w-5 h-5 rounded-full" />
                <span class="hidden sm:inline">{user.username}</span>
              </div>
            )}
          </div>
        </header>
        <main class="flex-1 overflow-auto p-6">
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
