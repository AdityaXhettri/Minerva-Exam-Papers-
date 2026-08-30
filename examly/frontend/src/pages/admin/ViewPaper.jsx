import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api.js'

export default function ViewPaper() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [paper, setPaper] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAnswers, setShowAnswers] = useState(false)
  const [useHaryanaLayout, setUseHaryanaLayout] = useState(true)

  useEffect(() => {
    api.get(`/papers/${id}`)
      .then(({ data }) => setPaper(data.paper))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  function handleDownloadPDF() {
    const layout = useHaryanaLayout ? 'haryana' : 'standard'
    // Hit backend endpoint — it streams the PDF and marks paper as printed
    const token = localStorage.getItem('examly_token')
    fetch(`/api/papers/${id}/pdf?layout=${layout}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `paper-${id}-${layout}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      })
      .catch((e) => alert(`PDF download failed: ${e.message}`))
  }

  function handleDownloadAnswerKey() {
    const token = localStorage.getItem('examly_token')
    fetch(`/api/papers/${id}/answer-key/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `answer-key-paper-${id}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      })
      .catch((e) => alert(`Answer key download failed: ${e.message}`))
  }

  if (loading) return <div className="p-8">Loading…</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!paper) return null

  return (
    <div className="p-8 max-w-5xl">
      <button onClick={() => navigate('/admin/papers')} className="text-sm text-slate-500 hover:text-slate-700 mb-4">
        ← Back to paper history
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{paper.paper.title}</h1>
            <p className="text-slate-500 mt-1">
              Class {paper.class_level} · {paper.subject} · {paper.total_marks} marks
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Generated {new Date(paper.generated_at + 'Z').toLocaleString()}
              {paper.printed_at && ` · Last printed ${new Date(paper.printed_at + 'Z').toLocaleString()}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAnswers(!showAnswers)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium ${showAnswers ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-300 hover:bg-slate-50'}`}>
              {showAnswers ? '🙈 Hide answers' : '🔑 Show answers'}
            </button>
            <button onClick={handleDownloadPDF}
              className="px-5 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600">
              ⬇ Download PDF
            </button>
            <button onClick={handleDownloadAnswerKey}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600">
              🔑 Answer Key
            </button>
            <button onClick={() => setUseHaryanaLayout(!useHaryanaLayout)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium ${useHaryanaLayout ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-300 hover:bg-slate-50'}`}
              title="Toggle Haryana Board format">
              {useHaryanaLayout ? '📄 Haryana' : '📄 A4'}
            </button>
          </div>
        </div>
      </div>

      {/* Paper */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-6">
        <div className="text-center border-b border-slate-200 pb-4 mb-6">
          <h2 className="text-2xl font-bold">{paper.paper.title}</h2>
          <p className="text-slate-600 mt-1">{paper.paper.subtitle}</p>
          <div className="flex items-center justify-center gap-6 mt-3 text-sm text-slate-600">
            <span>Total Marks: <strong>{paper.paper.total_marks}</strong></span>
            <span>Date: ____________</span>
          </div>
          {paper.paper.instructions && (
            <p className="text-sm italic text-slate-500 mt-3">{paper.paper.instructions}</p>
          )}
        </div>

        {paper.paper.sections.map((sec) => (
          <div key={sec.name} className="mb-8">
            <h3 className="text-lg font-semibold mb-1">
              Section {sec.name} — {sec.type_label}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ({sec.questions.length} × {sec.marks_per_question} marks)
            </p>
            <ol className="space-y-3">
              {sec.questions.map((q, i) => (
                <li key={i} className="text-sm">
                  <div className="flex gap-2">
                    <span className="font-medium shrink-0">{q.number}.</span>
                    <div className="flex-1 space-y-2">
                      <div>{q.text}</div>
                      {q.options && (
                        <div className="grid grid-cols-2 gap-1 text-slate-700">
                          {q.options.map((o, j) => {
                            const isCorrect = showAnswers && paper.answer_key?.sections
                              ?.find((s) => s.name === sec.name)
                              ?.answers?.find((a) => a.number === q.number)?.answer === o
                            return (
                              <div key={j} className={isCorrect ? 'text-emerald-700 font-medium' : ''}>
                                {isCorrect && '✓ '}{o}
                              </div>
                            )
                          })}
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

      {/* Answer key summary */}
      {paper.answer_key && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold mb-3">Answer key</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {paper.answer_key.sections.flatMap((sec) =>
              sec.answers.map((a) => (
                <div key={a.number} className="px-2 py-1 rounded bg-slate-50">
                  <span className="font-mono text-xs text-slate-500">{a.number}:</span> {a.answer}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}