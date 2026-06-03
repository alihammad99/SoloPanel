import {
  LayoutDashboard, Zap, Container, Globe,
  Archive, Settings, LogOut, Rocket, Store, HardDrive, ShieldAlert
} from 'lucide-preact'

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ]
  },
  {
    label: 'Deploy',
    items: [
      { href: '/apps', icon: Rocket, label: 'Apps' },
      { href: '/docker', icon: Container, label: 'Docker' },
      { href: '/marketplace', icon: Store, label: 'Marketplace' },
    ]
  },
  {
    label: 'Infrastructure',
    items: [
      { href: '/domains', icon: Globe, label: 'Domains & SSL' },
      { href: '/storage', icon: HardDrive, label: 'Storage' },
      { href: '/security', icon: ShieldAlert, label: 'Security' },
      { href: '/backups', icon: Archive, label: 'Backups' },
    ]
  },
  {
    label: 'System',
    items: [
      { href: '/settings', icon: Settings, label: 'Settings' },
    ]
  },
]

export function Sidebar({ currentPath, user }) {
  const isActive = (href) => {
    if (href === '/') return currentPath === '/'
    return currentPath.startsWith(href)
  }

  return (
    <aside class="flex flex-col w-[220px] min-h-screen shrink-0 relative"
      style={{
        background: 'linear-gradient(180deg, #0a0c15 0%, #080a12 100%)',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        boxShadow: '1px 0 0 0 rgba(59,130,246,0.04)'
      }}>

      {/* Top ambient glow */}
      <div class="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, rgba(37,99,235,0.08), transparent)' }} />

      {/* Logo */}
      <div class="flex items-center gap-3 px-4 pt-5 pb-4 relative z-10">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center relative overflow-hidden flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
            boxShadow: '0 0 20px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.2)'
          }}>
          <Zap size={17} class="text-white relative z-10" strokeWidth={2.5} />
          <div class="absolute inset-0" style={{ background: 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.25), transparent 60%)' }} />
        </div>
        <div>
          <div class="text-[15px] font-bold text-white tracking-tight leading-none">Panel</div>
          <div class="text-[10px] mt-0.5 font-medium tracking-widest uppercase" style={{ color: '#4b5268' }}>Self-Hosted</div>
        </div>
      </div>

      {/* Nav groups */}
      <nav class="flex-1 px-2.5 pb-2 space-y-0.5 overflow-y-auto relative z-10" style={{ scrollbarWidth: 'none' }}>
        {NAV_GROUPS.map(({ label, items }) => (
          <div key={label || 'main'} class="mb-1">
            {label && (
              <div class="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#2e3148' }}>
                {label}
              </div>
            )}
            {items.map(({ href, icon: Icon, label: itemLabel }) => {
              const active = isActive(href)
              return (
                <a key={href} href={href}
                  class={`relative flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 group overflow-hidden
                    ${active ? 'text-white' : 'text-[#4b5268] hover:text-[#9ca3af]'}`}
                  style={active ? {
                    background: 'linear-gradient(135deg, rgba(37,99,235,0.18) 0%, rgba(59,130,246,0.08) 100%)',
                    boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.05)',
                  } : {}}>

                  {/* Active left bar */}
                  {active && (
                    <span class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                      style={{ background: 'linear-gradient(180deg, #93c5fd, #2563eb)' }} />
                  )}

                  {/* Hover bg */}
                  {!active && (
                    <span class="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(255,255,255,0.025)' }} />
                  )}

                  <Icon size={15}
                    class="relative z-10 flex-shrink-0 transition-colors"
                    style={{ color: active ? '#60a5fa' : 'inherit' }}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <span class="relative z-10 flex-1 truncate">{itemLabel}</span>
                </a>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      {user && (
        <div class="relative z-10 mx-2.5 mb-3 mt-1">
          <div class="h-px mb-3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }} />
          <div class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl group"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div class="relative flex-shrink-0">
              <img src={user.avatar} alt={user.username}
                class="w-7 h-7 rounded-full"
                style={{ boxShadow: '0 0 0 2px rgba(59,130,246,0.2)' }} />
              <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0c15]"
                style={{ background: '#34d399' }} />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-medium text-white truncate leading-tight">{user.username}</div>
              <div class="text-[10px]" style={{ color: '#2e3148' }}>GitHub</div>
            </div>
            <a href="/api/auth/logout"
              class="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              style={{ color: '#4b5268' }}
              title="Sign out">
              <LogOut size={13} />
            </a>
          </div>
        </div>
      )}
    </aside>
  )
}
