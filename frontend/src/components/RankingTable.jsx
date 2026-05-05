import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Search, Download } from 'lucide-react'
import { scoreTone } from '../lib/utils.js'

function exportCSV(rows, jobId) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [
    ['Rank', 'Candidate', 'Score', 'Summary'].join(','),
    ...rows.map((r) =>
      [r.rank ?? '', escape(r.candidate_name), Math.round(Number(r.score) || 0), escape(r.summary)].join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ranking-job-${jobId}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function normalizeRanking(ranking) {
  if (Array.isArray(ranking)) return ranking
  if (ranking && typeof ranking === 'object') {
    for (const key of ['ranking', 'candidates', 'results', 'rankings', 'rank']) {
      if (Array.isArray(ranking[key])) return ranking[key]
    }
  }
  return []
}

export default function RankingTable({ jobId, ranking, cvs }) {
  const navigate = useNavigate()
  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' })
  const rankingRows = normalizeRanking(ranking)

  const rows = useMemo(() => {
    const enriched = rankingRows.map((r) => {
      const cv = cvs.find(
        (c) =>
          (c.candidate_name || '').toLowerCase() === (r.candidate_name || '').toLowerCase(),
      )
      return { ...r, cv_id: cv?.id }
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...enriched].sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av || '').localeCompare(String(bv || '')) * dir
    })
  }, [rankingRows, cvs, sort])

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  if (rankingRows.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500">
        <Search className="mx-auto mb-2" />
        No ranking yet. Upload CVs and click "Upload & Rank Candidates".
      </div>
    )
  }

  const Th = ({ k, children }) => (
    <th
      onClick={() => toggleSort(k)}
      className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600"
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown size={12} className="opacity-50" />
      </span>
    </th>
  )

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex justify-end">
        <button className="btn-secondary py-1.5 text-xs" onClick={() => exportCSV(rows, jobId)}>
          <Download size={14} /> Export CSV
        </button>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <Th k="rank">Rank</Th>
            <Th k="candidate_name">Candidate</Th>
            <Th k="score">Score</Th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Summary
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={`${r.candidate_name}-${i}`} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-bold text-slate-700">{r.rank ?? i + 1}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{r.candidate_name}</div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`text-xl font-bold ${scoreTone(Number(r.score))}`}>
                    {Math.round(Number(r.score) || 0)}
                  </div>
                  <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-brand-700"
                      style={{ width: `${Math.min(100, Math.max(0, Number(r.score) || 0))}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600 max-w-md">{r.summary}</td>
              <td className="px-4 py-3 text-right">
                <button
                  className="btn-secondary"
                  disabled={!r.cv_id}
                  onClick={() => r.cv_id && navigate(`/jobs/${jobId}/cv/${r.cv_id}`)}
                >
                  Deep Eval
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
