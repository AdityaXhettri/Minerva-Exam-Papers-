import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api.js'
import jsPDF from 'jspdf'

const TYPE_LABEL = {
  mcq: 'Multiple Choice Questions',
  short: 'Short Answer Questions',
  long: 'Long Answer Questions',
  fill: 'Fill in the Blanks',
  truefalse: 'True / False',
}

export default function GeneratePaper() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [request, setRequest] = useState(null)
  const [pdfs, setPdfs] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [paper, setPaper] = useState(null)
  const [answerKey, setAnswerKey] = useState(null)
  const [savedPaperId, setSavedPaperId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [aiProvider, setAiProvider] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: reqData } = await api.get(`/requests/${id}`)
        setRequest(reqData.request)
        // Fetch the actual PDF content texts
        const pdfTexts = await Promise.all(
          reqData.request.pdf_ids.map((pid) =>
            api.get(`/pdfs/${pid}/text`).then((r) => r.data).catch(() => ({ id: pid, text: '' }))
          )
        )
        setPdfs(pdfTexts)
        // Check AI provider
        api.get('/ai/provider').then((r) => setAiProvider(r.data.provider)).catch(() => {})
      } catch (err) {
        setError('Failed to load request')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Placeholder AI generator (real one plugged in Phase 7)
  function generatePaperLocally() {
    const sections = request.sections.map((s, sIdx) => ({
      name: s.name,
      type: s.type,
      type_label: TYPE_LABEL[s.type] || s.type,
      marks_per_question: s.marks_per_question,
      questions: Array.from({ length: s.question_count }).map((_, qIdx) => {
        const qNum = qIdx + 1
        const diff = pickDifficulty(request.difficulty, qIdx, s.question_count)
        if (s.type === 'mcq') {
          return {
            number: `${s.name}.${qNum}`,
            text: `[${diff.toUpperCase()}] MCQ ${qNum} from ${request.subject} Class ${request.class_level} — based on chapter content.`,
            options: ['(a) Option A', '(b) Option B', '(c) Option C', '(d) Option D'],
            correct: '(a) Option A',
            marks: s.marks_per_question,
            difficulty: diff,
          }
        }
        return {
          number: `${s.name}.${qNum}`,
          text: `[${diff.toUpperCase()}] ${TYPE_LABEL[s.type]} ${qNum} — question derived from uploaded chapter content.`,
          marks: s.marks_per_question,
          difficulty: diff,
        }
      }),
    }))

    return {
      title: `${request.subject} — Class ${request.class_level}`,
      subtitle: 'Examination Paper',
      total_marks: request.total_marks,
      instructions: request.instructions || 'All questions are compulsory.',
      sections,
      generated_note: 'Generated locally (AI integration pending — Phase 7)',
    }
  }

  function pickDifficulty(diff, idx, total) {
    const ratio = total === 0 ? 0 : idx / total
    if (ratio < diff.easy / 100) return 'easy'
    if (ratio < (diff.easy + diff.medium) / 100) return 'medium'
    return 'hard'
  }

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      let generated
      let ak
      if (aiProvider) {
        // Real AI generation
        const { data } = await api.post('/ai/generate', { request_id: Number(id) })
        generated = data.paper
        ak = { sections: (generated.sections || []).map((s) => ({
          name: s.name,
          answers: (s.questions || []).map((q) => ({
            number: q.number,
            answer: q.correct || '[Answer required]',
          })),
        })) }
      } else {
        // Fallback: local placeholder so flow still works without API key
        generated = generatePaperLocally()
        ak = { sections: generated.sections.map((s) => ({
          name: s.name,
          answers: s.questions.map((q) => ({
            number: q.number,
            answer: q.correct || `[Answer for ${q.number}]`,
          })),
        })) }
      }
      setPaper(generated)
      setAnswerKey(ak)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!paper) return
    try {
      const { data } = await api.post('/papers/generate', {
        request_id: Number(id),
        paper,
        answer_key: answerKey,
      })
      setSavedPaperId(data.id)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  function updateQuestion(sectionIdx, qIdx, field, value) {
    setPaper((prev) => {
      const sections = [...prev.sections]
      sections[sectionIdx] = {
        ...sections[sectionIdx],
        questions: sections[sectionIdx].questions.map((q, i) =>
          i === qIdx ? { ...q, [field]: value } : q
        ),
      }
      return { ...prev, sections }
    })
  }

  function updateOption(sectionIdx, qIdx, optIdx, value) {
    setPaper((prev) => {
      const sections = [...prev.sections]
      sections[sectionIdx] = {
        ...sections[sectionIdx],
        questions: sections[sectionIdx].questions.map((q, i) => {
          if (i !== qIdx) return q
          const opts = [...(q.options || [])]
          opts[optIdx] = value
          return { ...q, options: opts }
        }),
      }
      return { ...prev, sections }
    })
  }

  function updateCorrect(sectionIdx, qIdx, value) {
    setPaper((prev) => {
      const sections = [...prev.sections]
      sections[sectionIdx] = {
        ...sections[sectionIdx],
        questions: sections[sectionIdx].questions.map((q, i) =>
          i === qIdx ? { ...q, correct: value } : q
        ),
      }
      return { ...prev, sections }
    })
    setAnswerKey((prev) => {
      const sections = prev.sections.map((s, si) => si !== sectionIdx ? s : ({
        ...s,
        answers: s.answers.map((a, ai) => ai !== qIdx ? a : { ...a, answer: value }),
      }))
      return { sections }
    })
  }

  async function handlePrintPDF() {
    if (!paper) return
    if (!savedPaperId) {
      const ok = confirm('Save this paper to history before downloading?')
      if (ok) await handleSave()
    }
    if (savedPaperId) {
      try { await api.post(`/papers/${savedPaperId}/printed`) } catch {}
    }
    // Use a stripped (no-answer) version for the student PDF
    const studentPaper = stripAnswers(paper)
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 40
    let y = margin

    doc.setFont('helvetica', 'bold').setFontSize(16)
    doc.text(paper.title, margin, y); y += 22
    doc.setFont('helvetica', 'normal').setFontSize(11)
    doc.text(paper.subtitle, margin, y); y += 14
    doc.text(`Total Marks: ${paper.total_marks}`, margin, y); y += 14
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, y); y += 18

    doc.setFont('helvetica', 'italic')
    const instrLines = doc.splitTextToSize(paper.instructions, 515)
    doc.text(instrLines, margin, y); y += instrLines.length * 14 + 10

    doc.setFont('helvetica', 'normal')
    paper.sections.forEach((sec) => {
      if (y > 760) { doc.addPage(); y = margin }
      doc.setFont('helvetica', 'bold').setFontSize(13)
      doc.text(`Section ${sec.name} — ${sec.type_label}`, margin, y); y += 18
      doc.setFont('helvetica', 'normal').setFontSize(10)
      doc.text(`(${sec.questions.length} questions × ${sec.marks_per_question} marks each)`, margin, y); y += 16

      sec.questions.forEach((q) => {
        if (y > 780) { doc.addPage(); y = margin }
        const lines = doc.splitTextToSize(`${q.number}. ${q.text}`, 515)
        doc.text(lines, margin, y); y += lines.length * 12 + 4
        if (q.options) {
          q.options.forEach((o) => {
            doc.text(`   ${o}`, margin + 12, y); y += 12
          })
        }
        y += 4
      })
      y += 8
    })

    doc.save(`${studentPaper.title.replace(/\s+/g, '_')}_paper.pdf`)
  }

  if (loading) return <div className="p-8">Loading…</div>
  if (!request) return <div className="p-8 text-red-600">{error || 'Request not found'}</div>

  return (
    <div className="p-8 max-w-5xl">
      <button onClick={() => navigate('/admin/requests')} className="text-sm text-slate-500 hover:text-slate-700 mb-4">
        ← Back to requests
      </button>

      {/* Request summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Generate paper</h1>
            <p className="text-slate-500 mt-1">
              Class {request.class_level} · {request.subject} · {request.total_marks} marks
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {savedPaperId && (
              <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                ✓ Saved as paper #{savedPaperId}
              </span>
            )}
            {!paper && (
              <button onClick={handleGenerate} disabled={generating}
                className="px-5 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-60">
                {generating ? 'Generating with AI…' : '⚡ Generate paper'}
              </button>
            )}
            {paper && (
              <>
                <button onClick={() => setEditing(!editing)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium ${editing ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 hover:bg-slate-50'}`}>
                  {editing ? '✓ Done editing' : '✏️ Edit questions'}
                </button>
                <button onClick={handlePrintPDF}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm font-medium">
                  Download PDF
                </button>
                <button onClick={handleSave}
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700">
                  {savedPaperId ? 'Re-save' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sections preview */}
        <div className="text-sm text-slate-600">
          <div className="font-medium mb-2">Requested structure:</div>
          <div className="flex flex-wrap gap-2">
            {request.sections.map((s, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                Section {s.name}: {s.question_count} × {s.marks_per_question}m ({TYPE_LABEL[s.type]})
              </span>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Chapters: {request.pdf_ids.length} selected · Difficulty: {request.difficulty.easy}/{request.difficulty.medium}/{request.difficulty.hard}
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>}

      {/* Paper preview */}
      {paper && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-6">
          <div className="text-center border-b border-slate-200 pb-4 mb-6">
            <h2 className="text-2xl font-bold">{paper.title}</h2>
            <p className="text-slate-600 mt-1">{paper.subtitle}</p>
            <div className="flex items-center justify-center gap-6 mt-3 text-sm text-slate-600">
              <span>Total Marks: <strong>{paper.total_marks}</strong></span>
              <span>Date: ____________</span>
            </div>
            <p className="text-sm italic text-slate-500 mt-3">{paper.instructions}</p>
          </div>

          {paper.sections.map((sec) => (
            <div key={sec.name} className="mb-8">
              <h3 className="text-lg font-semibold mb-1">
                Section {sec.name} — {sec.type_label}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                ({sec.questions.length} × {sec.marks_per_question} marks)
              </p>
              <ol className="space-y-3">
                {sec.questions.map((q, i) => (
                  <li key={i} className={`text-sm p-2 rounded ${editing ? 'bg-amber-50 border border-amber-200' : ''}`}>
                    <div className="flex gap-2">
                      <span className="font-medium shrink-0">{q.number}.</span>
                      <div className="flex-1 space-y-2">
                        {editing ? (
                          <textarea
                            value={q.text}
                            onChange={(e) => updateQuestion(paper.sections.indexOf(sec), i, 'text', e.target.value)}
                            rows={2}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-sm"
                          />
                        ) : (
                          <div>{q.text}</div>
                        )}
                        {q.options && (
                          <div className="grid grid-cols-2 gap-1 text-slate-700">
                            {q.options.map((o, j) => (
                              <div key={j} className="flex items-center gap-1">
                                {editing ? (
                                  <>
                                    <input
                                      type="radio"
                                      name={`correct-${sec.name}-${i}`}
                                      checked={q.correct === o}
                                      onChange={() => updateCorrect(paper.sections.indexOf(sec), i, o)}
                                      className="shrink-0"
                                      title="Mark as correct answer"
                                    />
                                    <input
                                      value={o}
                                      onChange={(e) => updateOption(paper.sections.indexOf(sec), i, j, e.target.value)}
                                      className="flex-1 px-2 py-1 rounded border border-slate-300 text-xs"
                                    />
                                    {q.correct === o && <span className="text-emerald-600 font-bold text-xs">✓</span>}
                                  </>
                                ) : (
                                  <span>{o}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">[{q.marks}m]</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {/* Answer key */}
      {answerKey && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold mb-3">Answer key</h3>
          {answerKey.sections.map((sec) => (
            <div key={sec.name} className="mb-3">
              <div className="text-sm font-medium mb-1">Section {sec.name}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {sec.answers.map((a) => (
                  <div key={a.number} className="px-2 py-1 rounded bg-slate-50">
                    <span className="font-mono text-xs text-slate-500">{a.number}:</span> {a.answer}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!paper && !generating && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          {aiProvider ? (
            <>
              Click <strong>Generate paper</strong> — the AI will read the uploaded chapters and create questions.
              <div className="text-xs text-slate-400 mt-2">Provider: {aiProvider}</div>
            </>
          ) : (
            <>
              Click <strong>Generate paper</strong> to create a placeholder paper.
              <div className="text-xs text-amber-600 mt-2">No AI key configured — set OPENAI_API_KEY or GEMINI_API_KEY in backend/.env to generate real questions.</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
