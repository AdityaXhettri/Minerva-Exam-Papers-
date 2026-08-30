import express from 'express'
import { db, logAction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { buildHaryanaBooklet } from '../utils/haryana.js'
import { jsPDF } from 'jspdf'

const router = express.Router()

// Generate a paper for a request (admin only)
// Accepts paper_json (questions array) and optionally answer_key_json
router.post('/generate', requireAuth, requireRole('admin'), (req, res) => {
  const { request_id, paper, answer_key = null } = req.body || {}

  if (!request_id || !paper) return res.status(400).json({ error: 'request_id and paper required' })

  const reqRow = db.prepare(`SELECT * FROM paper_requests WHERE id = ?`).get(request_id)
  if (!reqRow) return res.status(404).json({ error: 'Request not found' })

  const totalMarks = reqRow.total_marks
  const info = db.prepare(
    `INSERT INTO papers (request_id, generated_by, subject, class_level, total_marks, paper_json, answer_key_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    request_id,
    req.user.id,
    reqRow.subject,
    reqRow.class_level,
    totalMarks,
    JSON.stringify(paper),
    answer_key ? JSON.stringify(answer_key) : null
  )

  db.prepare(`UPDATE paper_requests SET status = 'generated' WHERE id = ?`).run(request_id)

  logAction(req.user.id, 'paper_generated', {
    paper_id: info.lastInsertRowid,
    request_id,
    subject: reqRow.subject,
    class_level: reqRow.class_level,
    total_marks: totalMarks,
  })

  res.status(201).json({ id: info.lastInsertRowid })
})

// Mark as printed (timestamp)
router.post('/:id/printed', requireAuth, requireRole('admin'), (req, res) => {
  db.prepare(`UPDATE papers SET printed_at = datetime('now') WHERE id = ?`).run(req.params.id)
  logAction(req.user.id, 'paper_printed', { paper_id: req.params.id })
  res.json({ ok: true })
})

// List papers (admin only)
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const rows = db.prepare(
    `SELECT p.*, r.class_level as req_class, r.total_marks as req_marks,
            u.full_name as teacher_name, u.username as teacher_username
     FROM papers p
     JOIN paper_requests r ON p.request_id = r.id
     JOIN users u ON r.teacher_id = u.id
     ORDER BY p.generated_at DESC`
  ).all()
  res.json({ papers: rows })
})

// Get single paper (admin or the teacher who owns the request)
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM papers WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })

  // Check ownership via request
  const reqRow = db.prepare(`SELECT teacher_id FROM paper_requests WHERE id = ?`).get(row.request_id)
  if (req.user.role !== 'admin' && reqRow.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  row.paper = JSON.parse(row.paper_json || '{}')
  row.answer_key = row.answer_key_json ? JSON.parse(row.answer_key_json) : null
  res.json({ paper: row })
})

// Download PDF (admin only) — ?layout=haryana (default) or standard
router.get('/:id/pdf', requireAuth, requireRole('admin'), async (req, res) => {
  const row = db.prepare(
    `SELECT p.*, r.exam_date, r.instructions, r.class_level, r.subject
     FROM papers p
     JOIN paper_requests r ON p.request_id = r.id
     WHERE p.id = ?`
  ).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })

  const paper = JSON.parse(row.paper_json || '{}')
  const layout = (req.query.layout || 'haryana').toLowerCase()

  try {
    let buf
    if (layout === 'haryana') {
      // Build booklet input
      const sections = paper.sections || []
      // Strip correct answers from sections for student version.
      // Options from DB are strings like "(a) Quadratic equations" — pass through unchanged.
      const cleanSections = sections.map((sec) => ({
        label: sec.label || sec.name,
        name: sec.name,
        type: sec.type,
        type_label: sec.type_label || sec.type,
        marks_per_question: sec.marks_per_question,
        questions: (sec.questions || []).map((q) => {
          const clean = { text: q.text, marks: q.marks }
          if (q.options && q.options.length) {
            // Accept either {letter,text} objects OR plain strings — always normalize to string
            clean.options = q.options.map((o) =>
              typeof o === 'string' ? o : `(${o.letter}) ${o.text}`
            )
          }
          // omit 'correct' intentionally
          return clean
        }),
      }))

      buf = buildHaryanaBooklet({
        title: paper.title || `${row.subject || ''} — Class ${row.class_level || ''}`,
        subtitle: paper.subtitle || 'Examination Paper',
        sections: cleanSections,
        totalMarks: row.total_marks,
        examDate: row.exam_date || '',
        schoolName: process.env.SCHOOL_NAME || '',
        classLevel: row.class_level || '',
        subject: row.subject || '',
        timeAllowed: paper.timeAllowed || '',
        instructions: row.instructions || '',
      })

      // Answer key is downloadable via /answer-key route (separate PDF).
      // Here we just return the haryana booklet.
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="paper-${row.id}-haryana.pdf"`
      )
      // Mark printed
      db.prepare(`UPDATE papers SET printed_at = datetime('now') WHERE id = ?`).run(row.id)
      logAction(req.user.id, 'paper_pdf_downloaded', {
        paper_id: row.id,
        layout,
      })
      return res.send(buf)
    }

    // Standard A4 portrait fallback (one section per page, no fold)
    res.status(501).json({ error: 'Standard A4 layout not yet implemented' })
  } catch (err) {
    console.error('PDF generation failed:', err)
    res.status(500).json({ error: 'PDF generation failed', detail: err.message })
  }
})

// Download answer key PDF (admin only)
router.get('/:id/answer-key/pdf', requireAuth, requireRole('admin'), async (req, res) => {
  const row = db.prepare(
    `SELECT p.*, r.exam_date, r.class_level, r.subject
     FROM papers p
     JOIN paper_requests r ON p.request_id = r.id
     WHERE p.id = ?`
  ).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })

  const paper = JSON.parse(row.paper_json || '{}')
  const ak = row.answer_key_json ? JSON.parse(row.answer_key_json) : null

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = 210
  const PH = 297
  const M = 15

  let y = M
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('ANSWER KEY', PW / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(10)
  doc.text(`${row.subject || ''} — Class ${row.class_level || ''}`, PW / 2, y, { align: 'center' })
  y += 5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Marks: ${row.total_marks || ''}`, PW / 2, y, { align: 'center' })
  y += 10

  let qNum = 1
  for (const sec of paper.sections || []) {
    if (y > PH - M - 20) {
      doc.addPage()
      y = M
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(sec.label || sec.name || 'Section', M, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (const q of sec.questions || []) {
      if (y > PH - M - 10) {
        doc.addPage()
        y = M
      }
      const text = `Q${qNum}. ${q.text || ''}`
      const lines = doc.splitTextToSize(text, PW - 2 * M)
      doc.text(lines, M, y)
      y += lines.length * 5
      // Correct option letter if MCQ
      if (q.correct) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 120, 0)
        doc.text(`Answer: ${q.correct}`, M + 4, y)
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
        y += 5
      } else if (q.modelAnswer) {
        const aLines = doc.splitTextToSize(`Model Answer: ${q.modelAnswer}`, PW - 2 * M - 4)
        doc.text(aLines, M + 4, y)
        y += aLines.length * 5
      } else {
        y += 2
      }
      qNum++
    }
    y += 3
  }

  const buf = Buffer.from(doc.output('arraybuffer'))
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="answer-key-paper-${row.id}.pdf"`
  )
  logAction(req.user.id, 'answer_key_pdf_downloaded', { paper_id: row.id })
  res.send(buf)
})

export default router
