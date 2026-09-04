import express from 'express'
import { db, logAction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { generateQuestions, activeProvider } from '../services/ai.js'
import { recordQuestions, buildAvoidRepetitionBlock } from '../services/questionHistory.js'

// Retry helper for rate-limited AI calls (Groq 429 / 5xx)
async function withRetry(fn, { attempts = 4, baseDelayMs = 15000 } = {}) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = String(err.message || '')
      const is429 = msg.includes('429') || msg.includes('Rate limit') || msg.includes('Too Many Requests')
      const is5xx = msg.startsWith('OpenAI-compatible error 5')
      if (!is429 && !is5xx) throw err
      if (i === attempts - 1) throw err
      const delay = baseDelayMs * (i + 1)
      console.warn(`AI rate-limited. Retrying in ${delay / 1000}s (attempt ${i + 1}/${attempts})…`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

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
    let chapterLabels = []
    if (pdfIds.length > 0) {
      const placeholders = pdfIds.map(() => '?').join(',')
      const pdfs = db.prepare(
        `SELECT chapter_label, original_filename, extracted_text FROM chapter_pdfs WHERE id IN (${placeholders})`
      ).all(...pdfIds)
      chapterLabels = pdfs.map((p) => p.chapter_label).filter(Boolean)
      chaptersText = pdfs.map((p) =>
        `--- Chapter: ${p.chapter_label} ---\n${(p.extracted_text || '').slice(0, 3000)}`
      ).join('\n\n')
    }

    if (!chaptersText.trim()) {
      return res.status(400).json({ error: 'No chapter content found for this request. Make sure the teacher uploaded PDFs and they had extractable text.' })
    }

    // Truncate chapter text to stay within Groq's per-minute token limit (roughly 4 chars per token)
    // Generous cap for non-reasoning models: ~24000 chars total ≈ 6000 tokens of content
    const MAX_CHARS = 24000
    if (chaptersText.length > MAX_CHARS) {
      chaptersText = chaptersText.slice(0, MAX_CHARS) + '\n\n[...chapter content truncated for length...]'
    }

    // Build "avoid repetition" block from history of previous questions for this subject+class
    const avoidBlock = buildAvoidRepetitionBlock({
      subject: reqRow.subject,
      classLevel: reqRow.class_level,
      maxItems: 30,
    })

    const paper = await withRetry(() => generateQuestions({
      provider,
      chaptersText,
      chapterLabels,
      extraRules: avoidBlock,
      request: {
        subject: reqRow.subject,
        classLevel: reqRow.class_level,
        totalMarks: reqRow.total_marks,
        sections,
        difficulty,
        instructions: reqRow.instructions,
      },
    }))

    // Record every generated question so future generations avoid them
    recordQuestions({
      subject: reqRow.subject,
      classLevel: reqRow.class_level,
      paperId: null, // paper isn't saved yet
      sections: paper.sections || [],
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
