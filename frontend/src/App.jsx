import { NavLink, Route, Routes } from 'react-router-dom'
import { LayoutDashboard, Plus, Settings as SettingsIcon, ShieldCheck } from 'lucide-react'
import Dashboard from './pages/Dashboard.jsx'
import NewJob from './pages/NewJob.jsx'
import JobDetail from './pages/JobDetail.jsx'
import CVDetail from './pages/CVDetail.jsx'
import Settings from './pages/Settings.jsx'

function NavItem({ to, icon: Icon, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-800 text-white'
            : 'text-slate-700 hover:bg-slate-100'
        }`
      }
    >
      <Icon size={18} />
      {children}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 no-print">
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
        <nav className="p-3 space-y-1">
          <NavItem to="/" icon={LayoutDashboard} end>
            Dashboard
          </NavItem>
          <NavItem to="/jobs/new" icon={Plus}>
            New Job
          </NavItem>
          <NavItem to="/settings" icon={SettingsIcon}>
            Settings
          </NavItem>
        </nav>
        <div className="px-5 py-4 mt-auto text-xs text-slate-500 flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-600" />
          No data leaves this machine.
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs/new" element={<NewJob />} />
            <Route path="/jobs/:id/edit" element={<NewJob />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/jobs/:id/cv/:cvId" element={<CVDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
