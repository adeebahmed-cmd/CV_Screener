import { useMemo, useState, useEffect } from 'react'
import { Plus, Trash2, Library, X, Check } from 'lucide-react'
import { api } from '../api.js'

const DEGREE_OPTIONS = ['', "Certificate", "Diploma", "Bachelor's", "Master's", "PhD"]

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
  const [draft, setDraft] = useState({
    keyword: '',
    category: CATEGORIES[0],
    weight: 5,
    type: 'must-have',
  })

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

  function addKeyword() {
    const keyword = draft.keyword.trim()
    if (!keyword) return
    onChange({
      ...model,
      keywords: [
        ...(model.keywords || []),
        {
          keyword,
          category: draft.category,
          weight: Number(draft.weight) || 5,
          type: draft.type,
        },
      ],
    })
    setDraft({
      keyword: '',
      category: draft.category,
      weight: 5,
      type: 'must-have',
    })
  }

  const catOrder = [...CATEGORIES, ...Object.keys(grouped).filter((c) => !CATEGORIES.includes(c))]

  // --- Import from Repository ---
  const [showImport, setShowImport]       = useState(false)
  const [repoKeywords, setRepoKeywords]   = useState([])
  const [selected, setSelected]           = useState(new Set())
  const [repoFilter, setRepoFilter]       = useState('')

  async function openImport() {
    try {
      const data = await api.listRepository({ status: 'approved' })
      // Remove keywords already in the job
      const existing = new Set((model.keywords || []).map((k) => k.keyword.toLowerCase()))
      setRepoKeywords(data.filter((k) => !existing.has(k.keyword.toLowerCase())))
      setSelected(new Set())
      setRepoFilter('')
      setShowImport(true)
    } catch { /* silently ignore */ }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function importSelected() {
    const toAdd = repoKeywords
      .filter((k) => selected.has(k.id))
      .map(({ keyword, category, weight, kw_type }) => ({ keyword, category, weight, type: kw_type }))
    onChange({ ...model, keywords: [...(model.keywords || []), ...toAdd] })
    setShowImport(false)
  }

  const filteredRepo = repoKeywords.filter((k) =>
    !repoFilter || k.keyword.toLowerCase().includes(repoFilter.toLowerCase()) ||
    k.category.toLowerCase().includes(repoFilter.toLowerCase())
  )

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

      {/* Education Requirements */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Education Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Minimum Degree</label>
            <select
              className="input"
              value={model.education_requirements?.minimum_degree || ''}
              onChange={(e) =>
                updateMeta({
                  education_requirements: {
                    ...model.education_requirements,
                    minimum_degree: e.target.value,
                  },
                })
              }
            >
              {DEGREE_OPTIONS.map((d) => (
                <option key={d} value={d}>{d || '— Not specified —'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Preferred Degree</label>
            <select
              className="input"
              value={model.education_requirements?.preferred_degree || ''}
              onChange={(e) =>
                updateMeta({
                  education_requirements: {
                    ...model.education_requirements,
                    preferred_degree: e.target.value,
                  },
                })
              }
            >
              {DEGREE_OPTIONS.map((d) => (
                <option key={d} value={d}>{d || '— Not specified —'}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">
            Fields of Study
            <span className="ml-1 text-slate-400 font-normal">(comma-separated)</span>
          </label>
          <input
            className="input"
            placeholder="e.g. Public Health, Social Work, Development Studies"
            value={Array.isArray(model.education_requirements?.fields)
              ? model.education_requirements.fields.join(', ')
              : (model.education_requirements?.fields || '')}
            onChange={(e) => {
              const fields = e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
              updateMeta({
                education_requirements: {
                  ...model.education_requirements,
                  fields,
                },
              })
            }}
          />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Add Keyword</h3>
          <div className="flex gap-2">
            <button className="btn-secondary" type="button" onClick={openImport}>
              <Library size={15} /> Import from Repository
            </button>
            <button className="btn-primary" type="button" onClick={addKeyword} disabled={!draft.keyword.trim()}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="label">Keyword</label>
            <input
              className="input"
              value={draft.keyword}
              onChange={(e) => setDraft((d) => ({ ...d, keyword: e.target.value }))}
              placeholder="Add a missing keyword"
            />
          </div>
          <div className="md:col-span-3">
            <label className="label">Category</label>
            <select
              className="input"
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Weight</label>
            <input
              type="number"
              min="1"
              max="10"
              className="input"
              value={draft.weight}
              onChange={(e) => setDraft((d) => ({ ...d, weight: Number(e.target.value) }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Type</label>
            <select
              className="input"
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
            >
              <option value="must-have">must-have</option>
              <option value="good-to-have">good-to-have</option>
            </select>
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

      {/* Import from Repository modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Import from Repository</h3>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-100">
              <input
                className="input"
                placeholder="Search keywords or categories…"
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
                autoFocus
              />
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {filteredRepo.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  {repoKeywords.length === 0
                    ? 'No approved keywords in repository yet.'
                    : 'No keywords match your search.'}
                </div>
              ) : (
                filteredRepo.map((k) => (
                  <label
                    key={k.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="accent-brand-700"
                      checked={selected.has(k.id)}
                      onChange={() => toggleSelect(k.id)}
                    />
                    <span className="font-medium text-slate-900 flex-1">{k.keyword}</span>
                    <span className="text-xs text-slate-500">{k.category}</span>
                    <span className="text-xs font-medium w-4 text-right text-slate-600">{k.weight}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                      k.kw_type === 'must-have'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      {k.kw_type}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                {selected.size} keyword{selected.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
                <button
                  className="btn-primary"
                  disabled={selected.size === 0}
                  onClick={importSelected}
                >
                  <Check size={15} /> Import Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
