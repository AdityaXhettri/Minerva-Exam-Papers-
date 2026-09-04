// Haryana Board style: A4 landscape, divided into 4 quadrants with fold lines.
// Print 2 pages back-to-back → fold twice → becomes a 4-page exam booklet.

import jsPDF from 'jspdf'

const PAGE_W = 297 // mm landscape
const PAGE_H = 210
const QUAD_W = PAGE_W / 2
const QUAD_H = PAGE_H / 2

// Convert mm to jsPDF pt (1 mm ≈ 2.8346 pt)
const mmToPt = (mm) => mm * 2.8346

export function generateHaryanaPaperPDF({ paper, answerKey = null }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })

  const questions = paper.sections.flatMap((s) =>
    s.questions.map((q) => ({ ...q, sectionName: s.name, typeLabel: s.type_label, marksPerQ: s.marks_per_question }))
  )

  // Split questions into two halves
  const half = Math.ceil(questions.length / 2)
  const firstHalf = questions.slice(0, half)
  const secondHalf = questions.slice(half)

  drawSheet(doc, 1)
  drawQuadrant1(doc, paper)
  drawQuadrant2(doc, paper, firstHalf)

  doc.addPage('a4', 'landscape')
  drawSheet(doc, 2)
  drawQuadrant3(doc, paper, secondHalf)
  drawQuadrant4(doc, paper)

  // Append answer key on a separate A4 page (admin-only, single page)
  if (answerKey?.sections?.length > 0) {
    doc.addPage('a4', 'landscape')
    drawAnswerKeyPage(doc, paper, answerKey)
  }

  doc.save(`${paper.title.replace(/\s+/g, '_')}_paper.pdf`)
}

function drawSheet(doc, pageNum) {
  // Outer border (the A4 sheet edge)
  doc.setLineWidth(0.5)
  doc.setDrawColor(0, 0, 0)
  doc.rect(mmToPt(5), mmToPt(5), mmToPt(PAGE_W - 10), mmToPt(PAGE_H - 10))

  // Dashed fold lines
  doc.setLineDashPattern(2, 2, 0)
  doc.setLineWidth(0.3)
  doc.setDrawColor(120, 120, 120)
  // Vertical fold (middle)
  doc.line(mmToPt(PAGE_W / 2), mmToPt(5), mmToPt(PAGE_W / 2), mmToPt(PAGE_H - 5))
  // Horizontal fold (middle)
  doc.line(mmToPt(5), mmToPt(PAGE_H / 2), mmToPt(PAGE_W - 5), mmToPt(PAGE_H / 2))
  doc.setLineDashPattern([], 0)

  // Tiny page indicator
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`Sheet ${pageNum}/2`, mmToPt(PAGE_W - 18), mmToPt(PAGE_H - 6))
}

