import express from 'express'
import { db, logAction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = express.Router()

// Create a paper request (teacher)
router.post('/', requireAuth, requireRole('teacher'), (req, res) => {
  const {
    class_level, subject, pdf_ids = [],
    total_marks, sections, difficulty,
    exam_date = null, instructions = null,
  } = req.body || {}

  if (!class_level || !subject) return res.status(400).json({ error: 'class_level and subject required' })
  if (!Array.isArray(sections) || sections.length === 0) return res.status(400).json({ error: 'sections required' })
  if (!total_marks || total_marks < 1) return res.status(400).json({ error: 'total_marks required' })

  // Validate that all pdf_ids belong to this teacher
  if (pdf_ids.length > 0) {
    const placeholders = pdf_ids.map(() => '?').join(',')
    const owned = db.prepare(
      `SELECT id FROM chapter_pdfs WHERE teacher_id = ? AND id IN (${placeholders})`
    ).all(req.user.id, ...pdf_ids)
    if (owned.length !== pdf_ids.length) {
      return res.status(403).json({ error: 'One or more PDFs do not belong to you' })
    }
  }

  const info = db.prepare(
    `INSERT INTO paper_requests
     (teacher_id, class_level, subject, pdf_ids, total_marks, sections_json, difficulty_json, exam_date, instructions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.user.id,
    class_level,
    subject,
    JSON.stringify(pdf_ids),
    total_marks,
    JSON.stringify(sections),
    JSON.stringify(difficulty || { easy: 30, medium: 50, hard: 20 }),
    exam_date,
    instructions
  )

  logAction(req.user.id, 'paper_request_created', { request_id: info.lastInsertRowid, subject, class_level })

  res.status(201).json({ id: info.lastInsertRowid })
})

// List requests (teacher: own; admin: all)
router.get('/', requireAuth, (req, res) => {
  let rows
  if (req.user.role === 'admin') {
    rows = db.prepare(
      `SELECT r.*, u.full_name as teacher_name, u.username as teacher_username
       FROM paper_requests r JOIN users u ON r.teacher_id = u.id
       ORDER BY r.created_at DESC`
    ).all()
  } else {
    rows = db.prepare(
      `SELECT * FROM paper_requests WHERE teacher_id = ? ORDER BY created_at DESC`
    ).all(req.user.id)
  }
  // Parse JSON fields
  const parsed = rows.map((r) => ({
    ...r,
    pdf_ids: JSON.parse(r.pdf_ids || '[]'),
    sections: JSON.parse(r.sections_json || '[]'),
    difficulty: JSON.parse(r.difficulty_json || '{}'),
  }))
  res.json({ requests: parsed })
})

// Get one
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM paper_requests WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (req.user.role !== 'admin' && row.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  row.pdf_ids = JSON.parse(row.pdf_ids || '[]')
  row.sections = JSON.parse(row.sections_json || '[]')
  row.difficulty = JSON.parse(row.difficulty_json || '{}')
  res.json({ request: row })
})

// Update status (admin only)
router.patch('/:id/status', requireAuth, requireRole('admin'), (req, res) => {
  const { status } = req.body || {}
  if (!['pending', 'generated', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  db.prepare(`UPDATE paper_requests SET status = ? WHERE id = ?`).run(status, req.params.id)
  logAction(req.user.id, 'request_status_changed', { request_id: req.params.id, status })
  res.json({ ok: true })
})

export default router
