import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../api.js'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [authType, setAuthType] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    api.authConfig().then((cfg) => setAuthType(cfg.type || 'none'))
  }, [])

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || 'Login failed')
      }
      const { token, user: userData } = await res.json()
      login(token, userData)
      navigate('/', { replace: true })
    } catch (e) {
      setError(e.message || 'Incorrect password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="card p-10 max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-xl bg-brand-800 text-white grid place-items-center">
            <span className="text-2xl font-bold">A</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">APD CV Ranker</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to continue</p>
        </div>

        {authType === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 text-left">
            <div>
              <label className="label">Admin Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary w-full justify-center"
              disabled={!password || loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        {authType === 'none' && (
          <p className="text-slate-500 text-sm">
            Auth is not configured. Set <code className="bg-slate-100 px-1 rounded">ADMIN_PASSWORD</code> in{' '}
            <code className="bg-slate-100 px-1 rounded">.env</code> to enable login.
          </p>
        )}

        {authType === '' && (
          <p className="text-slate-400 text-sm">Loading…</p>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck size={13} className="text-emerald-500" />
          No data leaves this machine
        </div>
      </div>
    </div>
  )
}
