import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api.js'

export default function AdminRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const { data } = await api.get('/requests')
      setRequests(data.requests)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const statusBadge = (status) => {
    const map = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      generated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
    }
    return map[status] || 'bg-slate-50 text-slate-700'
  }

  const pending = requests.filter((r) => r.status === 'pending')
  const done = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-semibold text-slate-900">Paper requests</h1>
      <p className="text-slate-500 mt-1 mb-6">Review teacher requests and generate papers.</p>

      {/* Pending */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          Pending
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pending.length}</span>
        </h2>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No pending requests.</div>
          ) : (
            <table className="w-full">
              <thead className="text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3">Teacher</th>
                  <th className="text-left px-6 py-3">Subject</th>
                  <th className="text-left px-6 py-3">Class</th>
                  <th className="text-left px-6 py-3">Marks</th>
                  <th className="text-left px-6 py-3">Submitted</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pending.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium">{r.teacher_name || r.teacher_username}</td>
                    <td className="px-6 py-3 text-slate-600">{r.subject}</td>
                    <td className="px-6 py-3 text-slate-600">Class {r.class_level}</td>
                    <td className="px-6 py-3 text-slate-600">{r.total_marks}</td>
                    <td className="px-6 py-3 text-slate-500 text-sm">{new Date(r.created_at + 'Z').toLocaleString()}</td>
                    <td className="px-6 py-3 text-right">
                      <Link to={`/admin/generate/${r.id}`}
                        className="inline-block px-4 py-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">
                        Generate →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Done */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Generated / Closed</h2>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {done.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Nothing here yet.</div>
          ) : (
            <table className="w-full">
              <thead className="text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3">Teacher</th>
                  <th className="text-left px-6 py-3">Subject</th>
                  <th className="text-left px-6 py-3">Class</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {done.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium">{r.teacher_name || r.teacher_username}</td>
                    <td className="px-6 py-3 text-slate-600">{r.subject}</td>
                    <td className="px-6 py-3 text-slate-600">Class {r.class_level}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusBadge(r.status)}`}>
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
    </div>
  )
}
