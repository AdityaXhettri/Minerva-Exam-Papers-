import express from 'express'
import { db, logAction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

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

export default router
