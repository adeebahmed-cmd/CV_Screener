import { useEffect, useState } from 'react'
import { Shield, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { formatDate } from '../lib/utils.js'

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])

  async function load() {
    try {
      setUsers(await api.listUsers())
    } catch (e) {
      toast.error(e.message || 'Could not load users')
    }
  }

  useEffect(() => { load() }, [])

  async function toggleRole(u) {
    const next = u.role === 'admin' ? 'recruiter' : 'admin'
    try {
      await api.updateUserRole(u.id, next)
      toast.success(`${u.name} is now ${next}`)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {users.length} registered user{users.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="card overflow-hidden">
        {users.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No users yet.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['User', 'Email', 'Role', 'Joined', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.picture ? (
                        <img src={u.picture} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 grid place-items-center">
                          <UserIcon size={15} />
                        </div>
                      )}
                      <span className="font-medium text-slate-900">
                        {u.name}
                        {me?.id === u.id && (
                          <span className="ml-1.5 text-xs text-slate-400">(you)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
                      u.role === 'admin'
                        ? 'bg-brand-50 text-brand-800 border-brand-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      <Shield size={11} />
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {me?.id !== u.id && (
                      <button
                        className="btn-secondary py-1 text-xs"
                        onClick={() => toggleRole(u)}
                      >
                        Make {u.role === 'admin' ? 'Recruiter' : 'Admin'}
                      </button>
                    )}
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
