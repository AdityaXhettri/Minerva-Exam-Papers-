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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files allowed'))
  },
})

const router = express.Router()

// Upload chapter PDF (teacher only)
router.post('/', requireAuth, requireRole('teacher'), upload.single('file'), async (req, res) => {
  try {
    const { subject, class_level, chapter_label } = req.body
    if (!req.file) return res.status(400).json({ error: 'PDF file required' })
    if (!subject || !class_level || !chapter_label) {
      // cleanup
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'subject, class_level, chapter_label required' })
    }

    // Extract text
    let extracted = ''
    try {
      const data = await pdfParse(req.file.path)
      extracted = data.text || ''
    } catch (e) {
      console.warn('PDF text extraction failed:', e.message)
    }

    const info = db.prepare(
      `INSERT INTO chapter_pdfs (teacher_id, subject, class_level, chapter_label, original_filename, stored_filename, extracted_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id,
      subject,
      class_level,
      chapter_label,
      req.file.originalname,
      req.file.filename,
      extracted.slice(0, 200000) // cap to 200k chars
    )

    logAction(req.user.id, 'pdf_uploaded', {
      pdf_id: info.lastInsertRowid,
      subject, class_level, chapter_label,
      chars_extracted: extracted.length,
    })

    res.status(201).json({
      id: info.lastInsertRowid,
      subject,
      class_level,
      chapter_label,
      original_filename: req.file.originalname,
      extracted_chars: extracted.length,
      uploaded_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// List teacher's PDFs (teacher) or all PDFs (admin)
router.get('/', requireAuth, (req, res) => {
  let rows
  if (req.user.role === 'admin') {
    rows = db.prepare(
      `SELECT p.*, u.full_name as teacher_name, u.username as teacher_username
       FROM chapter_pdfs p JOIN users u ON p.teacher_id = u.id
       ORDER BY p.uploaded_at DESC`
    ).all()
  } else {
    rows = db.prepare(
      `SELECT * FROM chapter_pdfs WHERE teacher_id = ? ORDER BY uploaded_at DESC`
    ).all(req.user.id)
  }
  // Don't send huge extracted_text in list
  const safe = rows.map(({ extracted_text, ...r }) => ({
    ...r,
    has_text: !!extracted_text && extracted_text.length > 0,
  }))
  res.json({ pdfs: safe })
})

// Get one PDF's extracted text (teacher who owns it, or admin)
router.get('/:id/text', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM chapter_pdfs WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (req.user.role !== 'admin' && row.teacher_id !== req.user.id) {
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
