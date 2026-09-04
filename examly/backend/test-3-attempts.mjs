// test-3-attempts.mjs — generates 3 attempts of the same paper and writes 3 PDFs
import fs from 'fs'
import { db } from './db.js'
import { generateQuestions } from './services/ai.js'
import { recordQuestions, buildAvoidRepetitionBlock } from './services/questionHistory.js'
import { buildPaperPdf } from './utils/haryana.js'

// Clear question history for clean test
try {
  db.prepare('DELETE FROM question_history').run()
  console.log('Cleared question_history for clean test')
} catch (e) {
  console.warn('Could not clear history:', e.message)
}

const requestId = process.argv[2] ? Number(process.argv[2]) : 1
const row = db.prepare('SELECT * FROM paper_requests WHERE id = ?').get(requestId)
if (!row) {
  console.error(`No request with id=${requestId} found. Showing all available:`)
  const all = db.prepare('SELECT id, subject, class_level FROM paper_requests LIMIT 10').all()
  console.table(all)
  process.exit(1)
}

const sections = JSON.parse(row.sections_json)
const difficulty = JSON.parse(row.difficulty_json)
const pdfIds = JSON.parse(row.pdf_ids)
const placeholders = pdfIds.map(() => '?').join(',')
const pdfs = db
  .prepare(`SELECT chapter_label, original_filename, extracted_text FROM chapter_pdfs WHERE id IN (${placeholders})`)
  .all(...pdfIds)

console.log(`\n📋 Subject: ${row.subject} | Class: ${row.class_level} | Chapters: ${pdfs.length}`)
console.log(`   Chapters: ${pdfs.map((p) => p.chapter_label).join(', ')}`)
console.log(`   Sections: ${sections.length} | Total marks: ${row.total_marks}`)

const chaptersText = pdfs
  .map((p) => `--- Chapter: ${p.chapter_label} ---\n${(p.extracted_text || '').slice(0, 3000)}`)
  .join('\n\n')
const chapterLabels = pdfs.map((p) => p.chapter_label)

for (let attempt = 1; attempt <= 3; attempt++) {
  console.log(`\n========== ATTEMPT ${attempt} ==========`)
  const avoidBlock = buildAvoidRepetitionBlock({
    subject: row.subject,
    classLevel: row.class_level,
    maxItems: 30,
  })
  console.log(`Avoid-block length: ${avoidBlock.length} chars (history entries seen by AI)`)

  const paper = await generateQuestions({
    provider: 'groq',
    chaptersText,
    chapterLabels,
    extraRules: avoidBlock,
    request: {
      subject: row.subject,
      classLevel: row.class_level,
      totalMarks: row.total_marks,
      sections,
      difficulty,
      instructions: row.instructions,
    },
  })

  console.log(`Title: ${paper.title}`)
  let qCount = 0
  for (const sec of paper.sections || []) {
    qCount += (sec.questions || []).length
    const samples = (sec.questions || [])
      .slice(0, 2)
      .map((q) => q.text.slice(0, 90).replace(/\s+/g, ' '))
      .join('  ||  ')
    console.log(`  Section ${sec.name} [${sec.type || sec.contentType || 'mcq'}]: ${(sec.questions || []).length} qs — sample: ${samples}`)
  }
  console.log(`Total questions: ${qCount}`)

  recordQuestions({
    subject: row.subject,
    classLevel: row.class_level,
    sections: paper.sections || [],
  })

  const pdfBytes = buildPaperPdf({ paper })
  fs.writeFileSync(`test-attempt-${attempt}.pdf`, pdfBytes)
  console.log(`💾 Saved test-attempt-${attempt}.pdf (${pdfBytes.length} bytes)`)
}

console.log('\n✅ Done. Compare the 3 PDFs — questions should be substantially different.')
process.exit(0)
