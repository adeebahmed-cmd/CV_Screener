import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Search, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { scoreTone } from '../lib/utils.js'
import { api } from '../api.js'

const DECISION_OPTIONS = [
  { value: 'pending',     label: 'Pending',     cls: 'bg-slate-100 text-slate-600' },
  { value: 'shortlisted', label: 'Shortlisted', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'hold',        label: 'Hold',        cls: 'bg-amber-100 text-amber-700' },
  { value: 'rejected',    label: 'Rejected',    cls: 'bg-rose-100 text-rose-700' },
]

function DecisionBadge({ value }) {
  const opt = DECISION_OPTIONS.find((o) => o.value === value) || DECISION_OPTIONS[0]
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${opt.cls}`}>
      {opt.label}
    </span>
  )
}

function exportCSV(rows, jobId, decisions) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [
    ['Rank', 'Candidate', 'Score', 'Decision', 'Summary'].join(','),
    ...rows.map((r) => {
      const dec = decisions[r.candidate_name]?.decision || 'pending'
      return [r.rank ?? '', escape(r.candidate_name), Math.round(Number(r.score) || 0), dec, escape(r.summary)].join(',')
    }),
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

const TIER_STYLES = {
  exact:   { label: 'Exact',   cls: 'bg-emerald-100 text-emerald-800' },
  tokens:  { label: 'Partial', cls: 'bg-blue-100 text-blue-800' },
  synonym: { label: 'Synonym', cls: 'bg-violet-100 text-violet-800' },
  stem:    { label: 'Stem',    cls: 'bg-amber-100 text-amber-800' },
}

const CONFIDENCE_STYLES = {
  high:   { label: 'High confidence',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medium: { label: 'Medium confidence', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  low:    { label: 'Low confidence',    cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  none:   { label: 'No matches',        cls: 'bg-slate-50 text-slate-500 border-slate-200' },
}

function ConfidenceBadge({ confidence }) {
  const style = CONFIDENCE_STYLES[confidence]
  if (!style) return null
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${style.cls}`}>
      {style.label}
    </span>
  )
}

function TierBadge({ tier }) {
  const style = TIER_STYLES[tier] || { label: tier, cls: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${style.cls}`}>
      {style.label}
    </span>
  )
}

function MatchDetails({ details }) {
  if (!details) return null
  const {
    matched_keywords = [],
    missing_must = [],
    missing_good = [],
    experience_note,
    education_note,
    parse_warning,
  } = details

  return (
    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 space-y-3 text-sm">
      {/* Parse warning */}
      {parse_warning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="text-amber-500 text-xs font-semibold uppercase tracking-wide shrink-0">Warning</span>
          <p className="text-amber-700 text-xs">{parse_warning}</p>
        </div>
      )}

      {/* Matched */}
      {matched_keywords.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Matched Keywords
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matched_keywords.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2.5 py-0.5 text-slate-700 text-xs">
                {m.keyword}
                <TierBadge tier={m.tier} />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing must-haves */}
      {missing_must.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-rose-500 uppercase tracking-wide mb-1.5">
            Missing Must-Haves
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missing_must.map((k, i) => (
              <span key={i} className="bg-rose-50 border border-rose-200 text-rose-700 rounded-full px-2.5 py-0.5 text-xs">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing good-to-haves */}
      {missing_good.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-1.5">
            Missing Good-to-Haves
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missing_good.map((k, i) => (
              <span key={i} className="bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2.5 py-0.5 text-xs">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Experience & education notes */}
      {(experience_note || education_note) && (
        <div className="space-y-1 border-t border-slate-200 pt-2">
          {experience_note && (
            <p className="text-slate-500 italic text-xs">
              <span className="font-semibold not-italic text-slate-600">Experience: </span>
              {experience_note}
            </p>
          )}
          {education_note && (
            <p className="text-slate-500 italic text-xs">
              <span className="font-semibold not-italic text-slate-600">Education: </span>
              {education_note}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function RankingTable({ jobId, ranking, cvs }) {
  const navigate = useNavigate()
  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' })
  const [expanded, setExpanded] = useState(null)
  const [decisions, setDecisions] = useState({})
  const rankingRows = normalizeRanking(ranking)

  useEffect(() => {
    if (jobId) {
      api.getDecisions(jobId).then(setDecisions).catch(() => {})
    }
  }, [jobId])

  const updateDecision = useCallback(async (candidateName, decision) => {
    setDecisions((prev) => ({
      ...prev,
      [candidateName]: { ...(prev[candidateName] || {}), decision },
    }))
    await api.setDecision(jobId, candidateName, decision).catch(() => {})
  }, [jobId])

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

  function toggleExpanded(rowKey) {
    setExpanded((prev) => (prev === rowKey ? null : rowKey))
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
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
        {/* Decision summary */}
        <div className="flex items-center gap-3 text-xs text-slate-600">
          {DECISION_OPTIONS.filter((o) => o.value !== 'pending').map((opt) => {
            const count = rows.filter((r) => (decisions[r.candidate_name]?.decision || 'pending') === opt.value).length
            return count > 0 ? (
              <span key={opt.value} className={`px-2 py-0.5 rounded-full font-medium ${opt.cls}`}>
                {count} {opt.label}
              </span>
            ) : null
          })}
        </div>
        <button className="btn-secondary py-1.5 text-xs shrink-0" onClick={() => exportCSV(rows, jobId, decisions)}>
          <Download size={14} /> Export CSV
        </button>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <Th k="rank">Rank</Th>
            <Th k="candidate_name">Candidate</Th>
            <Th k="score">Score</Th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Decision</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Summary</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            const rowKey = `${r.candidate_name}-${i}`
            const isExpanded = expanded === rowKey
            return (
              <>
                <tr key={rowKey} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-700">{r.rank ?? i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.candidate_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
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
                      {r.match_details?.confidence && (
                        <ConfidenceBadge confidence={r.match_details.confidence} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                      value={decisions[r.candidate_name]?.decision || 'pending'}
                      onChange={(e) => updateDecision(r.candidate_name, e.target.value)}
                    >
                      {DECISION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-md">{r.summary}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.match_details && (
                        <button
                          className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"
                          onClick={() => toggleExpanded(rowKey)}
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          Details
                        </button>
                      )}
                      <button
                        className="btn-secondary"
                        disabled={!r.cv_id}
                        onClick={() => r.cv_id && navigate(`/jobs/${jobId}/cv/${r.cv_id}`)}
                      >
                        Deep Eval
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${rowKey}-details`}>
                    <td colSpan={6} className="p-0">
                      <MatchDetails details={r.match_details} />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
