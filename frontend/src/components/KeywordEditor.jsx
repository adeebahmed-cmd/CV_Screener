import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'

const CATEGORIES = [
  'Domain',
  'Capability',
  'Leadership',
  'Finance & Governance',
  'Research & Innovation',
  'Learning & Development',
  'Tools / Systems',
  'Soft Skills',
]

export default function KeywordEditor({ model, onChange }) {
  const grouped = useMemo(() => {
    const map = {}
    ;(model?.keywords || []).forEach((k, idx) => {
      const cat = k.category || 'Uncategorized'
      map[cat] = map[cat] || []
      map[cat].push({ ...k, _idx: idx })
    })
    return map
  }, [model])

  function updateKeyword(idx, patch) {
    const next = { ...model, keywords: model.keywords.map((k, i) => (i === idx ? { ...k, ...patch } : k)) }
    onChange(next)
  }

  function removeKeyword(idx) {
    onChange({ ...model, keywords: model.keywords.filter((_, i) => i !== idx) })
  }

  function updateMeta(patch) {
    onChange({ ...model, ...patch })
  }

  const catOrder = [...CATEGORIES, ...Object.keys(grouped).filter((c) => !CATEGORIES.includes(c))]

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Role</label>
            <input
              className="input"
              value={model.role || ''}
              onChange={(e) => updateMeta({ role: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Experience Required</label>
            <input
              className="input"
              value={model.experience_required || ''}
              onChange={(e) => updateMeta({ experience_required: e.target.value })}
            />
          </div>
        </div>
      </div>

      {catOrder.map((cat) => {
        const items = grouped[cat]
        if (!items || items.length === 0) return null
        return (
          <div key={cat} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">{cat}</h3>
              <span className="text-xs text-slate-500">{items.length} keyword{items.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {items.map((k) => (
                <div
                  key={k._idx}
                  className="grid grid-cols-12 gap-3 items-center border border-slate-100 rounded-lg p-3"
                >
                  <div className="col-span-12 md:col-span-5">
                    <input
                      className="input"
                      value={k.keyword || ''}
                      onChange={(e) => updateKeyword(k._idx, { keyword: e.target.value })}
                    />
                  </div>
                  <div className="col-span-8 md:col-span-4 flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={k.weight || 1}
                      onChange={(e) => updateKeyword(k._idx, { weight: Number(e.target.value) })}
                      className="w-full accent-brand-700"
                    />
                    <span className="text-sm font-semibold w-6 text-right">{k.weight}</span>
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <select
                      className="input"
                      value={k.type || 'must-have'}
                      onChange={(e) => updateKeyword(k._idx, { type: e.target.value })}
                    >
                      <option value="must-have">must-have</option>
                      <option value="good-to-have">good-to-have</option>
                    </select>
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => removeKeyword(k._idx)}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
