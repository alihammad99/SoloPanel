export function Terminal({ lines }) {
  return (
    <div class="rounded-xl bg-surface-0 shadow-2xl overflow-hidden ring-1 ring-brand-500/20">
      <div class="flex items-center gap-2 px-4 py-3 bg-surface-1 border-b border-white/10">
        <div class="w-3 h-3 rounded-full bg-red-500"></div>
        <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div class="w-3 h-3 rounded-full bg-green-500"></div>
        <span class="ml-2 text-xs text-zinc-500 font-mono">bash</span>
      </div>
      <div class="p-4 text-left font-mono text-sm overflow-x-auto space-y-1">
        {lines.map((line) => (
          <div class={line.class || 'text-slate-300'}>{line.text}</div>
        ))}
      </div>
    </div>
  );
}
