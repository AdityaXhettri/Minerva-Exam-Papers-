// Generates 3 valid Accountancy test papers. Does NOT touch the DB.
// Run: GROQ_MODEL=openai/gpt-oss-120b node make-test-papers.mjs

import 'dotenv/config'
import { generateQuestions } from './services/ai.js'
import { buildPaperPdf } from './utils/haryana.js'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = join(tmpdir(), 'examly-accountancy-test-papers')
await rm(dir, { recursive: true, force: true })
await mkdir(dir, { recursive: true })

const sections = [
  { name: 'A', type: 'mcq', contentType: 'mcq', question_count: 10, marks_per_question: 1 },
  { name: 'B', type: 'vshort', contentType: 'vshort', question_count: 5, marks_per_question: 2 },
  { name: 'C', type: 'short', contentType: 'short', question_count: 5, marks_per_question: 3 },
  { name: 'D', type: 'long', contentType: 'long', question_count: 3, marks_per_question: 5 },
]
const request = {
  subject: 'Accountancy',
  classLevel: '12',
  totalMarks: 60,
  sections,
  difficulty: { easy: 30, medium: 50, hard: 20 },
  instructions: '',
}

const chaptersText =
  'Chapter Partnership (Indian Partnership Act 1932): section 4 definition, essential features, mutual agency, profit sharing; absence of deed rules; partners capital accounts (fixed / fluctuating), distribution of profit, appropriation account, interest on capital, interest on drawings, partners salary, commission, reserve; profit sharing ratio, guarantee of profit, reconstitution of firm - admission, retirement, death, dissolution; goodwill valuation, revaluation account, past adjustments.'

const expectedCounts = [10, 5, 5, 3]
const outputPaths = []

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (let paperNo = 1; paperNo <= 3; paperNo++) {
  let paper = null
  let lastError = null

  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const generated = await generateQuestions({
        provider: 'groq',
        chaptersText,
        chapterLabels: ['Partnership'],
        extraRules:
          'Create a new, differently worded paper for test paper ' +
          paperNo +
          ' of 3. Use new wording and different numerical values for every question.',
        request,
      })
      const counts = (generated.sections || []).map((s) => s.questions?.length || 0)
      if (counts.join(',') === expectedCounts.join(',')) {
        paper = generated
        break
      }
      lastError = new Error('counts ' + counts.join(',') + ' on attempt ' + attempt)
    } catch (err) {
      lastError = err
      const m = String(err && err.message ? err.message : '')
      const is429 = m.includes('429') || m.includes('Rate limit')
      if (is429) {
        const waitMs = 30000 + attempt * 15000
        console.error('rate limited, waiting ' + Math.round(waitMs / 1000) + 's…')
        await sleep(waitMs)
        continue
      }
    }
    await sleep(2000)
  }

  if (!paper) throw lastError || new Error('Paper ' + paperNo + ' could not be generated')

  const counts = (paper.sections || []).map((s) => s.questions?.length || 0)
  if (counts.join(',') !== expectedCounts.join(',')) {
    throw new Error('Paper ' + paperNo + ' invalid counts: ' + counts.join(','))
  }

  // Use the requested section marks for rendering (test artifact only).
  let computedMarks = 0
  for (let i = 0; i < paper.sections.length; i++) {
    const section = paper.sections[i]
    const wanted = sections[i]
    section.name = wanted.name
    section.marks_per_question = wanted.marks_per_question
    for (const q of section.questions || []) {
      q.marks = wanted.marks_per_question
      computedMarks += wanted.marks_per_question
    }
  }
  if (computedMarks !== 60) throw new Error('Paper ' + paperNo + ' invalid marks: ' + computedMarks)

  paper.title = 'Accountancy — Class 12'
  paper.subtitle = 'Examination Paper'
  paper.totalMarks = 60

  const path = join(dir, 'accountancy-test-paper-' + paperNo + '.pdf')
  const pdf = buildPaperPdf(paper)
  if (!Buffer.isBuffer(pdf) || pdf.length < 8000) {
    throw new Error('Paper ' + paperNo + ' PDF too small: ' + pdf.length + ' bytes')
  }
  await writeFile(path, pdf)
  outputPaths.push({ paper: paperNo, questions: counts.reduce((a, b) => a + b, 0), marks: computedMarks, bytes: pdf.length, path })
}

console.log(JSON.stringify(outputPaths, null, 2))
