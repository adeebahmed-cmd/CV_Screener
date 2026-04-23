import { Loader2 } from 'lucide-react'

export default function LoadingOverlay({ show, message }) {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm grid place-items-center">
      <div className="bg-white rounded-xl shadow-xl px-8 py-6 flex items-center gap-4 max-w-sm">
        <Loader2 className="animate-spin text-brand-700" size={28} />
        <div>
          <div className="font-semibold text-slate-900">Working locally…</div>
          <div className="text-sm text-slate-600">{message}</div>
        </div>
      </div>
    </div>
  )
}
