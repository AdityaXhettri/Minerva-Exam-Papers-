import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api.js'

export default function MyRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/requests')
      .then(({ data }) => setRequests(data.requests))
      .finally(() => setLoading(false))
  }, [])

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
          <h1 className="text-3xl font-semibold text-slate-900">My requests</h1>
          <p className="text-slate-500 mt-1">All your past paper requests.</p>
        </div>
        <Link to="/teacher/requests/new"
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
