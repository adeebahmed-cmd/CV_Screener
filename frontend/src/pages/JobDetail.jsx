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
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)

  async function refresh() {
    const j = await api.getJob(id)
    setJob(j)
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e.message))
  }, [id])

  useEffect(() => {
    if (!rerankFlagRef.current && job && location.state?.needsRerank && job.cvs.length > 0) {
      rerankFlagRef.current = true
      // Auto-trigger re-rank so recruiter doesn't need to click manually
      rerank()
    }
  }, [job])

  const BATCH_SIZE = 20

  async function uploadAndRank() {
    let uploaded = false
    try {
      if (cvFiles.length > 0) {
        const batches = []
        for (let i = 0; i < cvFiles.length; i += BATCH_SIZE) {
          batches.push(cvFiles.slice(i, i + BATCH_SIZE))
        }
        for (let b = 0; b < batches.length; b++) {
          setLoadingMsg(
            batches.length > 1
              ? `Uploading CVs… batch ${b + 1} of ${batches.length} (${Math.round(((b) / batches.length) * 100)}%)`
              : 'Parsing and storing CVs…'
          )
          await api.uploadCVs(id, batches[b])
        }
        setCvFiles([])
        uploaded = true
        await refresh()
      } else if (job.cvs.length === 0) {
        toast.error('Pick at least one CV.')
        return
      }
      setLoadingMsg(`Ranking ${job.cvs.length + (uploaded ? cvFiles.length : 0)} candidates…`)
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

  async function removeAllCVs() {
    try {
      const { deleted } = await api.deleteAllCVs(id)
      toast.success(`${deleted} CV${deleted === 1 ? '' : 's'} deleted.`)
      await refresh()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleteAllConfirm(false)
    }
  }

  async function rerank() {
    try {
      setLoadingMsg('Keywords updated — re-ranking candidates…')
      await api.rank(id)
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Uploaded CVs ({job.cvs.length})</h2>
            <button
              className="btn-secondary text-rose-700 border-rose-200 hover:bg-rose-50 text-xs"
              onClick={() => setDeleteAllConfirm(true)}
            >
              <Trash2 size={13} /> Delete All
            </button>
          </div>
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
          Drop up to 100 CV files. Large batches are uploaded automatically in groups of 20.
          {cvFiles.length > 0 && (
            <span className="ml-2 font-medium text-brand-700">{cvFiles.length} file{cvFiles.length !== 1 ? 's' : ''} selected</span>
          )}
        </p>
        <FileDropzone multiple maxFiles={100} files={cvFiles} onChange={setCvFiles} />
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

      <ConfirmDialog
        open={deleteAllConfirm}
        title="Delete all CVs"
        message={`Delete all ${job.cvs.length} CVs for this job? Rankings and decisions will also be cleared. This cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={removeAllCVs}
        onCancel={() => setDeleteAllConfirm(false)}
      />
    </div>
  )
}
