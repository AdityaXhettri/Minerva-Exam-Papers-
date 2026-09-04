import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/useAuth.jsx'
import api from '../../lib/api.js'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ pending: 0, generated: 0, teachers: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  useEffect(() => {
    load()
  }, [])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/requests/${deleteTarget.id}`)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      alert(`Delete failed: ${e.response?.data?.error || e.message}`)
    } finally {
      setDeleting(false)
    }
  }

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

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-brand-50 to-slate-50 rounded-2xl border border-brand-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
        <p className="text-sm text-slate-600 mt-1">
          Create, generate, and manage paper requests — all from one place.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <Link to="/teacher/requests/new" className="bg-white rounded-xl border border-brand-200 p-4 hover:border-brand-400 transition">
            <div className="text-xs text-brand-700 font-semibold uppercase">Action 1</div>
            <div className="font-semibold mt-1">+ New Paper Request</div>
            <div className="text-xs text-slate-500 mt-1">Submit a new paper for any class & subject</div>
          </Link>
          <Link to="/teacher/requests" className="bg-white rounded-xl border border-brand-200 p-4 hover:border-brand-400 transition">
            <div className="text-xs text-brand-700 font-semibold uppercase">Action 2</div>
            <div className="font-semibold mt-1">Generate from existing</div>
            <div className="text-xs text-slate-500 mt-1">Pick a pending request and generate the PDF</div>
          </Link>
          <Link to="/teacher/pdfs" className="bg-white rounded-xl border border-brand-200 p-4 hover:border-brand-400 transition">
            <div className="text-xs text-brand-700 font-semibold uppercase">Action 3</div>
            <div className="font-semibold mt-1">Upload chapter PDFs</div>
            <div className="text-xs text-slate-500 mt-1">Add reference material for better AI generation</div>
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
                <th className="px-6 py-3"></th>
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
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => setDeleteTarget(r)}
                      className="text-red-600 text-sm font-medium hover:underline"
                      title="Delete this request and its papers">
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-slate-900">Delete request?</h2>
            <p className="text-slate-600 mt-2">
              You're about to permanently delete this request and all its generated papers:
            </p>
            <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-medium">{deleteTarget.subject}</div>
              <div className="text-sm text-slate-500">
                Class {deleteTarget.class_level} · {deleteTarget.teacher_name || deleteTarget.teacher_username}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Status: {deleteTarget.status}
              </div>
            </div>
            <p className="text-sm text-red-600 mt-3">
              ⚠ This action cannot be undone. All generated papers for this request will also be erased.
            </p>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
