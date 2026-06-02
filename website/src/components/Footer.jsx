export function Footer() {
  return (
    <footer class="border-t border-white/10 bg-surface-1 py-12">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-3 gap-8">
          <div>
            <div class="flex items-center gap-2 mb-4">
              <div class="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.54 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7" />
                </svg>
              </div>
              <span class="font-bold text-base gradient-text">SoloPanel</span>
            </div>
            <p class="text-sm text-zinc-500">Self-hosted deployment platform for your VPS.</p>
          </div>
          <div>
            <h4 class="font-semibold text-sm mb-4">Project</h4>
            <ul class="space-y-2">
              <li><a href="/" class="text-sm text-zinc-500 hover:text-white transition">Home</a></li>
              <li><a href="/docs" class="text-sm text-zinc-500 hover:text-white transition">Documentation</a></li>
              <li><a href="https://github.com/your-org/panel" target="_blank" class="text-sm text-zinc-500 hover:text-white transition">GitHub</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-semibold text-sm mb-4">Legal</h4>
            <ul class="space-y-2">
              <li><span class="text-sm text-zinc-500">Open Source — MIT License</span></li>
            </ul>
          </div>
        </div>
        <div class="mt-10 pt-8 border-t border-slate-100 text-center">
          <p class="text-sm text-zinc-500">SoloPanel. Open source, self-hosted.</p>
        </div>
      </div>
    </footer>
  );
}
