import { useState, useEffect } from 'react'
import api from '../../lib/api.js'

export default function PaperHistory() {
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api.get('/papers')
      .then(({ data }) => setPapers(data.papers))
      .finally(() => setLoading(false))
  }, [])

  const filtered = papers.filter((p) =>
    !filter ||
    p.subject.toLowerCase().includes(filter.toLowerCase()) ||
    String(p.class_level).includes(filter) ||
    String(p.id).includes(filter)
  )

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-semibold text-slate-900">Paper history</h1>
      <p className="text-slate-500 mt-1 mb-6">All generated papers.</p>

      <div className="bg-white rounded-2xl border border-slate-200 mb-4 p-4">
        <input value={filter} onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by subject, class or ID…"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            {papers.length === 0 ? 'No papers generated yet.' : 'No papers match your filter.'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3">ID</th>
                <th className="text-left px-6 py-3">Subject</th>
                <th className="text-left px-6 py-3">Class</th>
                <th className="text-left px-6 py-3">Marks</th>
                <th className="text-left px-6 py-3">Generated</th>
                <th className="text-left px-6 py-3">Printed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono text-xs text-slate-500">#{p.id}</td>
                  <td className="px-6 py-3 font-medium">{p.subject}</td>
                  <td className="px-6 py-3 text-slate-600">Class {p.class_level}</td>
                  <td className="px-6 py-3 text-slate-600">{p.total_marks}</td>
                  <td className="px-6 py-3 text-slate-500 text-sm">{new Date(p.generated_at + 'Z').toLocaleString()}</td>
                  <td className="px-6 py-3 text-slate-500 text-sm">
                    {p.printed_at ? new Date(p.printed_at + 'Z').toLocaleString() : <span className="text-slate-400">not yet</span>}
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
