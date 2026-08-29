import express from 'express'
import bcrypt from 'bcryptjs'
import { db, logAction } from '../db.js'
import { signToken, requireAuth } from '../middleware/auth.js'

const router = express.Router()

router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' })
  }

  const user = db
    .prepare('SELECT * FROM users WHERE username = ? AND active = 1')
    .get(username)

  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const ok = bcrypt.compareSync(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
  })

  logAction(user.id, 'login', { role: user.role })

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      assigned_class: user.assigned_class,
    },
  })
})

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, username, role, full_name, assigned_class FROM users WHERE id = ?')
    .get(req.user.id)
  res.json({ user })
})

router.post('/logout', requireAuth, (req, res) => {
  logAction(req.user.id, 'logout')
  res.json({ ok: true })
})

export default router
