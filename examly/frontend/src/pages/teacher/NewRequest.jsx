import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api.js'
import { useAuth } from '../../lib/useAuth.jsx'
import {
  SUBJECTS,
  CLASSES,
  SUBJECT_SECTION_PRESETS,
  SECTION_TYPES,
  CONTENT_TYPES,
  getAllowedContentTypes,
  DIFFICULTY_LEVELS,
  subjectKey,
  getSubjectPreset,
} from '../../lib/subjects.js'

export default function NewRequest() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [pdfs, setPdfs] = useState([])
  const [teachers, setTeachers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [classLevel, setClassLevel] = useState('10')
  const [subject, setSubject] = useState('Mathematics')
  const [selectedPdfs, setSelectedPdfs] = useState([])
  const [examDate, setExamDate] = useState('')
  const [instructions, setInstructions] = useState('')
  const [submitForTeacherId, setSubmitForTeacherId] = useState('')

  // Each section now has its own difficulty mix + contentType
  const defaultSectionDifficulty = () => ({ easy: 30, medium: 50, hard: 20 })

  // Initialise sections + totalMarks from the default subject preset (Mathematics)
  const initialPreset = getSubjectPreset('Mathematics')
  const [totalMarks, setTotalMarks] = useState(initialPreset.totalMarks)
  const [sections, setSections] = useState(() =>
    initialPreset.sections.map((s) => ({ ...s, difficulty: defaultSectionDifficulty() }))
  )

  // When subject changes, auto-recompute marks using the preset (but only on user-initiated change)
  const [presetTouched, setPresetTouched] = useState(false)

  // Per-section difficulty multipliers (Easy/Medium/Hard ratio across all sections — overall)
  const [overallDifficulty, setOverallDifficulty] = useState({ easy: 30, medium: 50, hard: 20 })

  useEffect(() => {
    api.get('/pdfs').then(({ data }) => setPdfs(data.pdfs)).catch(() => setError('Failed to load PDFs'))
    if (isAdmin) {
      api.get('/teachers').then(({ data }) => {
        setTeachers(data.teachers.filter((t) => t.active))
      }).catch(() => {})
    }
  }, [isAdmin])

  const filteredPdfs = pdfs.filter(
    (p) => p.subject === subject && String(p.class_level) === String(classLevel)
  )

  function togglePdf(id) {
    setSelectedPdfs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  // Apply preset when subject changes (one click)
  function applyPreset(forSubject) {
    const preset = getSubjectPreset(forSubject)
    setTotalMarks(preset.totalMarks)
    setSections(
      preset.sections.map((s, idx) => ({
        name: s.name,
        // contentType is the single source of truth — type always mirrors it
        contentType: s.contentType || s.type,
        type: s.contentType || s.type,
        question_count: Number(s.question_count) || 1,
        marks_per_question: Number(s.marks_per_question) || 1,
        difficulty: defaultSectionDifficulty(),
      }))
    )
    setPresetTouched(true)
  }

  function updateSection(i, key, value) {
    setSections((prev) => prev.map((s, idx) => {
      if (idx !== i) return s
      const v = (key === 'marks_per_question' || key === 'question_count') && typeof value === 'string'
        ? value.replace(/^0+(?=\d)/, '') || '0'
        : value
      // Type is always derived from contentType (single source of truth)
      if (key === 'contentType') {
        return { ...s, contentType: v, type: v }
      }
      if (key === 'type') {
        // Defensive: if someone still sets type, mirror it to contentType too
        return { ...s, type: v, contentType: v }
      }
      return { ...s, [key]: v }
    }))
  }

  function updateSectionDifficulty(i, level, value) {
    setSections((prev) => prev.map((s, idx) => {
      if (idx !== i) return s
      const v = Math.max(0, Math.min(100, Number(value) || 0))
      const others = ['easy', 'medium', 'hard'].filter((l) => l !== level)
      const remaining = Math.max(0, 100 - v)
      const currentOtherSum = others.reduce((sum, l) => sum + (s.difficulty[l] || 0), 0)
      let nextDiff = { ...s.difficulty, [level]: v }
      if (currentOtherSum === 0) {
        nextDiff[others[0]] = Math.floor(remaining / 2)
        nextDiff[others[1]] = remaining - nextDiff[others[0]]
      } else {
        const aRatio = s.difficulty[others[0]] / currentOtherSum
        nextDiff[others[0]] = Math.round(remaining * aRatio)
        nextDiff[others[1]] = remaining - nextDiff[others[0]]
      }
      return { ...s, difficulty: nextDiff }
    }))
  }

  function updateOverallDifficulty(level, value) {
    const v = Math.max(0, Math.min(100, Number(value) || 0))
    const others = ['easy', 'medium', 'hard'].filter((l) => l !== level)
    const remaining = Math.max(0, 100 - v)
    const currentOtherSum = others.reduce((sum, l) => sum + (overallDifficulty[l] || 0), 0)
    let next = { ...overallDifficulty, [level]: v }
    if (currentOtherSum === 0) {
      next[others[0]] = Math.floor(remaining / 2)
      next[others[1]] = remaining - next[others[0]]
    } else {
      const aRatio = overallDifficulty[others[0]] / currentOtherSum
      next[others[0]] = Math.round(remaining * aRatio)
      next[others[1]] = remaining - next[others[0]]
    }
    setOverallDifficulty(next)
  }

  function applyOverallDifficultyToAll() {
    setSections((prev) => prev.map((s) => ({ ...s, difficulty: { ...overallDifficulty } })))
  }

  function addSection() {
    const nextLetter = String.fromCharCode(65 + sections.length)
    setSections([...sections, {
      name: nextLetter,
      type: 'short',
      contentType: 'short',
      question_count: 3,
      marks_per_question: 5,
      difficulty: defaultSectionDifficulty(),
    }])
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
    if (sections.some((s) => !s.question_count || !s.marks_per_question || !s.contentType)) {
      return setError('All sections need question count, marks and content type')
    }
    // Per-section difficulty must sum to 100
    for (let i = 0; i < sections.length; i++) {
      const d = sections[i].difficulty
      if (d.easy + d.medium + d.hard !== 100) {
        return setError(`Section ${sections[i].name} difficulty must total 100%`)
      }
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
        difficulty: overallDifficulty,
        exam_date: examDate || null,
        instructions: instructions || null,
        teacher_id: isAdmin && submitForTeacherId ? Number(submitForTeacherId) : undefined,
      })
      navigate(isAdmin ? '/admin/my-requests' : '/teacher/requests')
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-3xl font-semibold text-slate-900">New paper request</h1>
      <p className="text-slate-500 mt-1 mb-6">
        Configure paper structure. {isAdmin ? 'You can generate it directly after submitting.' : 'Admin will generate it when ready.'}
      </p>

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Class</label>
              <select value={classLevel} onChange={(e) => { setClassLevel(e.target.value); setSelectedPdfs([]) }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300">
                {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
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
            <div className="md:col-span-2">
              <label className="text-sm font-medium block mb-1">Exam date (optional)</label>
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
            <div className="md:col-span-2 flex items-end">
              <button type="button" onClick={() => {
                if (!presetTouched || confirm(`This will replace all sections with the suggested ${subject} preset. Continue?`)) {
                  applyPreset(subject)
                }
              }}
                className="w-full px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-100">
                ⚡ Apply suggested sections for "{subject}"
              </button>
            </div>
          </div>
          {SUBJECT_SECTION_PRESETS[subjectKey(subject)] && (
            <p className="text-xs text-slate-500 mt-2">
              📋 Default structure verified against HBSE/CBSE board patterns. Click above to load it — you can then edit anything.
            </p>
          )}
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
            <div>
              <h2 className="text-lg font-semibold">Paper structure</h2>
              <p className="text-xs text-slate-500 mt-1">
                Edit section name, count, marks, content type and per-section difficulty freely.
              </p>
            </div>
            <button type="button" onClick={addSection}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
              + Add section
            </button>
          </div>
          <div className="space-y-3">
            {sections.map((s, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-lg space-y-3">
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-1">
                    <label className="text-xs font-medium block mb-1">Section</label>
                    <input value={s.name} onChange={(e) => updateSection(i, 'name', e.target.value.toUpperCase().slice(0,2))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-center font-semibold" />
                  </div>
                  <div className="col-span-5">
                    <label className="text-xs font-medium block mb-1">Question type</label>
                    <select value={s.contentType || s.type} onChange={(e) => updateSection(i, 'contentType', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300">
                      {getAllowedContentTypes(subject).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs font-medium block mb-1"># Qs</label>
                    <input type="number" min="1" value={s.question_count}
                      onChange={(e) => updateSection(i, 'question_count', Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs font-medium block mb-1">Marks/Q</label>
                    <input type="number" min="1" value={s.marks_per_question}
                      onChange={(e) => updateSection(i, 'marks_per_question', Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                  </div>
                  <div className="col-span-2 text-center text-sm text-slate-700 pb-2 font-medium">
                    Total = {s.question_count * s.marks_per_question}
                  </div>
                  <div className="col-span-2 text-right">
                    <button type="button" onClick={() => removeSection(i)}
                      disabled={sections.length <= 1}
                      className="text-red-600 text-sm hover:underline disabled:opacity-30">Remove</button>
                  </div>
                </div>
                {/* Per-section difficulty */}
                <div className="grid grid-cols-4 gap-2 items-center pt-2 border-t border-slate-200">
                  <div className="text-xs text-slate-500 font-medium col-span-1">Section difficulty:</div>
                  <div>
                    <label className="text-[10px] block text-slate-500">Easy %</label>
                    <input type="number" min="0" max="100" value={s.difficulty.easy}
                      onChange={(e) => updateSectionDifficulty(i, 'easy', e.target.value)}
                      className="w-full px-2 py-1 rounded border border-slate-300 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] block text-slate-500">Medium %</label>
                    <input type="number" min="0" max="100" value={s.difficulty.medium}
                      onChange={(e) => updateSectionDifficulty(i, 'medium', e.target.value)}
                      className="w-full px-2 py-1 rounded border border-slate-300 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] block text-slate-500">Hard %</label>
                    <input type="number" min="0" max="100" value={s.difficulty.hard}
                      onChange={(e) => updateSectionDifficulty(i, 'hard', e.target.value)}
                      className="w-full px-2 py-1 rounded border border-slate-300 text-xs" />
                  </div>
                </div>
                {s.difficulty.easy + s.difficulty.medium + s.difficulty.hard !== 100 && (
                  <div className="text-xs text-amber-600">
                    ⚠ Must total 100% (currently {s.difficulty.easy + s.difficulty.medium + s.difficulty.hard}%)
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className={`mt-3 text-sm font-medium ${computedMarks === Number(totalMarks) ? 'text-emerald-600' : 'text-amber-600'}`}>
            Sections total: {computedMarks} / {totalMarks} marks
            {computedMarks !== Number(totalMarks) && ' — must match total marks'}
          </div>
        </div>

        {/* Overall difficulty (used as backup + bulk apply) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold">Overall difficulty mix</h2>
            <button type="button" onClick={applyOverallDifficultyToAll}
              className="text-xs px-3 py-1 rounded border border-brand-300 text-brand-600 hover:bg-brand-50">
              Apply to all sections
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Used as default if you don't customise per section. Click "Apply to all" to overwrite.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {['easy', 'medium', 'hard'].map((d) => (
              <div key={d}>
                <label className="text-sm font-medium capitalize block mb-1">{d} %</label>
                <input type="number" min="0" max="100" value={overallDifficulty[d]}
                  onChange={(e) => updateOverallDifficulty(d, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300" />
              </div>
            ))}
          </div>
          <div className={`mt-3 text-sm font-medium ${overallDifficulty.easy + overallDifficulty.medium + overallDifficulty.hard === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
            Total: {overallDifficulty.easy + overallDifficulty.medium + overallDifficulty.hard}% (must equal 100%)
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
          <button type="button" onClick={() => navigate(isAdmin ? '/admin' : '/teacher')}
            className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-white">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
