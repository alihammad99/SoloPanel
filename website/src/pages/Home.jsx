import { FeatureCard } from '../components/FeatureCard';
import { Terminal } from '../components/Terminal';

const FEATURES = [
  {
    title: 'GitHub Deploy',
    description: 'Connect any repo, auto-detect stack (Bun, Node, Python, Go, Rust, Ruby, Docker), build and deploy with zero config.',
    icon: (
      <svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    )
  },
  {
    title: 'Auto Stack Detection',
    description: 'Detects bun.lockb, package.json, go.mod, requirements.txt, Dockerfile and sets correct install/build/start commands automatically.',
    icon: (
      <svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" />
      </svg>
    )
  },
  {
    title: 'Docker Management',
    description: 'List, start, stop, and remove containers, images, volumes, and networks directly from the dashboard.',
    icon: (
      <svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l.75 5.25m0 0l5.25-.75m-5.25.75l3-3m-3 3l-3-3m3 3v-5.25" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75l-.75-5.25m0 0l-5.25.75m5.25-.75l-3 3m3-3l3 3" />
      </svg>
    )
  },
  {
    title: 'Domains & SSL',
    description: 'Caddy integration with automatic Let\'s Encrypt. Supports auto, custom, and redirect SSL modes with PEM upload.',
    icon: (
      <svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 16.5c-3.477 0-6.701-1.596-8.686-4.582" />
      </svg>
    )
  },
  {
    title: 'S3 Backups',
    description: 'Restic-powered backups to any S3-compatible storage. AWS S3, Cloudflare R2, MinIO, and more.',
    icon: (
      <svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m0 0h16.5" />
      </svg>
    )
  },
  {
    title: 'Resource Monitor',
    description: 'Real-time CPU, memory, disk, and network sparklines via SSE. See exactly what your server is doing.',
    icon: (
      <svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    )
  },
  {
    title: 'Marketplace',
    description: 'One-click deploy popular open-source apps. Uptime Kuma, Vaultwarden, Plausible, Grafana, Nextcloud, and more.',
    icon: (
      <svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64M13.5 3v11.25m0 0L16.5 12m-3 0l-3 3m3-3l3 3" />
      </svg>
    )
  },
  {
    title: 'Encrypted Env Vars',
    description: 'Environment variables stored with AES-256-GCM encryption at rest. Your secrets stay secret.',
    icon: (
      <svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    )
  },
  {
    title: 'GitHub OAuth',
    description: 'Allowlist-based access control. Only specified GitHub usernames can log in. Server-signed JWT with 7-day expiry.',
    icon: (
      <svg class="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1 1.248-8.25 3.285z" />
      </svg>
    )
  }
];

const SECURITY_POINTS = [
  {
    title: 'Non-root execution',
    description: 'Panel runs as a dedicated non-root user with only Docker group access.'
  },
  {
    title: 'Per-app SSH deploy keys',
    description: 'Read-only Ed25519 key pairs generated per app. No long-lived tokens stored.'
  },
  {
    title: 'httpOnly JWT cookies',
    description: 'Auth tokens are server-side, not in localStorage. XSS resistant by default.'
  },
  {
    title: 'AES-256-GCM encryption',
    description: 'Environment variables encrypted at rest in SQLite with your own key.'
  }
];

const TERMINAL_LINES = [
  { text: '$ curl -fsSL https://raw.githubusercontent.com/your-org/panel/main/install.sh | sudo bash', class: 'text-slate-400' },
  { text: 'Installing SoloPanel...', class: 'text-brand-400' },
  { text: 'Docker detected', class: 'text-slate-300' },
  { text: 'Caddy installed', class: 'text-slate-300' },
  { text: 'Building binary...', class: 'text-slate-300' },
  { text: 'Panel running at https://panel.yourdomain.com', class: 'text-brand-400' }
];

export function Home() {
  return (
    <div>
      {/* Hero */}
      <section class="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden hero-glow">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-900/30 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-6">
            <span class="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
            Open Source & Self-Hosted
          </div>
          <h1 class="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
            Deploy apps to your
            <span class="gradient-text"> own VPS</span>
            <br class="hidden md:block" />
            without the complexity
          </h1>
          <p class="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            SoloPanel is a lightweight deployment panel for your VPS. Connect GitHub repos, manage Docker containers, configure SSL domains, backup to S3, and monitor everything from one clean dashboard.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/#install" class="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-black gradient-bg rounded-xl hover:opacity-90 transition shadow-lg shadow-brand-500/25">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              One-Command Install
            </a>
            <a href="https://github.com/your-org/panel" target="_blank" class="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-zinc-300 bg-surface-2 border border-white/10 rounded-xl hover:bg-surface-3 hover:text-white transition">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Star on GitHub
            </a>
          </div>

          <div class="mt-16 max-w-3xl mx-auto">
            <Terminal lines={TERMINAL_LINES} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" class="py-20 bg-surface-1">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center mb-16">
            <h2 class="text-3xl md:text-4xl font-bold mb-4">Everything you need to deploy</h2>
            <p class="text-lg text-zinc-400 max-w-2xl mx-auto">From repo to running container in minutes, with full control over your infrastructure.</p>
          </div>
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <FeatureCard icon={f.icon} title={f.title} description={f.description} />
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" class="py-20 bg-surface-0">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 class="text-3xl md:text-4xl font-bold mb-6">Built with security in mind</h2>
              <p class="text-lg text-zinc-400 mb-8">Your infrastructure, your rules. SoloPanel does not hold your keys or your data.</p>
              <div class="space-y-4">
                {SECURITY_POINTS.map((p) => (
                  <div class="flex gap-4">
                    <div class="w-8 h-8 rounded-lg bg-brand-900/30 flex items-center justify-center shrink-0 mt-0.5">
                      <svg class="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <h4 class="font-semibold text-zinc-100">{p.title}</h4>
                      <p class="text-sm text-zinc-400">{p.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div class="hidden lg:flex justify-center">
              <div class="w-80 h-80 rounded-full bg-gradient-to-br from-brand-900/40 to-brand-900/10 flex items-center justify-center">
                <svg class="w-32 h-32 text-brand-600 opacity-20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Install CTA */}
      <section id="install" class="py-20 bg-surface-1 border-t border-white/10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 class="text-3xl md:text-4xl font-bold mb-4">Ready to deploy?</h2>
          <p class="text-lg text-zinc-400 max-w-2xl mx-auto mb-8">Install SoloPanel on your VPS in under 5 minutes.</p>
          <div class="max-w-2xl mx-auto">
            <Terminal lines={[
              { text: 'curl -fsSL https://raw.githubusercontent.com/your-org/panel/main/install.sh | sudo bash', class: 'text-slate-300' }
            ]} />
          </div>
          <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/docs" class="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-brand-300 bg-brand-900/20 border border-brand-500/20 rounded-xl hover:bg-brand-900/30 transition">
              Read the Docs
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
