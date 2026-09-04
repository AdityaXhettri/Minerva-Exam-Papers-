import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import pdfParse from 'pdf-parse'
import { db, logAction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    cb(null, safe)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files allowed'))
  },
})

const router = express.Router()

// Upload chapter PDF (teacher OR admin)
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { subject, class_level, chapter_label, teacher_id } = req.body
    if (!req.file) return res.status(400).json({ error: 'PDF file required' })
    if (!subject || !class_level || !chapter_label) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'subject, class_level, chapter_label required' })
    }

    // Determine owner: admin can specify, teacher always owns their own
    let ownerId = req.user.id
    if (req.user.role === 'admin') {
      if (teacher_id) {
        const t = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'teacher' AND active = 1`).get(teacher_id)
        if (!t) {
          fs.unlinkSync(req.file.path)
          return res.status(400).json({ error: 'Invalid teacher_id' })
        }
        ownerId = Number(teacher_id)
      } else {
        ownerId = req.user.id // admin uploads owned by admin → still usable in any teacher's request
      }
    }

    // Insert row immediately with extracted_text = '' so the upload responds fast.
    // Text extraction happens in the background to avoid proxy/timeout failures on large PDFs.
    const info = db.prepare(
      `INSERT INTO chapter_pdfs (teacher_id, subject, class_level, chapter_label, original_filename, stored_filename, extracted_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      ownerId,
      subject,
      class_level,
      chapter_label,
      req.file.originalname,
      req.file.filename,
      ''
    )

    logAction(req.user.id, 'pdf_uploaded', {
      pdf_id: info.lastInsertRowid,
      subject, class_level, chapter_label,
      uploaded_by_role: req.user.role,
      owner_id: ownerId,
      file_bytes: req.file.size,
    })

    // Respond fast — client should not wait for text extraction on multi-MB PDFs.
    res.status(201).json({
      id: info.lastInsertRowid,
      subject,
      class_level,
      chapter_label,
      original_filename: req.file.originalname,
      extracted_chars: 0,
      extraction_status: 'pending',
      uploaded_at: new Date().toISOString(),
    })

    // Background extraction (non-blocking)
    ;(async () => {
      try {
        const data = await pdfParse(req.file.path)
        const text = (data.text || '').slice(0, 200000)
        db.prepare(`UPDATE chapter_pdfs SET extracted_text = ? WHERE id = ?`).run(text, info.lastInsertRowid)
        console.log(`[pdf-extract] pdf_id=${info.lastInsertRowid} chars=${text.length} done`)
      } catch (e) {
        console.warn(`[pdf-extract] pdf_id=${info.lastInsertRowid} failed:`, e.message)
      }
    })()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// List PDFs (admin: all; teacher: own + admin-uploaded for visibility)
router.get('/', requireAuth, (req, res) => {
  let rows
  if (req.user.role === 'admin') {
    rows = db.prepare(
      `SELECT p.*, u.full_name as teacher_name, u.username as teacher_username, u.role as teacher_role
       FROM chapter_pdfs p JOIN users u ON p.teacher_id = u.id
       ORDER BY p.uploaded_at DESC`
    ).all()
  } else {
    // Teacher sees their own PDFs + any PDFs uploaded by admin (admin_id = 1 by convention but we join properly)
    rows = db.prepare(
      `SELECT p.*, u.full_name as teacher_name, u.username as teacher_username, u.role as teacher_role
       FROM chapter_pdfs p JOIN users u ON p.teacher_id = u.id
       WHERE p.teacher_id = ? OR u.role = 'admin'
       ORDER BY p.uploaded_at DESC`
    ).all(req.user.id)
  }
  const safe = rows.map(({ extracted_text, ...r }) => ({
    ...r,
    has_text: !!extracted_text && extracted_text.length > 0,
  }))
  res.json({ pdfs: safe })
})

// Get one PDF's extracted text (teacher who owns it, or admin, or any teacher asking for an admin-uploaded PDF)
router.get('/:id/text', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT p.*, u.role as owner_role
    FROM chapter_pdfs p JOIN users u ON p.teacher_id = u.id
    WHERE p.id = ?
  `).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  const isOwn = row.teacher_id === req.user.id
  const isAdminOwned = row.owner_role === 'admin'
  if (req.user.role !== 'admin' && !isOwn && !isAdminOwned) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  res.json({ id: row.id, chapter_label: row.chapter_label, text: row.extracted_text || '' })
})

// Delete PDF
router.delete('/:id', requireAuth, requireRole('teacher'), (req, res) => {
  const row = db.prepare(`SELECT * FROM chapter_pdfs WHERE id = ? AND teacher_id = ?`).get(req.params.id, req.user.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  try {
    fs.unlinkSync(path.join(uploadsDir, row.stored_filename))
  } catch {}
  db.prepare(`DELETE FROM chapter_pdfs WHERE id = ?`).run(req.params.id)
  logAction(req.user.id, 'pdf_deleted', { pdf_id: req.params.id })
  res.json({ ok: true })
})

export default router
