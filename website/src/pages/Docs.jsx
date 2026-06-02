import { useState } from 'preact/hooks';

const SECTIONS = [
  {
    id: 'install',
    title: 'Installation',
    content: (
      <div class="space-y-6">
        <h3 class="text-2xl font-bold">One-Command Install</h3>
        <p class="text-zinc-400">Run the installer on a fresh Debian/Ubuntu VPS. It installs Docker, Caddy, Restic, Go (if missing), creates a <code>panel</code> user, builds the binary, and starts the service.</p>
        <CodeBlock code="curl -fsSL https://raw.githubusercontent.com/your-org/panel/main/install.sh | sudo bash" />
        <p class="text-zinc-400">The installer will prompt for your GitHub OAuth credentials and allowed usernames. The panel starts on <code>localhost:8080</code> behind Caddy.</p>

        <h4 class="text-xl font-semibold mt-8">Manual Setup</h4>
        <p class="text-zinc-400">If you prefer manual control, install the prerequisites first:</p>
        <CodeBlock code={`# Docker\ncurl -fsSL https://get.docker.com | sh\n\n# Caddy\napt install caddy\n\n# Restic\napt install restic\n\n# Go 1.22+\nsnap install go --classic`} />

        <h4 class="text-xl font-semibold mt-8">Build from Source</h4>
        <CodeBlock code={`# Frontend\ncd frontend && bun install && bun run build\n\n# Backend\ncd backend && go build -o panel .`} />
      </div>
    )
  },
  {
    id: 'config',
    title: 'Configuration',
    content: (
      <div class="space-y-6">
        <h3 class="text-2xl font-bold">Configuration</h3>
        <p class="text-zinc-400">Copy the example config and edit with your credentials:</p>
        <CodeBlock code="cp config.example.yaml /etc/panel/config.yaml" />

        <h4 class="text-xl font-semibold mt-6">GitHub OAuth App</h4>
        <p class="text-zinc-400">Create a GitHub OAuth App at <a href="https://github.com/settings/developers" class="text-brand-400 hover:underline" target="_blank">github.com/settings/developers</a>:</p>
        <ul class="list-disc list-inside text-zinc-400 space-y-1">
          <li><strong>Homepage URL:</strong> <code>https://panel.yourdomain.com</code></li>
          <li><strong>Callback URL:</strong> <code>https://panel.yourdomain.com/api/auth/callback</code></li>
        </ul>

        <h4 class="text-xl font-semibold mt-6">Environment Variables</h4>
        <p class="text-zinc-400">You can use env vars instead of <code>config.yaml</code>:</p>
        <EnvTable />
      </div>
    )
  },
  {
    id: 'features',
    title: 'Features',
    content: (
      <div class="space-y-6">
        <h3 class="text-2xl font-bold">Features</h3>

        <h4 class="text-xl font-semibold">App Deployment</h4>
        <p class="text-zinc-400">Deploy apps from GitHub repos in two steps: pick a repo, then configure env vars and build settings. SoloPanel auto-detects the stack and sets install/build/start commands.</p>

        <h4 class="text-xl font-semibold mt-6">Docker Management</h4>
        <p class="text-zinc-400">The Docker tab shows containers, images, volumes, and networks. Start, stop, and remove containers directly. Uses the Docker Unix socket directly with no SDK dependency.</p>

        <h4 class="text-xl font-semibold mt-6">Domains & SSL</h4>
        <p class="text-zinc-400">Add domains with Caddy integration. Choose between three SSL modes:</p>
        <ul class="list-disc list-inside text-zinc-400 space-y-1">
          <li><strong>Auto</strong> — Let's Encrypt automatic certificates</li>
          <li><strong>Custom</strong> — Upload your own PEM certificate and key</li>
          <li><strong>Redirect</strong> — HTTP to HTTPS redirect</li>
        </ul>

        <h4 class="text-xl font-semibold mt-6">Backups</h4>
        <p class="text-zinc-400">Configure Restic to backup to any S3-compatible storage. Set your endpoint, bucket, access key, and secret key in the backup settings. Run backups manually or on a schedule.</p>

        <h4 class="text-xl font-semibold mt-6">Marketplace</h4>
        <p class="text-zinc-400">One-click deploy from a curated list of 16 open-source apps including Uptime Kuma, Vaultwarden, Plausible, Ghost, Grafana, Nextcloud, Umami, and Appwrite.</p>

        <h4 class="text-xl font-semibold mt-6">Resource Monitor</h4>
        <p class="text-zinc-400">Real-time CPU, memory, disk, and network charts powered by SSE and gopsutil. Updates every second without polling.</p>
      </div>
    )
  },
  {
    id: 'security',
    title: 'Security',
    content: (
      <div class="space-y-6">
        <h3 class="text-2xl font-bold">Security Model</h3>
        <InfoCard title="Non-root user">
          The panel runs as a dedicated <code>panel</code> system user. It only has access to the Docker socket via group membership. No root privileges required.
        </InfoCard>
        <InfoCard title="Per-app SSH keys">
          Each app gets its own read-only Ed25519 deploy key. No long-lived personal access tokens are stored on the server.
        </InfoCard>
        <InfoCard title="Encrypted environment variables">
          Env vars are encrypted with AES-256-GCM before being stored in SQLite. The encryption key is configurable via <code>ENCRYPTION_KEY</code>.
        </InfoCard>
        <InfoCard title="Server-side sessions">
          OAuth tokens are stored server-side in a sync.Map, not in cookies. JWT auth cookies are httpOnly and server-signed with a 7-day expiry.
        </InfoCard>
        <InfoCard title="Caddy handles TLS">
          The panel API only listens on <code>localhost:8080</code>. Caddy terminates TLS and proxies to the backend. No exposed API without TLS.
        </InfoCard>
        <InfoCard title="Allowlist access control">
          Only GitHub usernames listed in the config can log in. No public registration.
        </InfoCard>
      </div>
    )
  },
  {
    id: 'logs',
    title: 'Logs & Troubleshooting',
    content: (
      <div class="space-y-6">
        <h3 class="text-2xl font-bold">Logs & Troubleshooting</h3>

        <h4 class="text-xl font-semibold">View Logs</h4>
        <CodeBlock code="journalctl -u panel -f" />

        <h4 class="text-xl font-semibold mt-6">Common Issues</h4>
        <InfoCard title="Docker permission denied">
          Ensure the <code>panel</code> user is in the <code>docker</code> group and log out/back in:
          <CodeBlock code="sudo usermod -aG docker panel" />
        </InfoCard>
        <InfoCard title="Caddy not proxying">
          Check Caddy is running and the Caddyfile points to <code>localhost:8080</code>:
          <CodeBlock code="sudo systemctl status caddy" />
        </InfoCard>
        <InfoCard title="Build fails with missing Go">
          Install Go 1.22 or newer. The one-command installer handles this automatically.
        </InfoCard>
      </div>
    )
  }
];

