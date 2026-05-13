import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BarChart3, FileUser, Briefcase, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { api } from '../api.js'

function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colors = {
    brand:   'bg-brand-50 text-brand-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    amber:   'bg-amber-50 text-amber-800',
    rose:    'bg-rose-50 text-rose-800',
    slate:   'bg-slate-100 text-slate-700',
  }
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

const DIST_COLORS = ['#f87171', '#fb923c', '#60a5fa', '#34d399']

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAnalytics()
      .then(setData)
      .catch((e) => toast.error(e.message || 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-slate-500">Loading…</div>
  if (!data) return null

  const { totals, avg_score, score_distribution, top_missing_keywords, llm } = data
  const failRate = llm.total_calls > 0 ? ((llm.failed_calls / llm.total_calls) * 100).toFixed(1) : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-600 mt-1">Aggregated stats across all jobs and rankings.</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Briefcase}     label="Total Jobs"       value={totals.jobs}   color="brand" />
        <StatCard icon={FileUser}      label="CVs Uploaded"     value={totals.cvs}    color="brand" />
        <StatCard icon={BarChart3}     label="CVs Ranked"       value={totals.ranked} color="emerald" />
        <StatCard icon={CheckCircle2}  label="Avg Score"        value={avg_score}     sub="across all ranked CVs" color="emerald" />
      </div>

      {/* Score distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Score Distribution</h2>
          {totals.ranked === 0 ? (
            <div className="text-sm text-slate-400 py-8 text-center">No ranked CVs yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={score_distribution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [v, 'Candidates']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {score_distribution.map((_, i) => (
                    <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top missing keywords */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Top Missing Must-Have Keywords</h2>
          {top_missing_keywords.length === 0 ? (
            <div className="text-sm text-slate-400 py-8 text-center">No data yet.</div>
          ) : (
            <div className="space-y-2">
              {top_missing_keywords.map(({ keyword, count }, i) => {
                const max = top_missing_keywords[0].count
                const pct = Math.round((count / max) * 100)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="text-xs text-slate-600 w-36 truncate shrink-0">{keyword}</div>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-rose-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-slate-500 w-6 text-right shrink-0">{count}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* LLM stats */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">LLM Usage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BarChart3}    label="Total Calls"       value={llm.total_calls}              color="slate" />
          <StatCard icon={Clock}        label="Last 7 Days"       value={llm.last_7d_calls}            color="brand" />
          <StatCard icon={AlertCircle}  label="Failed Calls"      value={llm.failed_calls} sub={`${failRate}% fail rate`} color={llm.failed_calls > 0 ? 'rose' : 'emerald'} />
          <StatCard icon={CheckCircle2} label="Avg Latency"       value={`${llm.avg_latency_ms} ms`}  color="slate" />
        </div>
      </div>
    </div>
  )
}
