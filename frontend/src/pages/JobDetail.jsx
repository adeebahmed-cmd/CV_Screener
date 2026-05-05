import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, BarChart3, Trash2, RefreshCw } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import FileDropzone from '../components/FileDropzone.jsx'
import RankingTable from '../components/RankingTable.jsx'
import LoadingOverlay from '../components/LoadingOverlay.jsx'
import { api } from '../api.js'
import { formatDate } from '../lib/utils.js'

export default function JobDetail() {
  const { id } = useParams()
  const location = useLocation()
  const rerankFlagRef = useRef(false)
  const [job, setJob] = useState(null)
  const [cvFiles, setCvFiles] = useState([])
  const [loadingMsg, setLoadingMsg] = useState(null)
  const [cvDeleteConfirm, setCvDeleteConfirm] = useState(null)
  const [rerankBanner, setRerankBanner] = useState(false)

  async function refresh() {
    const j = await api.getJob(id)
    setJob(j)
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e.message))
  }, [id])

  useEffect(() => {
    if (!rerankFlagRef.current && job && location.state?.needsRerank && job.latest_ranking) {
      setRerankBanner(true)
      rerankFlagRef.current = true
    }
  }, [job])

  async function uploadAndRank() {
    let uploaded = false
    try {
      if (cvFiles.length > 0) {
        setLoadingMsg('Parsing and storing CVs…')
        await api.uploadCVs(id, cvFiles)
        setCvFiles([])
        uploaded = true
        await refresh()
      } else if (job.cvs.length === 0) {
        toast.error('Pick at least one CV.')
        return
      }
      setLoadingMsg('Ranking candidates against job model… this may take a minute.')
      await api.rank(id)
      toast.success('Ranking complete.')
      await refresh()
    } catch (e) {
      if (uploaded) {
        toast.error(`CVs saved, but ranking failed: ${e.message}`)
        await refresh()
      } else {
        toast.error(e.message)
      }
    } finally {
      setLoadingMsg(null)
    }
  }

  async function removeCV(cvId) {
    try {
      await api.deleteCV(cvId)
      toast.success('CV removed.')
      await refresh()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCvDeleteConfirm(null)
    }
  }

  async function rerank() {
    try {
      setLoadingMsg('Re-ranking candidates… this may take a minute.')
      await api.rank(id)
      setRerankBanner(false)
      toast.success('Re-ranking complete.')
      await refresh()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoadingMsg(null)
    }
  }

  if (!job) {
    return <div className="text-slate-500">Loading...</div>
  }

  const jd = job.jd_json || {}
  const keywordCount = jd.keywords?.length || 0

  return (
    <div className="space-y-8">
      <LoadingOverlay show={!!loadingMsg} message={loadingMsg} />

      {rerankBanner && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
          <span className="text-amber-800 font-medium">
            Job model was updated — existing ranking may be outdated.
          </span>
          <div className="flex gap-2 shrink-0 ml-4">
            <button className="btn-secondary py-1 text-xs" onClick={() => setRerankBanner(false)}>
              Dismiss
            </button>
            <button className="btn-primary py-1 text-xs" onClick={rerank} disabled={ranking}>
              <RefreshCw size={13} /> Re-rank now
            </button>
          </div>
        </div>
      )}

      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-2">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">{job.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Created {formatDate(job.created_at)} · {keywordCount} keywords · {job.cvs.length} CV
          {job.cvs.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Job model summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Role:</span>{' '}
            <span className="font-medium">{jd.role || '-'}</span>
          </div>
          <div>
            <span className="text-slate-500">Experience:</span>{' '}
            <span className="font-medium">{jd.experience_required || '-'}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(jd.keywords || []).slice(0, 20).map((k, i) => (
            <span
              key={i}
              className={k.type === 'must-have' ? 'chip-blue' : 'chip-amber'}
              title={`${k.category} · weight ${k.weight}`}
            >
              {k.keyword}
            </span>
          ))}
          {(jd.keywords || []).length > 20 && (
            <span className="chip bg-slate-100 text-slate-600">
              +{jd.keywords.length - 20} more
            </span>
          )}
        </div>
      </div>

      {job.cvs.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Uploaded CVs ({job.cvs.length})</h2>
          <ul className="divide-y divide-slate-100">
            {job.cvs.map((cv) => (
              <li key={cv.id} className="flex items-center justify-between py-2 gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 text-sm truncate">
                    {cv.candidate_name || cv.filename}
                  </div>
                  {cv.candidate_name && cv.candidate_name !== cv.filename && (
                    <div className="text-xs text-slate-500 truncate">{cv.filename}</div>
                  )}
                </div>
                <button
                  className="btn-secondary shrink-0 text-rose-700 border-rose-200 hover:bg-rose-50"
                  onClick={() => setCvDeleteConfirm({ id: cv.id, name: cv.candidate_name || cv.filename })}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-semibold text-slate-900 mb-1">Upload CVs &amp; rank</h2>
        <p className="text-sm text-slate-600 mb-4">
          Drop up to 20 CV files. Candidates are ranked in batches of 5 and merged into one list.
        </p>
        <FileDropzone multiple maxFiles={20} files={cvFiles} onChange={setCvFiles} />
        <div className="flex justify-end mt-4">
          <button
            className="btn-primary"
            onClick={uploadAndRank}
            disabled={!!loadingMsg || (job.cvs.length === 0 && cvFiles.length === 0)}
          >
            <BarChart3 size={16} /> Upload &amp; Rank Candidates
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">Ranking</h2>
        <RankingTable jobId={job.id} ranking={job.latest_ranking} cvs={job.cvs} />
      </div>

      <ConfirmDialog
        open={!!cvDeleteConfirm}
        title="Remove CV"
        message={`Remove "${cvDeleteConfirm?.name}" from this job? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={() => removeCV(cvDeleteConfirm.id)}
        onCancel={() => setCvDeleteConfirm(null)}
      />
    </div>
  )
}
