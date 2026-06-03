import { useState, useEffect, useRef } from 'preact/hooks'
import { Cpu, MemoryStick, HardDrive, Wifi } from 'lucide-preact'
import { streamSSE } from '../api/client'

function SparkLine({ data, color = '#2563eb', height = 32 }) {
  const max = Math.max(...data, 1)
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = height - (v / max) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 100 ${height}`} class="w-full" preserveAspectRatio="none" style={{ height }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polygon
        points={`0,${height} ${points} 100,${height}`}
        fill={color}
        opacity="0.08"
      />
    </svg>
  )
}

function fmt(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return (bytes / 1e3).toFixed(0) + ' KB'
}

function MetricCard({ icon: Icon, label, value, sub, history, color }) {
  return (
    <div class="card flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="p-1.5 rounded-lg" style={{ background: color + '18' }}>
            <Icon size={14} style={{ color }} />
          </div>
          <span class="text-xs font-medium text-panel-muted uppercase tracking-wide">{label}</span>
        </div>
        <span class="text-lg font-semibold text-white">{value}</span>
      </div>
      {history.length > 1 && <SparkLine data={history} color={color} />}
      {sub && <div class="text-xs text-panel-muted">{sub}</div>}
    </div>
  )
}

const MAX_HISTORY = 30

export function ResourceMonitor() {
  const [metrics, setMetrics] = useState(null)
  const history = useRef({ cpu: [], mem: [], disk: [] })

  useEffect(() => {
    const stop = streamSSE('/metrics/stream', (data) => {
      try {
        const m = JSON.parse(data)
        setMetrics(m)
        const h = history.current
        h.cpu = [...h.cpu.slice(-(MAX_HISTORY - 1)), m.cpu]
        h.mem = [...h.mem.slice(-(MAX_HISTORY - 1)), m.mem_pct]
        h.disk = [...h.disk.slice(-(MAX_HISTORY - 1)), m.disk_pct]
      } catch {}
    })
    return stop
  }, [])

  if (!metrics) {
    return (
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} class="card h-24 animate-pulse bg-panel-border/20" />
        ))}
      </div>
    )
  }

  const prevNet = useRef({ sent: 0, recv: 0 })
  const netSentDelta = metrics.net_sent - prevNet.current.sent
  const netRecvDelta = metrics.net_recv - prevNet.current.recv
  prevNet.current = { sent: metrics.net_sent, recv: metrics.net_recv }

  return (
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        icon={Cpu}
        label="CPU"
        value={metrics.cpu.toFixed(1) + '%'}
        history={history.current.cpu}
        color="#2563eb"
      />
      <MetricCard
        icon={MemoryStick}
        label="Memory"
        value={metrics.mem_pct.toFixed(1) + '%'}
        sub={fmt(metrics.mem_used) + ' / ' + fmt(metrics.mem_total)}
        history={history.current.mem}
        color="#22c55e"
      />
      <MetricCard
        icon={HardDrive}
        label="Disk"
        value={metrics.disk_pct.toFixed(1) + '%'}
        sub={fmt(metrics.disk_used) + ' / ' + fmt(metrics.disk_total)}
        history={history.current.disk}
        color="#f59e0b"
      />
      <MetricCard
        icon={Wifi}
        label="Network"
        value={fmt(netRecvDelta) + '/s'}
        sub={'↑ ' + fmt(netSentDelta) + '/s'}
        history={[]}
        color="#38bdf8"
      />
    </div>
  )
}
