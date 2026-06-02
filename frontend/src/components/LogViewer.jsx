import { useState, useEffect, useRef } from 'preact/hooks'
import { streamSSE } from '../api/client'

function LogLine({ line }) {
  const cls = line.includes('[error]') || line.toLowerCase().includes('error')
    ? 'text-panel-danger'
    : line.includes('complete') || line.includes('success') || line.includes('✓')
      ? 'text-panel-success'
      : line.startsWith('[') || line.startsWith('>')
        ? 'text-panel-muted'
        : 'text-gray-300'
  return <div class={`leading-5 whitespace-pre-wrap break-all ${cls}`}>{line}</div>
}

export function LogViewer({ path, onDone }) {
  const [lines, setLines] = useState([])
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!path) return
    setLines([])
    setDone(false)
    setLoading(true)

    // First try a plain fetch — completed deployments return JSON
    fetch('/api' + path, { credentials: 'include' })
      .then(async res => {
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          // Completed deployment — show stored log
          const data = await res.json()
          const logLines = (data.log || '').split('\n').filter(Boolean)
          setLines(logLines)
          setDone(true)
          setLoading(false)
          if (onDone) onDone()
        } else {
          // Live deployment — switch to SSE
          setLoading(false)
          const stop = streamSSE(path, (data) => {
            setLines(prev => [...prev, data])
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, () => {
            setDone(true)
            if (onDone) onDone()
          })
          return stop
        }
      })
      .catch(() => {
        setLoading(false)
        setDone(true)
      })
  }, [path])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  return (
    <div class="bg-[#0d0f16] rounded-lg border border-panel-border font-mono text-xs overflow-auto max-h-96">
      <div class="flex items-center justify-between px-3 py-2 border-b border-panel-border">
        <span class="text-panel-muted">deployment log</span>
        <span class={`text-xs px-2 py-0.5 rounded-full border ${loading ? 'text-panel-muted border-panel-border' :
            done ? 'text-panel-muted border-panel-border' :
              'text-panel-success border-panel-success/30 bg-panel-success/5'
          }`}>
          {loading ? 'loading…' : done ? 'done' : '● live'}
        </span>
      </div>
      <div class="p-3 space-y-0.5">
        {loading && <div class="text-panel-muted animate-pulse">Loading logs…</div>}
        {!loading && lines.length === 0 && <div class="text-panel-muted">No logs yet.</div>}
        {lines.map((line, i) => <LogLine key={i} line={line} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
