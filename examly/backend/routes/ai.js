import express from 'express'
import { db, logAction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { generateQuestions, activeProvider } from '../services/ai.js'

const router = express.Router()

// Get which AI provider is configured
router.get('/provider', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ provider: activeProvider() })
})

// Generate questions from PDFs for a request
router.post('/generate', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const provider = activeProvider()
    if (!provider) return res.status(503).json({ error: 'No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in backend/.env' })

    const { request_id } = req.body || {}
    if (!request_id) return res.status(400).json({ error: 'request_id required' })

    const reqRow = db.prepare(`SELECT * FROM paper_requests WHERE id = ?`).get(request_id)
    if (!reqRow) return res.status(404).json({ error: 'Request not found' })

    const sections = JSON.parse(reqRow.sections_json || '[]')
    const difficulty = JSON.parse(reqRow.difficulty_json || '{}')
    const pdfIds = JSON.parse(reqRow.pdf_ids || '[]')

    let chaptersText = ''
    if (pdfIds.length > 0) {
      const placeholders = pdfIds.map(() => '?').join(',')
      const pdfs = db.prepare(
        `SELECT chapter_label, original_filename, extracted_text FROM chapter_pdfs WHERE id IN (${placeholders})`
      ).all(...pdfIds)
      chaptersText = pdfs.map((p) =>
        `--- Chapter: ${p.chapter_label} (file: ${p.original_filename}) ---\n${(p.extracted_text || '').slice(0, 30000)}`
      ).join('\n\n')
    }

    if (!chaptersText.trim()) {
      return res.status(400).json({ error: 'No chapter content found for this request. Make sure the teacher uploaded PDFs and they had extractable text.' })
    }

    const paper = await generateQuestions({
      provider,
      chaptersText,
      request: {
        subject: reqRow.subject,
        classLevel: reqRow.class_level,
        totalMarks: reqRow.total_marks,
        sections,
        difficulty,
        instructions: reqRow.instructions,
      },
    })

    logAction(req.user.id, 'ai_paper_generated', {
      request_id,
      provider,
      sections_count: paper.sections?.length,
    })

    res.json({ paper, provider })
  } catch (err) {
    console.error('AI generation error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
