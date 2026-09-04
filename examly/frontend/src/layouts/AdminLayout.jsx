import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth.jsx'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const navItems = [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/requests', label: 'Requests' },
    { to: '/admin/library', label: 'Chapter Library' },
    { to: '/admin/papers', label: 'Paper History' },
    { to: '/admin/teachers', label: 'Teachers' },
  ]

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold">E</div>
          <span className="text-lg font-semibold">Examly</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="px-3 py-2 text-xs text-slate-500">Signed in as</div>
          <div className="px-3 py-1 text-sm font-medium">{user?.full_name || user?.username}</div>
          <button
            onClick={handleLogout}
            className="mt-2 w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
