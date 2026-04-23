import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Printer, Sparkles } from 'lucide-react'
import CategoryRadar from '../components/CategoryRadar.jsx'
import LoadingOverlay from '../components/LoadingOverlay.jsx'
import { api } from '../api.js'
import { scoreTone } from '../lib/utils.js'

export default function CVDetail() {
  const { id, cvId } = useParams()
  const [cv, setCV] = useState(null)
  const [evaluation, setEvaluation] = useState(null)
  const [evaluating, setEvaluating] = useState(false)

  async function load() {
    const data = await api.getCV(cvId)
    setCV(data)
    setEvaluation(data.latest_evaluation)
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message))
  }, [cvId])

  async function runEvaluation() {
    try {
      setEvaluating(true)
      const result = await api.evaluateCV(cvId)
      setEvaluation(result)
      toast.success('Evaluation complete.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setEvaluating(false)
    }
  }

  if (!cv) return <div className="text-slate-500">Loading…</div>

  const score = Number(evaluation?.final_score || 0)
  const matched = evaluation?.matched_keywords || []
  const missing = evaluation?.missing_keywords || []

  return (
    <div className="space-y-6">
      <LoadingOverlay
        show={evaluating}
        message="Running deep evaluation with local LLM… this can take 30–90 seconds."
      />

      <div className="no-print">
        <Link
          to={`/jobs/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-2"
        >
          <ArrowLeft size={14} /> Back to job
        </Link>
      </div>

      <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Candidate</div>
          <h1 className="text-2xl font-bold text-slate-900">{cv.candidate_name || cv.filename}</h1>
          {cv.filename && cv.filename !== cv.candidate_name && (
            <div className="text-xs text-slate-500 mt-1">Source: {cv.filename}</div>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Final score</div>
            <div className={`text-5xl font-extrabold ${scoreTone(score)}`}>
              {Math.round(score) || '—'}
            </div>
          </div>
          <div className="flex flex-col gap-2 no-print">
            <button className="btn-primary" onClick={runEvaluation} disabled={evaluating}>
              <Sparkles size={16} /> {evaluation ? 'Re-run' : 'Run'} Deep Eval
            </button>
            <button className="btn-secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print / Export PDF
            </button>
          </div>
        </div>
      </div>

      {!evaluation ? (
        <div className="card p-8 text-center text-slate-500">
          No evaluation yet. Click "Run Deep Eval" to generate one.
        </div>
      ) : (
        <>
          <div className="card p-5">
            <h2 className="font-semibold text-slate-900 mb-2">Category breakdown</h2>
            <CategoryRadar scores={evaluation.category_scores || {}} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-semibold text-emerald-700 mb-3">
                Matched keywords ({matched.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {matched.length === 0 && (
                  <span className="text-sm text-slate-500">No matches identified.</span>
                )}
                {matched.map((m, i) => (
                  <span key={i} className="chip-green" title={`${m.match_type} · ${m.score}`}>
                    {m.keyword}
                  </span>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-rose-700 mb-3">
                Missing keywords ({missing.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {missing.length === 0 && (
                  <span className="text-sm text-slate-500">Nothing missing — strong match.</span>
                )}
                {missing.map((m, i) => (
                  <span
                    key={i}
                    className={m.type === 'must-have' ? 'chip-red' : 'chip-amber'}
                    title={m.type}
                  >
                    {m.keyword}
                    <span className="opacity-60 ml-1">· {m.type}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-2">Experience assessment</h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {evaluation.experience_assessment || '—'}
            </p>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-2">Explanation</h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {evaluation.explanation || '—'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
