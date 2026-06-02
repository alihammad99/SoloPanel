export function FeatureCard({ icon, title, description }) {
  return (
    <div class="card-hover p-6 rounded-2xl border border-white/10 bg-surface-1">
      <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-900/50 to-surface-0 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 class="font-semibold text-lg mb-2 text-zinc-100">{title}</h3>
      <p class="text-zinc-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
