import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, Clock, Search, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api.js'
import { useAuth } from '../contexts/AuthContext.jsx'

const CATEGORIES = [
  'Domain', 'Capability', 'Leadership', 'Finance & Governance',
  'Research & Innovation', 'Learning & Development', 'Tools / Systems', 'Soft Skills',
]

const STATUS_BADGE = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending:  'bg-amber-50  text-amber-700  border-amber-200',
}

const BLANK_DRAFT = { keyword: '', category: CATEGORIES[0], weight: 5, kw_type: 'good-to-have', synonyms: '' }

export default function Repository() {
  const { isAdmin } = useAuth()
  const [keywords, setKeywords] = useState([])
  const [filter, setFilter]     = useState({ status: '', category: '', q: '' })
  const [draft, setDraft]       = useState(BLANK_DRAFT)
  const [showAdd, setShowAdd]   = useState(false)

  async function load() {
    try {
      const data = await api.listRepository({ status: filter.status, category: filter.category })
      setKeywords(data)
    } catch (e) {
      toast.error(e.message || 'Could not load repository')
    }
  }

  useEffect(() => { load() }, [filter.status, filter.category])

  async function handleAdd() {
    const kw = draft.keyword.trim()
    if (!kw) return
    try {
      await api.createKeyword({
        keyword: kw,
        category: draft.category,
        weight: Number(draft.weight),
        kw_type: draft.kw_type,
        synonyms: draft.synonyms.split(',').map((s) => s.trim()).filter(Boolean),
      })
      toast.success(`"${kw}" added${isAdmin ? ' (approved)' : ' (pending approval)'}`)
      setDraft(BLANK_DRAFT)
      setShowAdd(false)
      load()
    } catch (e) {
      toast.error(e.message || 'Failed to add keyword')
    }
  }

  async function handleApprove(id) {
    try {
      await api.approveKeyword(id)
      toast.success('Keyword approved')
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function handleDelete(id, kw) {
    if (!window.confirm(`Delete "${kw}" from repository?`)) return
    try {
      await api.deleteKeyword(id)
      toast.success('Deleted')
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const visible = keywords.filter((k) =>
    !filter.q || k.keyword.toLowerCase().includes(filter.q.toLowerCase())
  )

  const pending  = visible.filter((k) => k.status === 'pending').length
  const approved = visible.filter((k) => k.status === 'approved').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Keyword Repository</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Shared keyword library · {approved} approved · {pending} pending
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd((v) => !v)}>
          <Plus size={16} /> Add Keyword
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-900">New Keyword</h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <label className="label">Keyword</label>
              <input className="input" value={draft.keyword}
                onChange={(e) => setDraft((d) => ({ ...d, keyword: e.target.value }))}
                placeholder="e.g. Budget Management" />
            </div>
            <div className="md:col-span-3">
              <label className="label">Category</label>
              <select className="input" value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="label">Weight</label>
              <input type="number" min="1" max="10" className="input" value={draft.weight}
                onChange={(e) => setDraft((d) => ({ ...d, weight: Number(e.target.value) }))} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Type</label>
              <select className="input" value={draft.kw_type}
                onChange={(e) => setDraft((d) => ({ ...d, kw_type: e.target.value }))}>
                <option value="must-have">must-have</option>
                <option value="good-to-have">good-to-have</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="label">Synonyms <span className="text-slate-400 font-normal">(comma-separated)</span></label>
              <input className="input" value={draft.synonyms}
                onChange={(e) => setDraft((d) => ({ ...d, synonyms: e.target.value }))}
                placeholder="e.g. Budget Planning, Cost Management" />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleAdd} disabled={!draft.keyword.trim()}>
              <Plus size={14} /> {isAdmin ? 'Add & Approve' : 'Submit for Approval'}
            </button>
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2 flex-1 min-w-40">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input className="input py-1.5" placeholder="Search keywords…"
            value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select className="input py-1.5" value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <select className="input py-1.5" value={filter.category}
          onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No keywords found. {isAdmin ? 'Add some above.' : 'Admins need to add keywords.'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Keyword', 'Category', 'Weight', 'Type', 'Synonyms', 'Status', 'Added by', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((k) => (
                <tr key={k.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{k.keyword}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{k.category}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{k.weight}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      k.kw_type === 'must-have'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {k.kw_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                    {(k.synonyms || []).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[k.status]}`}>
                      {k.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{k.created_by || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin && k.status === 'pending' && (
                        <button
                          onClick={() => handleApprove(k.id)}
                          className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                          title="Approve"
                        >
                          <Check size={15} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(k.id, k.keyword)}
                          className="p-1.5 rounded hover:bg-rose-50 text-rose-500"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
