import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Briefcase, FileUser, Plus, Clock, ArrowRight, Pencil, Trash2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { api } from '../api.js'
import { formatDate } from '../lib/utils.js'

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-800 grid place-items-center">
          <Icon size={20} />
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ jobs: 0, cvs: 0 })
  const [jobs, setJobs] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const PAGE_SIZE = 8

  async function refresh() {
    const [nextStats, nextJobs] = await Promise.all([api.stats(), api.listJobs()])
    setStats(nextStats)
    setJobs(nextJobs)
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e.message || 'Could not connect to backend.'))
  }, [])

  async function executeDelete() {
    const { id } = confirmDelete
    setConfirmDelete(null)
    try {
      await api.deleteJob(id)
      toast.success('Job deleted.')
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Delete failed.')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Upload a Job Description, rank CVs, and deep-evaluate shortlisted candidates - all on this machine.
          </p>
        </div>
        <Link to="/jobs/new" className="btn-primary">
          <Plus size={18} /> Create New Job
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Stat icon={Briefcase} label="Jobs created" value={stats.jobs} />
        <Stat icon={FileUser} label="CVs analyzed" value={stats.cvs} />
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <h2 className="font-semibold text-slate-900">Recent activity</h2>
        </div>
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No jobs yet. Start by creating one.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(showAll ? jobs : jobs.slice(0, PAGE_SIZE)).map((j) => (
              <li key={j.id} className="px-5 py-3 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => navigate(`/jobs/${j.id}`)}
                    className="flex min-w-0 flex-1 items-center justify-between text-left"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{j.title}</div>
                      <div className="text-xs text-slate-500">
                        {formatDate(j.created_at)} · {j.cv_count} CV{j.cv_count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 shrink-0" />
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigate(`/jobs/${j.id}/edit`)}
                    >
                      <Pencil size={16} /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-rose-700 border-rose-200 hover:bg-rose-50"
                      onClick={() => setConfirmDelete({ id: j.id, title: j.title })}
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {jobs.length > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-slate-100 text-center">
            <button
              className="text-sm text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
              onClick={() => setShowAll((v) => !v)}
            >
              <ChevronDown size={14} className={showAll ? 'rotate-180' : ''} />
              {showAll ? 'Show fewer' : `Show all ${jobs.length} jobs`}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete job"
        message={`Delete "${confirmDelete?.title}"? This will permanently remove all its CVs and rankings.`}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
