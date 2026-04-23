import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, BarChart3, Upload } from 'lucide-react'
import FileDropzone from '../components/FileDropzone.jsx'
import RankingTable from '../components/RankingTable.jsx'
import LoadingOverlay from '../components/LoadingOverlay.jsx'
import { api } from '../api.js'
import { formatDate } from '../lib/utils.js'

export default function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [cvFiles, setCvFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [ranking, setRanking] = useState(false)

  async function refresh() {
    const j = await api.getJob(id)
    setJob(j)
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e.message))
  }, [id])

  async function upload() {
    if (cvFiles.length === 0) {
      toast.error('Pick at least one CV.')
      return
    }
    try {
      setUploading(true)
      await api.uploadCVs(id, cvFiles)
      setCvFiles([])
      toast.success('CVs uploaded.')
      await refresh()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  async function rank() {
    try {
      setRanking(true)
      await api.rank(id)
      toast.success('Ranking complete.')
      await refresh()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setRanking(false)
    }
  }

  if (!job) {
    return <div className="text-slate-500">Loading…</div>
  }

  const jd = job.jd_json || {}
  const keywordCount = jd.keywords?.length || 0

  return (
    <div className="space-y-8">
      <LoadingOverlay show={uploading} message="Parsing and storing CVs…" />
      <LoadingOverlay
        show={ranking}
        message="Ranking candidates with local LLM… this can take up to 2 minutes."
      />

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
            <span className="font-medium">{jd.role || '—'}</span>
          </div>
          <div>
            <span className="text-slate-500">Experience:</span>{' '}
            <span className="font-medium">{jd.experience_required || '—'}</span>
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

      <div className="card p-5">
        <h2 className="font-semibold text-slate-900 mb-1">Upload CVs &amp; rank</h2>
        <p className="text-sm text-slate-600 mb-4">
          Drop up to 5 CV files. The LLM will rank them against this job model.
        </p>
        <FileDropzone multiple maxFiles={5} files={cvFiles} onChange={setCvFiles} />
        <div className="flex gap-2 justify-end mt-4">
          <button className="btn-secondary" onClick={upload} disabled={uploading || cvFiles.length === 0}>
            <Upload size={16} /> Upload
          </button>
          <button
            className="btn-primary"
            onClick={rank}
            disabled={ranking || job.cvs.length === 0}
          >
            <BarChart3 size={16} /> Rank Candidates
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">Ranking</h2>
        <RankingTable jobId={job.id} ranking={job.latest_ranking} cvs={job.cvs} />
      </div>
    </div>
  )
}
