import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api.js'
import { useAuth } from '../../lib/useAuth.jsx'

export default function MyRequests() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    const { data } = await api.get('/requests')
    setRequests(data.requests)
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
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

  const statusBadge = (status) => {
    const map = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      generated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
    }
    return map[status] || 'bg-slate-50 text-slate-700'
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {isAdmin ? 'My self-service requests' : 'My requests'}
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin
              ? 'Papers you submitted yourself (admin self-service). Generate PDFs from pending requests below.'
              : 'All your past paper requests.'}
          </p>
        </div>
        <Link to={isAdmin ? '/admin/new-request' : '/teacher/requests/new'}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">
          + New request
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No requests yet. Click "New request" to create one.
          </div>
        ) : (
          <table className="w-full">
            <thead className="text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3">Subject</th>
                <th className="text-left px-6 py-3">Class</th>
                <th className="text-left px-6 py-3">Marks</th>
                <th className="text-left px-6 py-3">Submitted</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium">{r.subject}</td>
                  <td className="px-6 py-3 text-slate-600">Class {r.class_level}</td>
                  <td className="px-6 py-3 text-slate-600">{r.total_marks}</td>
                  <td className="px-6 py-3 text-slate-500 text-sm">{new Date(r.created_at + 'Z').toLocaleString()}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusBadge(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {r.status === 'pending' && (
                        <Link
                          to={`/admin/generate/${r.id}`}
                          className="text-brand-600 text-sm font-medium hover:underline">
                          ⚡ Generate
                        </Link>
                      )}
                      <button
                        onClick={() => setDeleteTarget(r)}
                        className="text-red-600 text-sm font-medium hover:underline"
                        title="Delete this request and its papers">
                        🗑 Delete
                      </button>
                    </div>
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
                Class {deleteTarget.class_level} · {deleteTarget.total_marks} marks
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
