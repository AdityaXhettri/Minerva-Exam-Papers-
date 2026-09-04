import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api.js'
import { useAuth } from '../../lib/useAuth.jsx'

const SUBJECTS = ['Mathematics', 'English', 'Hindi', 'Science', 'Social Science', 'EVS', 'Sanskrit', 'Computer Science']
const CLASSES = ['1','2','3','4','5','6','7','8','9','10','11','12']
const SECTION_TYPES = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'vshort', label: 'Very Short Answer' },
  { value: 'short', label: 'Short Answer' },
  { value: 'long', label: 'Long Answer' },
  { value: 'fill', label: 'Fill in the Blanks' },
  { value: 'truefalse', label: 'True / False' },
]

export default function NewRequest() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [pdfs, setPdfs] = useState([])
  const [teachers, setTeachers] = useState([])
  const [submitForTeacherId, setSubmitForTeacherId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [classLevel, setClassLevel] = useState('10')
  const [subject, setSubject] = useState('Mathematics')
  const [selectedPdfs, setSelectedPdfs] = useState([])
  const [totalMarks, setTotalMarks] = useState(50)
  const [examDate, setExamDate] = useState('')
  const [instructions, setInstructions] = useState('')
  const [sections, setSections] = useState([
    { name: 'A', type: 'mcq', question_count: 5, marks_per_question: 1 },
    { name: 'B', type: 'short', question_count: 5, marks_per_question: 3 },
    { name: 'C', type: 'long', question_count: 3, marks_per_question: 8 },
  ])
  const [difficulty, setDifficulty] = useState({ easy: 30, medium: 50, hard: 20 })

  useEffect(() => {
    api.get('/pdfs').then(({ data }) => {
      setPdfs(data.pdfs)
    }).catch(() => setError('Failed to load PDFs'))
    if (isAdmin) {
      api.get('/teachers').then(({ data }) => {
        setTeachers(data.teachers.filter((t) => t.active))
      }).catch(() => {})
    }
  }, [isAdmin])

  // Filter PDFs by selected subject + class
  const filteredPdfs = pdfs.filter(
    (p) => p.subject === subject && String(p.class_level) === String(classLevel)
  )

  function togglePdf(id) {
    setSelectedPdfs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function updateSection(i, key, value) {
    setSections((prev) => prev.map((s, idx) => {
      if (idx !== i) return s
      // Strip leading zeros for numeric fields
      const v = (key === 'marks_per_question' || key === 'question_count') && typeof value === 'string'
        ? value.replace(/^0+(?=\d)/, '') || '0'
        : value
      return { ...s, [key]: v }
    }))
  }

  function updateDifficulty(level, value) {
    const v = Math.max(0, Math.min(100, Number(value) || 0))
    // Auto-balance the other two fields so total stays at 100
    const others = ['easy', 'medium', 'hard'].filter((l) => l !== level)
    const remaining = Math.max(0, 100 - v)
    const currentOtherSum = others.reduce((sum, l) => sum + (difficulty[l] || 0), 0)
    let next = { ...difficulty, [level]: v }
    if (currentOtherSum === 0) {
      next[others[0]] = Math.floor(remaining / 2)
      next[others[1]] = remaining - next[others[0]]
    } else {
      const aRatio = difficulty[others[0]] / currentOtherSum
      next[others[0]] = Math.round(remaining * aRatio)
      next[others[1]] = remaining - next[others[0]]
    }
    setDifficulty(next)
  }

  function addSection() {
    const nextLetter = String.fromCharCode(65 + sections.length)
    setSections([...sections, { name: nextLetter, type: 'short', question_count: 3, marks_per_question: 5 }])
  }

  function removeSection(i) {
    if (sections.length <= 1) return
    setSections(sections.filter((_, idx) => idx !== i))
  }

  const computedMarks = sections.reduce(
    (sum, s) => sum + (Number(s.question_count) || 0) * (Number(s.marks_per_question) || 0),
    0
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (selectedPdfs.length === 0) return setError('Select at least one chapter PDF')
    if (sections.some((s) => !s.question_count || !s.marks_per_question)) {
      return setError('All sections need question count and marks per question')
    }
    if (difficulty.easy + difficulty.medium + difficulty.hard !== 100) {
      return setError('Difficulty mix must add up to 100%')
    }
    if (computedMarks !== Number(totalMarks)) {
      return setError(`Sections add up to ${computedMarks} marks but total is ${totalMarks}. Adjust to match.`)
    }

    setSubmitting(true)
    try {
      const { data } = await api.post('/requests', {
        class_level: classLevel,
        subject,
        pdf_ids: selectedPdfs,
        total_marks: Number(totalMarks),
        sections,
        difficulty,
        exam_date: examDate || null,
        instructions: instructions || null,
        teacher_id: isAdmin && submitForTeacherId ? Number(submitForTeacherId) : undefined,
      })
      navigate('/teacher/requests')
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-3xl font-semibold text-slate-900">New paper request</h1>
      <p className="text-slate-500 mt-1 mb-6">Configure the paper structure. Admin will generate it when ready.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Basic info</h2>
          {isAdmin && (
            <div className="mb-4 p-3 rounded-lg bg-brand-50 border border-brand-200">
              <label className="text-sm font-medium text-brand-700 block mb-1">
                Submitting on behalf of (admin mode)
              </label>
              <select value={submitForTeacherId} onChange={(e) => setSubmitForTeacherId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white">
                <option value="">— Self (will appear under your name) —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name || t.username} ({t.username})</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Class</label>
              <select value={classLevel} onChange={(e) => { setClassLevel(e.target.value); setSelectedPdfs([]) }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300">
                {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Subject</label>
              <select value={subject} onChange={(e) => { setSubject(e.target.value); setSelectedPdfs([]) }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300">
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Total marks</label>
              <input type="number" min="1" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Exam date (optional)</label>
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
          </div>
        </div>

        {/* Chapters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-1">Select chapters</h2>
          <p className="text-sm text-slate-500 mb-4">
            Showing chapters for Class {classLevel} · {subject}.
            {filteredPdfs.length === 0 && ' Upload matching chapter PDFs first.'}
          </p>
          {filteredPdfs.length > 0 ? (
            <div className="space-y-2">
              {filteredPdfs.map((p) => (
                <label key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selectedPdfs.includes(p.id)} onChange={() => togglePdf(p.id)} />
                  <div className="flex-1">
                    <div className="font-medium">{p.chapter_label}</div>
                    <div className="text-xs text-slate-500">{p.original_filename}</div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 p-4 bg-slate-50 rounded-lg">
              No matching chapters. Go to "Chapter PDFs" to upload some.
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Paper structure</h2>
            <button type="button" onClick={addSection}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
              + Add section
            </button>
          </div>
          <div className="space-y-3">
            {sections.map((s, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-end p-3 bg-slate-50 rounded-lg">
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1">Section</label>
                  <input value={s.name} onChange={(e) => updateSection(i, 'name', e.target.value.toUpperCase().slice(0,2))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-center font-semibold" />
                </div>
                <div className="col-span-4">
                  <label className="text-xs font-medium block mb-1">Type</label>
                  <select value={s.type} onChange={(e) => updateSection(i, 'type', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300">
                    {SECTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1"># Questions</label>
                  <input type="number" min="1" value={s.question_count}
                    onChange={(e) => updateSection(i, 'question_count', Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1">Marks/Q</label>
                  <input type="number" min="1" value={s.marks_per_question}
                    onChange={(e) => updateSection(i, 'marks_per_question', Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div className="col-span-1 text-center text-sm text-slate-500 pb-2">
                  = {s.question_count * s.marks_per_question}
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => removeSection(i)}
                    disabled={sections.length <= 1}
                    className="text-red-600 text-sm hover:underline disabled:opacity-30">Remove</button>
                </div>
              </div>
            ))}
          </div>
          <div className={`mt-3 text-sm font-medium ${computedMarks === Number(totalMarks) ? 'text-emerald-600' : 'text-amber-600'}`}>
            Sections total: {computedMarks} / {totalMarks} marks
            {computedMarks !== Number(totalMarks) && ' — must match total marks'}
          </div>
        </div>

        {/* Difficulty */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-1">Difficulty mix</h2>
          <p className="text-sm text-slate-500 mb-4">Percentage of questions at each level (must total 100%).</p>
          <div className="grid grid-cols-3 gap-4">
            {['easy', 'medium', 'hard'].map((d) => (
              <div key={d}>
                <label className="text-sm font-medium capitalize block mb-1">{d} %</label>
                <input type="number" min="0" max="100" value={difficulty[d]}
                  onChange={(e) => updateDifficulty(d, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300" />
              </div>
            ))}
          </div>
          <div className={`mt-3 text-sm font-medium ${difficulty.easy + difficulty.medium + difficulty.hard === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
            Total: {difficulty.easy + difficulty.medium + difficulty.hard}% (must equal 100%)
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-1">Special instructions (optional)</h2>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3}
            placeholder="e.g. All questions are compulsory. Figures to the right indicate full marks."
            className="w-full px-3 py-2 rounded-lg border border-slate-300" />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting}
            className="px-6 py-3 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition disabled:opacity-60">
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
          <button type="button" onClick={() => navigate('/teacher')}
            className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-white">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