// QUADRANT 1 (top-left): Cover page info
function drawQuadrant1(doc, paper) {
  const x0 = mmToPt(6)
  const y0 = mmToPt(7)

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(paper.title || 'Examination', x0, y0 + 8)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(paper.subtitle || 'Examination Paper', x0, y0 + 14)

  // Info box
  const boxX = x0
  const boxY = y0 + 20
  const boxW = QUAD_W - 6
  const boxH = 70

  doc.setLineWidth(0.4)
  doc.rect(boxX, boxY, mmToPt(boxW), mmToPt(boxH))

  const lines = [
    ['Date', '____________'],
    ['Class', String(paper.class_level || '')],
    ['Subject', paper.subject || ''],
    ['Total Marks', String(paper.total_marks || '')],
    ["Student's Name", '________________________________'],
    ["Roll No",       '____________________'],
    ["Invigilator's Signature", '____________________'],
  ]

  doc.setFontSize(9)
  let lineY = boxY + 7
  lines.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${k}:`, boxX + 3, lineY)
    doc.setFont('helvetica', 'normal')
    doc.text(v, boxX + 35, lineY)
    lineY += 9
  })

  // Instructions
  const instrY = boxY + mmToPt(boxH) + 8
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  const instrLines = doc.splitTextToSize(paper.instructions || 'All questions are compulsory.', mmToPt(QUAD_W - 10))
  doc.text(instrLines, x0, instrY)
}

// QUADRANT 2 (top-right): First half of questions
function drawQuadrant2(doc, paper, questions) {
  const x0 = mmToPt(PAGE_W / 2 + 4)
  const y0 = mmToPt(7)
  const maxH = QUAD_H - 10 // mm

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Questions', x0, y0 + 5)

  let y = y0 + 10
  let currentSection = null
  const lineHeight = 4.2

  questions.forEach((q, i) => {
    if (q.sectionName !== currentSection) {
      currentSection = q.sectionName
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`Section ${q.sectionName} — ${q.typeLabel || ''}  (${q.marksPerQ}m each)`, x0, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
    }

    const qText = `${q.number}. ${q.text}`
    const wrapped = doc.splitTextToSize(qText, mmToPt(QUAD_W - 8))
    if (y + wrapped.length * lineHeight > maxH) {
      doc.text('(continued on back)', x0, mmToPt(PAGE_H / 2 - 4))
      return
    }
    doc.text(wrapped, x0, y)
    y += wrapped.length * lineHeight + 1

    if (q.options) {
      q.options.forEach((o) => {
        doc.text(o, x0 + 4, y)
        y += lineHeight
      })
    }
  })
}

// QUADRANT 3 (bottom-left): Second half of questions
function drawQuadrant3(doc, paper, questions) {
  const x0 = mmToPt(6)
  const y0 = mmToPt(PAGE_H / 2 + 5)
  const maxY = mmToPt(PAGE_H - 8)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Questions (continued)', x0, y0)

  let y = y0 + 6
  let currentSection = null
  const lineHeight = 4.2

  questions.forEach((q, i) => {
    if (q.sectionName !== currentSection) {
      currentSection = q.sectionName
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`Section ${q.sectionName} — ${q.typeLabel || ''}`, x0, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
    }

    const qText = `${q.number}. ${q.text}`
    const wrapped = doc.splitTextToSize(qText, mmToPt(QUAD_W - 8))
    if (y + wrapped.length * lineHeight > maxY) {
      doc.text('(end)', x0, maxY - 4)
      return
    }
    doc.text(wrapped, x0, y)
    y += wrapped.length * lineHeight + 1

    if (q.options) {
      q.options.forEach((o) => {
        doc.text(o, x0 + 4, y)
        y += lineHeight
      })
    }
  })
}

// QUADRANT 4 (bottom-right): Rough work / blank
function drawQuadrant4(doc, paper) {
  const x0 = mmToPt(PAGE_W / 2 + 4)
  const y0 = mmToPt(PAGE_H / 2 + 5)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Rough Work', x0, y0)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('— Do not write answers here —', x0, y0 + 5)

  // Lined area
  doc.setTextColor(0, 0, 0)
  const lines = 20
  const startY = y0 + 12
  const lineSpacing = (QUAD_H - 18) / lines
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  for (let i = 0; i < lines; i++) {
    const ly = startY + i * lineSpacing
    doc.line(mmToPt(PAGE_W / 2 + 4), ly, mmToPt(PAGE_W - 6), ly)
  }
}

function drawAnswerKeyPage(doc, paper, answerKey) {
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(180, 0, 0)
  doc.text('ANSWER KEY — ADMIN ONLY', mmToPt(10), mmToPt(15))

  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(`${paper.title} — ${paper.total_marks} marks`, mmToPt(10), mmToPt(22))

  let y = mmToPt(30)
  doc.setFontSize(10)

  // Column geometry: 2-column layout (number+answer).
  // Each row uses the height of the TALLER column entry so they stay aligned.
  const PAGE_BOTTOM = mmToPt(PAGE_H - 10)
  const COL1_X = mmToPt(10)
  const COL2_X = mmToPt(155)
  const NUM_W = mmToPt(14)
  const ANSWER_W = mmToPt(120)
  const LINE_H = mmToPt(5.2)
  const SECTION_GAP = mmToPt(4)
  const PARA_INDENT = mmToPt(3)

  // Helper: how many lines does this answer take, given the drawable width?
  function linesFor(text) {
    const t = String(text || '')
    const arr = doc.splitTextToSize(t, ANSWER_W - NUM_W)
    return Math.max(1, arr.length)
  }

  // Page-break helper
  function ensureSpace(neededH) {
    if (y + neededH > PAGE_BOTTOM) {
      doc.addPage('a4', 'landscape')
      y = mmToPt(15)
    }
  }

  answerKey.sections.forEach((sec) => {
    const isOptionSection = sec.qtype === 'mcq' || sec.qtype === 'mcq_ar' || sec.qtype === 'truefalse'
    const half = Math.ceil(sec.answers.length / 2)
    const col1 = sec.answers.slice(0, half)
    const col2 = sec.answers.slice(half)

    // Pre-compute every answer's wrapped line count so we can plan pagination correctly.
    const c1Lines = col1.map((a) => linesFor(a.answer))
    const c2Lines = col2.map((a) => linesFor(a.answer))

    // Render Section header (with page-break check)
    const headerH = LINE_H + mmToPt(2)
    ensureSpace(headerH)
    doc.setFont('helvetica', 'bold')
    doc.text(`Section ${sec.name}`, mmToPt(10), y)
    y += LINE_H + mmToPt(1)
    doc.setFont('helvetica', 'normal')

    // Render row-by-row, advancing y by max(lines_left, lines_right) per row.
    for (let i = 0; i < half; i++) {
      const a1 = col1[i]
      const a2 = col2[i]
      const ln1 = c1Lines[i] || 0
      const ln2 = c2Lines[i] || 0
      // Each descriptive answer gets one extra blank line as examiner note space.
      // MCQ/A&R do not — keep them compact.
      const pad1 = (a1 && !isOptionSection) ? 1 : 0
      const pad2 = (a2 && !isOptionSection) ? 1 : 0
      const h1 = (ln1 + pad1) * LINE_H
      const h2 = (ln2 + pad2) * LINE_H
      const rowH = Math.max(h1, h2, isOptionSection ? LINE_H : 2 * LINE_H)

      // Page-break BEFORE drawing the row if it won't fit
      ensureSpace(rowH + mmToPt(1))

      const rowTopY = y

      // Draw column 1
      if (a1) {
        doc.setFont('helvetica', 'bold')
        doc.text(`${a1.number}:`, COL1_X, rowTopY)
        doc.setFont('helvetica', 'normal')
        const wrapped = doc.splitTextToSize(String(a1.answer || ''), ANSWER_W - NUM_W)
        doc.text(wrapped[0] || '', COL1_X + NUM_W, rowTopY)
        for (let li = 1; li < wrapped.length; li++) {
          doc.text(wrapped[li], COL1_X + NUM_W + PARA_INDENT, rowTopY + li * LINE_H)
        }
      }

      // Draw column 2
      if (a2) {
        doc.setFont('helvetica', 'bold')
        doc.text(`${a2.number}:`, COL2_X, rowTopY)
        doc.setFont('helvetica', 'normal')
        const wrapped = doc.splitTextToSize(String(a2.answer || ''), ANSWER_W - NUM_W)
        doc.text(wrapped[0] || '', COL2_X + NUM_W, rowTopY)
        for (let li = 1; li < wrapped.length; li++) {
          doc.text(wrapped[li], COL2_X + NUM_W + PARA_INDENT, rowTopY + li * LINE_H)
        }
      }

      // Advance by the row height (so both columns stay aligned on the same horizontal band)
      y = rowTopY + rowH
    }

    y += SECTION_GAP
  })
}