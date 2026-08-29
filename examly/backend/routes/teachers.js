import express from 'express'
import bcrypt from 'bcryptjs'
import { db, logAction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = express.Router()

// List all teachers (admin only)
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const teachers = db
    .prepare(
      `SELECT id, username, full_name, assigned_class, created_at, active
       FROM users WHERE role = 'teacher' ORDER BY created_at DESC`
    )
    .all()
  res.json({ teachers })
})

// Create teacher (admin only)
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { username, password, full_name, assigned_class } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' })
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (exists) return res.status(409).json({ error: 'Username already exists' })

  const hash = bcrypt.hashSync(password, 10)
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, role, full_name, assigned_class)
       VALUES (?, ?, 'teacher', ?, ?)`
    )
    .run(username, hash, full_name || null, assigned_class || null)

  logAction(req.user.id, 'teacher_created', { new_teacher_id: info.lastInsertRowid, username })

  res.status(201).json({ id: info.lastInsertRowid, username })
})

// Deactivate teacher (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { id } = req.params
  db.prepare('UPDATE users SET active = 0 WHERE id = ? AND role = ?').run(id, 'teacher')
  logAction(req.user.id, 'teacher_deactivated', { teacher_id: id })
  res.json({ ok: true })
})

export default router
