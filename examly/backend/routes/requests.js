import express from 'express'
import { db, logAction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = express.Router()

// Create a paper request (teacher OR admin on behalf)
router.post('/', requireAuth, (req, res) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only teachers or admins can create paper requests' })
  }

  const {
    class_level, subject, pdf_ids = [],
    total_marks, sections, difficulty,
    exam_date = null, instructions = null,
    teacher_id = null,
  } = req.body || {}

  if (!class_level || !subject) return res.status(400).json({ error: 'class_level and subject required' })
  if (!Array.isArray(sections) || sections.length === 0) return res.status(400).json({ error: 'sections required' })
  if (!total_marks || total_marks < 1) return res.status(400).json({ error: 'total_marks required' })

  // Determine which teacher this request is for
  let ownerId = req.user.id
  if (req.user.role === 'admin' && teacher_id) {
    const t = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'teacher' AND active = 1`).get(teacher_id)
    if (!t) return res.status(400).json({ error: 'Invalid teacher_id' })
    ownerId = Number(teacher_id)
  }

  // Validate that all pdf_ids are usable (own + admin-uploaded, for any teacher)
  if (pdf_ids.length > 0) {
    const placeholders = pdf_ids.map(() => '?').join(',')
    const owned = db.prepare(
      `SELECT p.id FROM chapter_pdfs p JOIN users u ON p.teacher_id = u.id
       WHERE p.id IN (${placeholders}) AND (p.teacher_id = ? OR u.role = 'admin')`
    ).all(...pdf_ids, ownerId)
    if (owned.length !== pdf_ids.length) {
      return res.status(403).json({ error: 'One or more PDFs are not available to this teacher' })
    }
  }

  const info = db.prepare(
    `INSERT INTO paper_requests
     (teacher_id, class_level, subject, pdf_ids, total_marks, sections_json, difficulty_json, exam_date, instructions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    ownerId,
    class_level,
    subject,
    JSON.stringify(pdf_ids),
    total_marks,
    JSON.stringify(sections),
    JSON.stringify(difficulty || { easy: 30, medium: 50, hard: 20 }),
    exam_date,
    instructions
  )

  logAction(req.user.id, 'paper_request_created', {
    request_id: info.lastInsertRowid,
    subject, class_level,
    submitted_by_role: req.user.role,
    for_teacher_id: ownerId,
  })

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
