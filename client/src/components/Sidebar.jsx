import {
  LayoutDashboard, Box, Container, Globe,
  Archive, Settings, LogOut, Rocket, Store, HardDrive, ShieldAlert
} from 'lucide-preact'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/apps', icon: Rocket, label: 'Apps' },
  { href: '/docker', icon: Container, label: 'Docker' },
  { href: '/marketplace', icon: Store, label: 'Marketplace' },
  { href: '/domains', icon: Globe, label: 'Domains & SSL' },
  { href: '/storage', icon: HardDrive, label: 'Storage' },
  { href: '/security', icon: ShieldAlert, label: 'Security' },
  { href: '/backups', icon: Archive, label: 'Backups' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar({ currentPath, user }) {
  const isActive = (href) => {
    if (href === '/') return currentPath === '/'
    return currentPath.startsWith(href)
  }

  return (
    <aside class="flex flex-col w-56 min-h-screen bg-panel-surface/50 border-r border-panel-border shrink-0 backdrop-blur-sm">
      {/* Logo */}
      <div class="flex items-center gap-3 px-5 py-5">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
          <Box size={16} class="text-white relative z-10" />
          <div class="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 30% 30%, white, transparent)' }} />
        </div>
        <div>
          <div class="text-sm font-bold text-white tracking-tight">Panel</div>
          <div class="text-[10px] text-panel-muted uppercase tracking-widest">Self-Hosted</div>
        </div>
      </div>

      {/* Nav */}
      <nav class="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <a
              key={href}
              href={href}
              class={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative ${active
                ? 'text-panel-accent'
                : 'text-panel-muted hover:text-panel-heading'
                }`}
            >
              {/* Active pill indicator */}
              {active && (
                <span class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ background: 'linear-gradient(180deg, #818cf8, #6366f1)' }} />
              )}
              {/* Active background glow */}
              {active && (
                <span class="absolute inset-0 rounded-lg bg-panel-accent/[0.06]" />
              )}
              <span class="relative z-10 flex items-center gap-3 w-full">
                <Icon size={16} class={active ? 'text-panel-accent' : 'text-panel-muted group-hover:text-panel-heading'} />
                <span class="flex-1">{label}</span>
              </span>
            </a>
          )
        })}
      </nav>

      {/* User */}
      {user && (
        <div class="px-3 py-3 border-t border-panel-border/50 mx-3 mb-3">
          <div class="flex items-center gap-3">
            <img src={user.avatar} alt={user.username} class="w-7 h-7 rounded-full ring-2 ring-panel-border" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-panel-heading truncate">{user.username}</div>
              <div class="text-[10px] text-panel-muted">GitHub</div>
            </div>
            <a href="/api/auth/logout" class="text-panel-muted hover:text-panel-danger transition-colors p-1 rounded-md hover:bg-white/5">
              <LogOut size={14} />
            </a>
          </div>
        </div>
      )}
    </aside>
  )
}
