import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/useAuth.jsx'
import api from '../../lib/api.js'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ pending: 0, generated: 0, teachers: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [reqs, teachers] = await Promise.all([
          api.get('/requests'),
          api.get('/teachers'),
        ])
        const requests = reqs.data.requests
        setStats({
          pending: requests.filter((r) => r.status === 'pending').length,
          generated: requests.filter((r) => r.status === 'generated').length,
          teachers: teachers.data.teachers.filter((t) => t.active).length,
        })
        setRecent(requests.slice(0, 5))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cards = [
    { label: 'Pending Requests', value: stats.pending, hint: 'Awaiting generation', color: 'text-amber-600' },
    { label: 'Papers Generated', value: stats.generated, hint: 'All time', color: 'text-emerald-600' },
    { label: 'Active Teachers', value: stats.teachers, hint: 'Can request papers', color: 'text-brand-600' },
  ]

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">Welcome back, {user?.full_name || 'Admin'}</h1>
        <p className="text-slate-500 mt-1">Here's what's happening with exam paper requests.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {cards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="text-sm text-slate-500">{s.label}</div>
            <div className={`text-3xl font-semibold mt-2 ${s.color}`}>
              {loading ? '…' : s.value}
            </div>
            <div className="text-xs text-slate-400 mt-1">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Teacher Portal quick access */}
      <div className="bg-gradient-to-br from-emerald-50 to-brand-50 rounded-2xl border border-emerald-200 p-6 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Teacher Portal — Self-Service</h2>
            <p className="text-sm text-slate-600 mt-1">
              Create paper requests, generate them instantly, and download PDFs — all without going through a teacher.
            </p>
          </div>
          <Link
            to="/teacher"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
          >
            Open Teacher Portal →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <Link to="/teacher/requests/new" className="bg-white rounded-xl border border-emerald-200 p-4 hover:border-emerald-400 transition">
            <div className="text-xs text-emerald-700 font-semibold uppercase">Action 1</div>
            <div className="font-semibold mt-1">+ New Paper Request</div>
          </Link>
          <Link to="/teacher/requests" className="bg-white rounded-xl border border-emerald-200 p-4 hover:border-emerald-400 transition">
            <div className="text-xs text-emerald-700 font-semibold uppercase">Action 2</div>
            <div className="font-semibold mt-1">Generate from existing</div>
          </Link>
          <Link to="/teacher/pdfs" className="bg-white rounded-xl border border-emerald-200 p-4 hover:border-emerald-400 transition">
            <div className="text-xs text-emerald-700 font-semibold uppercase">Action 3</div>
            <div className="font-semibold mt-1">Upload chapter PDFs</div>
          </Link>
        </div>
      </div>

      {/* Recent requests */}
      <div className="bg-white rounded-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent requests</h2>
          <Link to="/admin/requests" className="text-sm text-brand-600 hover:underline">View all →</Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-sm">No requests yet.</p>
            <p className="text-xs text-slate-400 mt-1">Teachers' requests will appear here.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3">Teacher</th>
                <th className="text-left px-6 py-3">Subject</th>
                <th className="text-left px-6 py-3">Class</th>
                <th className="text-left px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recent.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium">{r.teacher_name || r.teacher_username}</td>
                  <td className="px-6 py-3 text-slate-600">{r.subject}</td>
                  <td className="px-6 py-3 text-slate-600">Class {r.class_level}</td>
                  <td className="px-6 py-3">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                      {r.status}
                    </span>
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
