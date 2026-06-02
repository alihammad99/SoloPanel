import { useState } from 'preact/hooks';
import { Link } from 'preact-router/match';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav class="fixed top-0 w-full z-50 glass border-b border-white/10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <a href="/" class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.54 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7" />
              </svg>
            </div>
            <span class="font-bold text-lg tracking-tight gradient-text">SoloPanel</span>
          </a>

          <div class="hidden md:flex items-center gap-8">
            <a href="/#features" class="text-sm font-medium text-zinc-400 hover:text-white transition">Features</a>
            <a href="/#security" class="text-sm font-medium text-zinc-400 hover:text-white transition">Security</a>
            <Link activeClassName="text-brand-400" href="/docs" class="text-sm font-medium text-zinc-400 hover:text-white transition">Documentation</Link>
            <a href="https://github.com/your-org/panel" target="_blank" class="text-sm font-medium text-zinc-400 hover:text-white transition">GitHub</a>
          </div>

          <div class="flex items-center gap-3">
            <Link href="/docs" class="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-surface-2 border border-white/10 rounded-lg hover:bg-surface-3 hover:text-white transition">Docs</Link>
            <a href="/#install" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-black gradient-bg rounded-lg hover:opacity-90 transition shadow-lg shadow-brand-500/20">Get Started</a>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              class="md:hidden p-2 text-zinc-400 hover:text-white"
              aria-label="Toggle menu"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div class="md:hidden border-t border-white/10 bg-surface-0">
          <div class="px-4 py-3 space-y-2">
            <a href="/#features" onClick={() => setMenuOpen(false)} class="block text-sm font-medium text-zinc-400 hover:text-white py-2">Features</a>
            <a href="/#security" onClick={() => setMenuOpen(false)} class="block text-sm font-medium text-zinc-400 hover:text-white py-2">Security</a>
            <Link href="/docs" onClick={() => setMenuOpen(false)} class="block text-sm font-medium text-zinc-400 hover:text-white py-2">Documentation</Link>
            <a href="https://github.com/your-org/panel" target="_blank" class="block text-sm font-medium text-zinc-400 hover:text-white py-2">GitHub</a>
          </div>
        </div>
      )}
    </nav>
  );
}
