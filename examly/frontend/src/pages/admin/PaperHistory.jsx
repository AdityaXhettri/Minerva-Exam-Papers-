import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api.js'

export default function PaperHistory() {
  const navigate = useNavigate()
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/papers')
      setPapers(data.papers)
    } finally {
      setLoading(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/papers/${deleteTarget.id}`)
      setPapers((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e) {
      alert(`Delete failed: ${e.response?.data?.error || e.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = papers.filter((p) =>
    !filter ||
    p.subject.toLowerCase().includes(filter.toLowerCase()) ||
    String(p.class_level).includes(filter) ||
    String(p.id).includes(filter)
  )

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Paper history</h1>
        <p className="text-slate-500 mt-1">
          Click any row to view the paper, see answers, and re-download the PDF.
        </p>
      </div>

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
            {papers.length === 0
              ? 'No papers generated yet. Go to Requests to generate one.'
              : 'No papers match your filter.'}
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
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((p) => (
                <tr key={p.id}
                  className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono text-xs text-slate-500 cursor-pointer"
                    onClick={() => navigate(`/admin/papers/${p.id}`)}>#{p.id}</td>
                  <td className="px-6 py-3 font-medium cursor-pointer"
                    onClick={() => navigate(`/admin/papers/${p.id}`)}>{p.subject}</td>
                  <td className="px-6 py-3 text-slate-600 cursor-pointer"
                    onClick={() => navigate(`/admin/papers/${p.id}`)}>Class {p.class_level}</td>
                  <td className="px-6 py-3 text-slate-600 cursor-pointer"
                    onClick={() => navigate(`/admin/papers/${p.id}`)}>{p.total_marks}</td>
                  <td className="px-6 py-3 text-slate-500 text-sm cursor-pointer"
                    onClick={() => navigate(`/admin/papers/${p.id}`)}>
                    {new Date(p.generated_at + 'Z').toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-sm cursor-pointer"
                    onClick={() => navigate(`/admin/papers/${p.id}`)}>
                    {p.printed_at ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                        ✓ {new Date(p.printed_at + 'Z').toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 text-xs">
                        not yet
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/admin/papers/${p.id}`)}
                        className="text-brand-600 text-sm font-medium hover:underline">
                        View →
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(p) }}
                        className="text-red-600 text-sm font-medium hover:underline"
                        title="Delete this paper">
                        �� Delete
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
            <h2 className="text-xl font-semibold text-slate-900">Delete paper?</h2>
            <p className="text-slate-600 mt-2">
              You're about to permanently delete:
            </p>
            <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-medium">#{deleteTarget.id} · {deleteTarget.subject}</div>
              <div className="text-sm text-slate-500">
                Class {deleteTarget.class_level} · {deleteTarget.total_marks} marks
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Generated {new Date(deleteTarget.generated_at + 'Z').toLocaleString()}
              </div>
            </div>
            <p className="text-sm text-red-600 mt-3">
              ⚠ This action cannot be undone. The paper, answer key, and PDF generation record will be erased.
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