function CodeBlock({ code }) {
  return (
    <div class="rounded-lg bg-surface-0 p-4 overflow-x-auto ring-1 ring-white/10">
      <pre class="text-sm font-mono text-zinc-300 whitespace-pre">{code}</pre>
    </div>
  );
}

function EnvTable() {
  const vars = [
    ['GITHUB_CLIENT_ID', 'GitHub OAuth Client ID'],
    ['GITHUB_CLIENT_SECRET', 'GitHub OAuth Client Secret'],
    ['JWT_SECRET', 'JWT signing secret'],
    ['ENCRYPTION_KEY', 'AES key for env var encryption'],
    ['STATIC_DIR', 'Path to built frontend (default: ./static)']
  ];
  return (
    <table class="w-full text-sm border-collapse mt-4">
      <thead>
        <tr class="border-b border-white/10">
          <th class="text-left py-2 pr-4 font-semibold">Variable</th>
          <th class="text-left py-2 font-semibold">Description</th>
        </tr>
      </thead>
      <tbody class="text-zinc-400">
        {vars.map(([name, desc]) => (
          <tr class="border-b border-white/5 last:border-0">
            <td class="py-2 pr-4 font-mono text-zinc-200">{name}</td>
            <td class="py-2">{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InfoCard({ title, children }) {
  return (
    <div class="p-4 rounded-xl border border-white/10 bg-surface-1">
      <h4 class="font-semibold mb-1 text-zinc-100">{title}</h4>
      <div class="text-sm text-zinc-400">{children}</div>
    </div>
  );
}

export function Docs() {
  const [activeId, setActiveId] = useState('install');

  const activeSection = SECTIONS.find((s) => s.id === activeId);

  return (
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="lg:grid lg:grid-cols-4 lg:gap-8">
        {/* Sidebar */}
        <aside class="hidden lg:block">
          <nav class="sticky top-24 space-y-1">
            <p class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Contents</p>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                class={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${activeId === s.id
                  ? 'bg-brand-900/30 text-brand-300'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                {s.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile nav */}
        <div class="lg:hidden mb-6">
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            class="w-full px-3 py-2 rounded-lg border border-white/10 bg-surface-2 text-sm font-medium text-zinc-200"
          >
            {SECTIONS.map((s) => (
              <option value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div class="lg:col-span-3">
          <article class="prose max-w-none">
            {activeSection ? activeSection.content : null}
          </article>
        </div>
      </div>
    </div>
  );
}
