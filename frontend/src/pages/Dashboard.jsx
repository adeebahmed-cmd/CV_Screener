import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, FileUser, Plus, Clock, ArrowRight } from 'lucide-react'
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
  const [stats, setStats] = useState({ jobs: 0, cvs: 0 })
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    api.stats().then(setStats).catch(() => {})
    api.listJobs().then(setJobs).catch(() => {})
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Upload a Job Description, rank CVs, and deep-evaluate shortlisted candidates — all on this machine.
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
            {jobs.slice(0, 8).map((j) => (
              <li key={j.id}>
                <Link
                  to={`/jobs/${j.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium text-slate-900">{j.title}</div>
                    <div className="text-xs text-slate-500">
                      {formatDate(j.created_at)} · {j.cv_count} CV{j.cv_count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
