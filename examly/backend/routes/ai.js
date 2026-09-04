import express from 'express'
import { createHash } from 'node:crypto'
import { db, logAction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { generateQuestions, activeProvider } from '../services/ai.js'
import { recordQuestions, buildAvoidRepetitionBlock } from '../services/questionHistory.js'
import { buildPaperPdf } from '../utils/haryana.js'

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

// TEST MODE: Generate N papers for same subject/class/chapter for diversity testing
// Same logic, but streams PDF bytes directly when ?pdf=1 is set (used by save-test-pdfs.mjs)
// Does NOT save anything to DB. Uses real AI but skips DB writes.
// Body: { subject, class_level, chapter_text, chapter_label, count }
router.post('/test-batch', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const provider = activeProvider()
    if (!provider) return res.status(503).json({ error: 'No AI provider configured' })

    const { subject = 'Accountancy', class_level = '12', chapter_text = '', chapter_label = 'Partnership', count = 3 } = req.body || {}
    const sections = [
      { name: 'A', type: 'mcq',    contentType: 'mcq',    question_count: 10, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort', question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',  question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'long',   contentType: 'long',   question_count: 3,  marks_per_question: 5 },
    ]
    const difficulty = { easy: 30, medium: 50, hard: 20 }
    const totalMarks = 60

    // Build chapter text — use provided text or a sensible Accountancy default
    const chaptersText = chapter_text && chapter_text.length > 50
      ? `--- Chapter: ${chapter_label} ---\n${chapter_text.slice(0, 6000)}`
      : `--- Chapter: ${chapter_label} (Partnership - Indian Partnership Act 1932) ---\nThe Indian Partnership Act 1932 defines partnership under Section 4 as the relation between persons who have agreed to share the profits of a business carried on by all or any of them acting for all. Essential features: two or more persons, agreement, lawful business, profit sharing, mutual agency. No separate legal entity. Firm name registration optional. In absence of partnership deed, profits shared equally, no interest on capital or drawings, no salary to partners. Partnership accounting peculiarities: partners' capital accounts (fixed and fluctuating methods), distribution of profit, appropriation account for interest on capital, drawings, salaries, commission, reserve. Profit sharing ratio, guarantee of profit, interest on capital, interest on drawings, past adjustments, reconstitution of firm (admission, retirement, death, dissolution), goodwill valuation, revaluation account, partners' capital accounts.`

    const results = []
    const pdfBuffers = []

    for (let i = 0; i < Math.min(count, 5); i++) {
      try {
        // Build avoid block from current DB state for diversity
        const avoidBlock = buildAvoidRepetitionBlock({
          subject, classLevel: String(class_level), maxItems: 40,
        })

        const paper = await withRetry(() => generateQuestions({
          provider,
          chaptersText,
          chapterLabels: [chapter_label],
          extraRules: avoidBlock,
          request: { subject, classLevel: String(class_level), totalMarks, sections, difficulty, instructions: '' },
        }))

        // Compute fingerprint stats for diversity check
        const allQs = []
        for (const sec of paper.sections || []) {
          for (const q of sec.questions || []) allQs.push(q.text)
        }
        const fps = allQs.map((t) => createHash('sha256').update(t.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)).digest('hex').slice(0, 12))

        results.push({
          index: i + 1,
          ok: true,
          questionCount: allQs.length,
          sample: allQs.slice(0, 5),
          fingerprints: fps,
        })

        // Build PDF buffer
        try {
          const pdfBuf = await buildPaperPdf(paper)
          pdfBuffers.push({ index: i + 1, buf: pdfBuf })
        } catch (pdfErr) {
          results[i].pdfError = String(pdfErr.message || pdfErr)
        }

        // DO NOT save to question_history — keep DB clean
      } catch (err) {
        results.push({ index: i + 1, ok: false, error: String(err.message || err) })
      }
    }

    // Cross-paper fingerprint overlap (rough diversity check)
    const fpSets = results.filter((r) => r.ok).map((r) => new Set(r.fingerprints))
    let dupCount = 0
    for (let i = 0; i < fpSets.length; i++) {
      for (let j = i + 1; j < fpSets.length; j++) {
        for (const fp of fpSets[i]) if (fpSets[j].has(fp)) dupCount++
      }
    }

    if (String(req.query.pdf || '') === '1') {
      const targetIndex = Math.max(1, Math.min(pdfBuffers.length, Number(req.query.index) || 1))
      const target = pdfBuffers.find((p) => p.index === targetIndex)
      if (target) {
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="accountancy-test-paper-${targetIndex}.pdf"`)
        return res.send(target.buf)
      }
      return res.status(404).json({ error: 'paper not found' })
    }

    res.json({
      provider,
      subject, class_level, chapter_label,
      papers: results,
      diversity: {
        total_questions: results.reduce((s, r) => s + (r.questionCount || 0), 0),
        cross_paper_exact_duplicates: dupCount,
        verdict: dupCount <= 2 ? 'EXCELLENT' : dupCount <= 6 ? 'OK' : 'POOR',
      },
      pdfs: pdfBuffers.map((p) => ({ index: p.index, size: p.buf.length })),
    })
  } catch (err) {
    console.error('test-batch error:', err)
    res.status(500).json({ error: err.message })
  }
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
