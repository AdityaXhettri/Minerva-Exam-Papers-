import { useState, useEffect } from 'react'
import api from '../../lib/api.js'
import { SUBJECTS, CLASSES } from '../../lib/subjects.js'

export default function ChapterLibrary() {
  const [pdfs, setPdfs] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const [file, setFile] = useState(null)
  const [subject, setSubject] = useState('Mathematics')
  const [classLevel, setClassLevel] = useState('10')
  const [chapterLabel, setChapterLabel] = useState('')
  const [assignTo, setAssignTo] = useState('')

  async function load() {
    try {
      const [pdfsRes, teachersRes] = await Promise.all([
        api.get('/pdfs'),
        api.get('/teachers'),
      ])
      setPdfs(pdfsRes.data.pdfs)
      setTeachers(teachersRes.data.teachers.filter((t) => t.active))
    } catch {
      setError('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return setError('Choose a PDF')
    if (!chapterLabel.trim()) return setError('Enter chapter label')

    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('subject', subject)
      fd.append('class_level', classLevel)
      fd.append('chapter_label', chapterLabel)
      if (assignTo) fd.append('teacher_id', assignTo)
      await api.post('/pdfs', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setFile(null); setChapterLabel('')
      await load()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Chapter Library</h1>
        <p className="text-slate-500 mt-1">
          All uploaded chapter PDFs across teachers. Upload chapters on behalf of any teacher, or as the school library (visible to all).
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Upload chapter (admin)</h2>
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300">
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Class</label>
            <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300">
              {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium block mb-1">Chapter label</label>
            <input value={chapterLabel} onChange={(e) => setChapterLabel(e.target.value)}
              placeholder="e.g. Chapter 3 — Trigonometry"
              className="w-full px-3 py-2 rounded-lg border border-slate-300" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium block mb-1">Assign to teacher (optional)</label>
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300">
              <option value="">— School Library (visible to all teachers) —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || t.username} ({t.username})</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Leave as "School Library" so any teacher can use it. Assign to a specific teacher to make it private to them.
            </p>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium block mb-1">PDF file</label>
            <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0])}
              className="w-full text-sm" />
            {file && <div className="text-xs text-slate-500 mt-1">{file.name} ({Math.round(file.size/1024)} KB)</div>}
          </div>

          {error && <div className="md:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <div className="md:col-span-2">
            <button disabled={uploading} type="submit"
              className="px-5 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-60">
              {uploading ? 'Uploading…' : 'Upload chapter'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">All chapters ({pdfs.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : pdfs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No PDFs uploaded yet.</div>
        ) : (
          <table className="w-full">
            <thead className="text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3">Chapter</th>
                <th className="text-left px-6 py-3">Subject</th>
                <th className="text-left px-6 py-3">Class</th>
                <th className="text-left px-6 py-3">Owner</th>
                <th className="text-left px-6 py-3">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pdfs.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-900">{p.chapter_label}</td>
                  <td className="px-6 py-3 text-slate-600">{p.subject}</td>
                  <td className="px-6 py-3 text-slate-600">Class {p.class_level}</td>
                  <td className="px-6 py-3 text-slate-600">
                    {p.teacher_role === 'admin' ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-medium">School Library</span>
                    ) : (
                      <span className="text-sm">{p.teacher_name || p.teacher_username}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-sm">{new Date(p.uploaded_at + 'Z').toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
