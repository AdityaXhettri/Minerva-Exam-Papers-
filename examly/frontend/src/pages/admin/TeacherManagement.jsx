import { useState, useEffect } from 'react'
import api from '../../lib/api.js'

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', full_name: '', assigned_class: '' })
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    const { data } = await api.get('/teachers')
    setTeachers(data.teachers)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await api.post('/teachers', form)
      setForm({ username: '', password: '', full_name: '', assigned_class: '' })
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this teacher? They will not be able to log in.')) return
    await api.delete(`/teachers/${id}`)
    await load()
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Teachers</h1>
          <p className="text-slate-500 mt-1">Manage teacher accounts.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">
          {showForm ? 'Cancel' : '+ Add teacher'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">New teacher account</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                required className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                required className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Full name</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Assigned class (optional)</label>
              <input value={form.assigned_class} onChange={(e) => setForm({ ...form, assigned_class: e.target.value })}
                placeholder="e.g. 10"
                className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
            {error && <div className="md:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <div className="md:col-span-2">
              <button disabled={creating} type="submit"
                className="px-5 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-60">
                {creating ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : teachers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No teachers added yet.</div>
        ) : (
          <table className="w-full">
            <thead className="text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Username</th>
                <th className="text-left px-6 py-3">Class</th>
                <th className="text-left px-6 py-3">Created</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium">{t.full_name || '—'}</td>
                  <td className="px-6 py-3 text-slate-600 font-mono text-sm">{t.username}</td>
                  <td className="px-6 py-3 text-slate-600">{t.assigned_class || '—'}</td>
                  <td className="px-6 py-3 text-slate-500 text-sm">{new Date(t.created_at + 'Z').toLocaleDateString()}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${t.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {t.active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {t.active && (
                      <button onClick={() => handleDeactivate(t.id)}
                        className="text-sm text-red-600 hover:underline">Deactivate</button>
                    )}
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
