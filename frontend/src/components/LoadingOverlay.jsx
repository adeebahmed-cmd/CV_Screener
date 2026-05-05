import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function LoadingOverlay({ show, message }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!show) {
      setElapsed(0)
      return
    }
    setElapsed(0)
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [show])

  if (!show) return null
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm grid place-items-center">
      <div className="bg-white rounded-xl shadow-xl px-8 py-6 flex items-center gap-4 max-w-sm">
        <Loader2 className="animate-spin text-brand-700 shrink-0" size={28} />
        <div>
          <div className="font-semibold text-slate-900">Working locally…</div>
          <div className="text-sm text-slate-600">{message}</div>
          {elapsed >= 5 && (
            <div className="text-xs text-slate-400 mt-1">{elapsed}s elapsed</div>
          )}
        </div>
      </div>
    </div>
  )
}
