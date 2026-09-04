import express from 'express'
import { db, logAction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { buildHaryanaBooklet, safeWrap } from '../utils/haryana.js'
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

// Delete paper (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const row = db.prepare(`SELECT id, request_id FROM papers WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Paper not found' })

  db.prepare(`DELETE FROM papers WHERE id = ?`).run(req.params.id)
  // Revert request status to 'pending' so teacher sees it as not-yet-generated
  // (or 'rejected' which better signals it was once generated then deleted)
  if (row.request_id) {
    db.prepare(`UPDATE paper_requests SET status = 'pending' WHERE id = ?`).run(row.request_id)
  }
  logAction(req.user.id, 'paper_deleted', { paper_id: req.params.id, request_id: row.request_id })
  res.json({ ok: true })
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
  const M = 20
  const contentW = PW - 2 * M
  const contentBottom = PH - M

  let y = M
  // Title
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(16)
  doc.setTextColor(20, 20, 35)
  doc.text('ANSWER KEY', PW / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(11)
  doc.setTextColor(60, 60, 75)
  doc.text(`${row.subject || ''} — Class ${row.class_level || ''}`, PW / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(10)
  doc.setTextColor(40, 40, 55)
  doc.text(`Total Marks: ${row.total_marks || ''}`, PW / 2, y, { align: 'center' })
  y += 4
  y += 2
  doc.setDrawColor(220, 220, 230)
  doc.setLineWidth(0.2)
  doc.line(M, y, PW - M, y)
  doc.setDrawColor(0, 0, 0)
  y += 6
  doc.setTextColor(0, 0, 0)

  // Build a lookup of answer_key data by question number
  const akByNum = {}
  if (ak && ak.sections) {
    let akQ = 1
    for (const sec of ak.sections) {
      for (const q of sec.questions || []) {
        akByNum[akQ] = q
        akQ++
      }
    }
  }

  let qNum = 1
  for (const sec of paper.sections || []) {
    // Section header
    if (y + 14 > contentBottom) {
      doc.addPage()
      y = M
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(40, 40, 55)
    doc.text(sec.label || sec.name || 'Section', M, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(80, 80, 95)
    const subLine = `${sec.questions?.length || 0} × ${sec.marks_per_question || 0} = ${(sec.questions?.length || 0) * (sec.marks_per_question || 0)} marks`
    doc.text(subLine, M, y)
    y += 6
    doc.setTextColor(0, 0, 0)

    doc.setFontSize(10)
    for (const q of sec.questions || []) {
      // Get answer info from answer_key (if available) — fallback to paper's own correct
      const akQ = akByNum[qNum] || {}
      const correct = akQ.correct || q.correct
      const explanation = akQ.explanation || akQ.modelAnswer || q.modelAnswer || null

      // Build answer block lines
      const answerBlock = []
      answerBlock.push(`Q${qNum}.`)
      if (correct) {
        answerBlock.push(`   Answer: ${correct}`)
      }
      if (explanation) {
        // Split explanation into step-by-step lines (if multi-line)
        const steps = String(explanation).split(/\n+/).map(s => s.trim()).filter(Boolean)
        if (steps.length > 1) {
          answerBlock.push('   Solution:')
          steps.forEach((s, i) => {
            answerBlock.push(`     ${i + 1}. ${s}`)
          })
        } else {
          answerBlock.push(`   Explanation: ${explanation}`)
        }
      }
      const blockText = answerBlock.join('\n')
      const blockLines = safeWrap(doc, blockText, contentW)
      const blockH = blockLines.length * 4.5 + 4

      if (y + blockH > contentBottom) {
        doc.addPage()
        y = M
      }

      // Render answer block
      doc.setTextColor(25, 25, 40)
      doc.text(blockLines, M, y)
      y += blockLines.length * 4.5 + 4

      qNum++
    }
    y += 4
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
