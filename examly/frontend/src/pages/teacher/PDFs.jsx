import { useState, useEffect } from 'react'
import api from '../../lib/api.js'
import { SUBJECTS, CLASSES } from '../../lib/subjects.js'

export default function PDFs() {
  const [pdfs, setPdfs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // form state
  const [file, setFile] = useState(null)
  const [subject, setSubject] = useState('Mathematics')
  const [classLevel, setClassLevel] = useState('10')
  const [chapterLabel, setChapterLabel] = useState('')

  async function loadPdfs() {
    try {
      const { data } = await api.get('/pdfs')
      setPdfs(data.pdfs)
    } catch (err) {
      setError('Failed to load PDFs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPdfs() }, [])

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return setError('Choose a PDF file')
    if (!chapterLabel.trim()) return setError('Enter chapter label')

    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('subject', subject)
      fd.append('class_level', classLevel)
      fd.append('chapter_label', chapterLabel)
      await api.post('/pdfs', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setFile(null)
      setChapterLabel('')
      await loadPdfs()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this PDF?')) return
    try {
      await api.delete(`/pdfs/${id}`)
      await loadPdfs()
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed')
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-semibold text-slate-900">Chapter PDFs</h1>
      <p className="text-slate-500 mt-1 mb-6">Upload the chapter content you've taught. The system uses this to generate questions.</p>

      {/* Upload card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Upload a new chapter</h2>
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
            <label className="text-sm font-medium block mb-1">PDF file</label>
            <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0])}
              className="w-full text-sm" />
            {file && <div className="text-xs text-slate-500 mt-1">{file.name} ({Math.round(file.size/1024)} KB)</div>}
          </div>

          {error && <div className="md:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <div className="md:col-span-2">
            <button disabled={uploading} type="submit"
              className="px-5 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition disabled:opacity-60">
              {uploading ? 'Uploading…' : 'Upload chapter'}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your uploaded chapters</h2>
          <span className="text-sm text-slate-500">{pdfs.length} total</span>
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
                <th className="text-left px-6 py-3">Uploaded</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pdfs.map((p) => {
                const isLibrary = p.teacher_role === 'admin'
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {p.chapter_label}
                        {isLibrary && (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-medium">
                            �� School Library
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{p.subject}</td>
                    <td className="px-6 py-3 text-slate-600">Class {p.class_level}</td>
                    <td className="px-6 py-3 text-slate-500 text-sm">{new Date(p.uploaded_at + 'Z').toLocaleString()}</td>
                    <td className="px-6 py-3 text-right">
                      {!isLibrary && (
                        <button onClick={() => handleDelete(p.id)}
                          className="text-sm text-red-600 hover:underline">Delete</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
