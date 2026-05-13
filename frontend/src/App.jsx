import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Plus, Settings as SettingsIcon, ShieldCheck,
  Database, Users as UsersIcon, LogOut, ChevronDown, BarChart3,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import Dashboard  from './pages/Dashboard.jsx'
import NewJob     from './pages/NewJob.jsx'
import JobDetail  from './pages/JobDetail.jsx'
import CVDetail   from './pages/CVDetail.jsx'
import Settings   from './pages/Settings.jsx'
import Login      from './pages/Login.jsx'
import Repository from './pages/Repository.jsx'
import Users      from './pages/Users.jsx'
import Analytics  from './pages/Analytics.jsx'

function NavItem({ to, icon: Icon, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-brand-800 text-white' : 'text-slate-700 hover:bg-slate-100'
        }`
      }
    >
      <Icon size={18} />
      {children}
    </NavLink>
  )
}

function UserMenu() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user || user.id === 0) return null  // local/no-auth mode — don't show menu

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-slate-100 text-left"
      >
        {user.picture ? (
          <img src={user.picture} alt="" className="w-7 h-7 rounded-full shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-800 grid place-items-center shrink-0 text-xs font-bold">
            {(user.name || user.email)[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-900 truncate">{user.name}</div>
          <div className="text-[10px] text-slate-500 capitalize">{user.role}</div>
        </div>
        <ChevronDown size={13} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {isAdmin && (
            <button
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => { setOpen(false); navigate('/users') }}
            >
              <UsersIcon size={15} /> Manage Users
            </button>
          )}
          <button
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
            onClick={() => { logout(); navigate('/login') }}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

function AppShell() {
  const { user, authEnabled, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    )
  }

  // Show login page if auth is enabled and user is not logged in
  if (authEnabled && !user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 no-print flex flex-col">
        <div className="px-5 py-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-brand-800 text-white grid place-items-center font-bold">
              A
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">APD CV Ranker</div>
              <div className="text-xs text-slate-500">Local · Private · Offline</div>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          <NavItem to="/" icon={LayoutDashboard} end>Dashboard</NavItem>
          <NavItem to="/jobs/new" icon={Plus}>New Job</NavItem>
          <NavItem to="/analytics" icon={BarChart3}>Analytics</NavItem>
          <NavItem to="/repository" icon={Database}>Keyword Repository</NavItem>
          {isAdmin && <NavItem to="/users" icon={UsersIcon}>Users</NavItem>}
          <NavItem to="/settings" icon={SettingsIcon}>Settings</NavItem>
        </nav>

        <div className="p-3 border-t border-slate-100 space-y-2">
          <UserMenu />
          <div className="px-2 py-1 text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-500" />
            No data leaves this machine.
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/jobs/new" element={<ProtectedRoute><NewJob /></ProtectedRoute>} />
            <Route path="/jobs/:id/edit" element={<ProtectedRoute><NewJob /></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
            <Route path="/jobs/:id/cv/:cvId" element={<ProtectedRoute><CVDetail /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/repository" element={<ProtectedRoute><Repository /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
