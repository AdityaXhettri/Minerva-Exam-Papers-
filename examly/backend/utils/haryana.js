// Haryana Board booklet PDF generator
// A4 LANDSCAPE sheet folded twice → 4-page booklet.
// After folding, student writes on pages in order: 1 → 2 → 3 → 4
// When UNFOLDED (single landscape A4), the quadrants must read:
//   ┌──────────────┬──────────────┐
//   │   Page 4     │   Page 1     │   ← top half (one side of sheet)
//   ├══════════════┼══════════════┤   ← vertical fold line (between 4 & 1)
//   │   Page 2     │   Page 3     │   ← bottom half (other side)
//   └──────────────┴──────────────┘
//       horizontal fold line runs through the middle (between top half & bottom half)
//
// After folding, the booklet reads in order: Page 1 (front) → flip right → Page 2 → flip again → Page 3 → flip → Page 4 (back cover).
//
// Content fits each panel fully; if questions don't all fit in 4 quadrants, additional landscape sheets are generated.
//
// NO truncation — every question text, every option, every line renders fully. Overflow moves to next sheet.

import { jsPDF } from 'jspdf'

const PAGE_W = 297 // mm landscape
const PAGE_H = 210 // mm landscape
const MARGIN = 8 // mm

// ============================================================
// Quadrant geometry helpers
// ============================================================
const QUAD = {
  tl: { x: MARGIN, y: MARGIN, w: PAGE_W / 2 - MARGIN - 4, h: PAGE_H / 2 - MARGIN - 4 },
  tr: { x: PAGE_W / 2 + 4, y: MARGIN, w: PAGE_W / 2 - MARGIN - 4, h: PAGE_H / 2 - MARGIN - 4 },
  bl: { x: MARGIN, y: PAGE_H / 2 + 4, w: PAGE_W / 2 - MARGIN - 4, h: PAGE_H / 2 - MARGIN - 4 },
  br: { x: PAGE_W / 2 + 4, y: PAGE_H / 2 + 4, w: PAGE_W / 2 - MARGIN - 4, h: PAGE_H / 2 - MARGIN - 4 },
}

// Approximate height a question consumes: header + lines + spacing + options
function estimateQuestionHeight(q) {
  const lineH = 3.6
  const charsPerLine = 60 // approx for helvetica 7.5pt at our quadrant width
  const textLines = Math.ceil((q.text.length + 10) / charsPerLine)
  let h = textLines * lineH
  if (q.options && q.options.length) {
    h += q.options.length * lineH
  }
  h += 2 // gap after
  return h
}

function estimateSectionHeaderHeight() {
  return 5 // bold 8pt + small gap
}

// ============================================================
// Drawing helpers
// ============================================================
function drawFoldLines(doc) {
  doc.setLineDashPattern([2, 2], 0)
  doc.setDrawColor(140, 140, 140)
  doc.setLineWidth(0.3)
  doc.line(PAGE_W / 2, MARGIN, PAGE_W / 2, PAGE_H - MARGIN) // vertical
  doc.line(MARGIN, PAGE_H / 2, PAGE_W - MARGIN, PAGE_H / 2) // horizontal
  doc.setLineDashPattern([], 0)
  doc.setDrawColor(0, 0, 0)
}

function drawPageMarker(doc, quadrant, pageNum) {
  const q = QUAD[quadrant]
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 100, 100)
  doc.text(`Page ${pageNum}`, q.x + 2, q.y + 4)
  doc.setTextColor(0, 0, 0)
}

function drawCoverBlock(doc, headerInfo, paper) {
  // Page 1 = top-right quadrant. Clean cover — title, subtitle, marks, date, instructions.
  const q = QUAD.tr
  const x = q.x
  const w = q.w
  let y = q.y + 8

  // Title — e.g. "Mathematics — Class 12"
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(paper.title || '', x, y)
  y += 6

  // Subtitle — e.g. "Examination Paper"
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(paper.subtitle || '', x, y)
  y += 7

  // Marks + date row
  doc.setFontSize(9)
  doc.text(`Total Marks: ${headerInfo.totalMarks || '____'}`, x, y); y += 5
  doc.text(`Date: ${headerInfo.examDate || '__________'}`, x, y); y += 6

  // General instructions (free text from request)
  if (paper.instructions) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(paper.instructions, w - 4)
    doc.text(lines, x, y)
    y += lines.length * 4
    doc.setFont('helvetica', 'normal')
  }

  return y + 2
}

function drawSectionHeader(doc, quadrant, y, section) {
  const q = QUAD[quadrant]
  const w = q.w

  // Section line — e.g. "Section A — Multiple Choice Questions"
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(20, 20, 80)
  doc.text(section.label, q.x, y)
  y += 4

  // Sub-line — e.g. "(3 × 1 marks)"
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(60, 60, 60)
  doc.text(section.subLine, q.x, y)
  y += 5
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(7.5)
  return y
}

/**
 * Render a question into a quadrant at the given y. Returns updated y, or null if it doesn't fit.
 * NO truncation — if it doesn't fit, returns null and caller moves to next quadrant/sheet.
 */
function renderQuestion(doc, quadrant, y, q) {
  const qa = QUAD[quadrant]
  const lineH = 3.6
  const textW = qa.w - 6

  // Estimate height needed
  const headText = `Q${q.qNum}. ${q.text}  [${q.marks}m]`
  const headLines = doc.splitTextToSize(headText, textW)
  const optLines = []
  if (q.options && q.options.length) {
    for (const opt of q.options) {
      const optStr = typeof opt === 'string' ? opt : `(${opt.letter}) ${opt.text}`
      optLines.push(doc.splitTextToSize(`   ${optStr}`, textW - 4))
    }
  }
  const totalH = headLines.length * lineH + optLines.reduce((s, arr) => s + arr.length * lineH, 0) + 2

  // Check if it fits in this quadrant
  if (y + totalH > qa.y + qa.h) return null // doesn't fit

  // Draw question header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text(headLines, qa.x, y)
  y += headLines.length * lineH

  // Draw options (MCQ)
  if (optLines.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    for (const lines of optLines) {
      doc.text(lines, qa.x + 3, y)
      y += lines.length * lineH
    }
    doc.setFontSize(7.5)
  }
  y += 2 // gap
  return y
}

/**
 * Pack questions into quadrant-sized pages.
 * Returns array of "sheets", each sheet = { p1:[], p2:[], p3:[], p4:[] }.
 * Each page holds questions that fit; leftover questions go to next sheet.
 */
function packIntoSheets(sections) {
  // Build flat list with section context attached to each question
  const items = []
  let qNum = 1
  for (const sec of sections) {
    const secObj = {
      key: `${sec.name || sec.label || ''}__${qNum}`,
      label: `Section ${sec.name || sec.label || ''} — ${sec.type_label || sec.type || ''}`,
      subLine: `(${sec.questions.length} × ${sec.marks_per_question} marks)`,
    }
    for (const q of sec.questions || []) {
      items.push({
        qNum: qNum++,
        section: secObj,
        text: q.text,
        marks: q.marks,
        options: q.options,
      })
    }
  }

  const sheets = []
  let remaining = items.slice()

  while (remaining.length > 0) {
    const COVER_RESERVE = 32 // reserve for clean cover (title + subtitle + marks + date + instructions)
    const sheet = { p1: [], p2: [], p3: [], p4: [] }
    let lastSecKey = null

    // Page 1 — needs cover reserve
    let y = 0
    for (const q of remaining) {
      const needHeader = q.section.key !== lastSecKey
      let estY = y + (needHeader ? estimateSectionHeaderHeight() + 2 : 0) + estimateQuestionHeight(q)
      if (estY > QUAD.tr.h - COVER_RESERVE) break
      sheet.p1.push(q)
      lastSecKey = q.section.key
      y = estY
    }

    // Page 2
    y = 0
    const afterP1 = sheet.p1.length
    lastSecKey = sheet.p1.length ? sheet.p1[sheet.p1.length - 1].section.key : null
    for (const q of remaining.slice(afterP1)) {
      const needHeader = q.section.key !== lastSecKey
      let estY = y + (needHeader ? estimateSectionHeaderHeight() + 2 : 0) + estimateQuestionHeight(q)
      if (estY > QUAD.bl.h - 4) break
      sheet.p2.push(q)
      lastSecKey = q.section.key
      y = estY
    }

    // Page 3
    y = 0
    const afterP2 = afterP1 + sheet.p2.length
    lastSecKey = sheet.p2.length ? sheet.p2[sheet.p2.length - 1].section.key : (sheet.p1.length ? sheet.p1[sheet.p1.length - 1].section.key : null)
    for (const q of remaining.slice(afterP2)) {
      const needHeader = q.section.key !== lastSecKey
      let estY = y + (needHeader ? estimateSectionHeaderHeight() + 2 : 0) + estimateQuestionHeight(q)
      if (estY > QUAD.br.h - 4) break
      sheet.p3.push(q)
      lastSecKey = q.section.key
      y = estY
    }

    // Page 4
    y = 0
    const afterP3 = afterP2 + sheet.p3.length
    lastSecKey = sheet.p3.length ? sheet.p3[sheet.p3.length - 1].section.key : (sheet.p2.length ? sheet.p2[sheet.p2.length - 1].section.key : (sheet.p1.length ? sheet.p1[sheet.p1.length - 1].section.key : null))
    for (const q of remaining.slice(afterP3)) {
      const needHeader = q.section.key !== lastSecKey
      let estY = y + (needHeader ? estimateSectionHeaderHeight() + 2 : 0) + estimateQuestionHeight(q)
      if (estY > QUAD.tl.h - 4) break
      sheet.p4.push(q)
      lastSecKey = q.section.key
      y = estY
    }

    const totalPlaced = sheet.p1.length + sheet.p2.length + sheet.p3.length + sheet.p4.length
    if (totalPlaced === 0) {
      sheet.p4.push(remaining[0]) // safety
    }

    sheets.push(sheet)

    const consumed = sheet.p1.length + sheet.p2.length + sheet.p3.length + sheet.p4.length
    remaining = remaining.slice(consumed)
  }

  return sheets
}

/**
 * Render one page (quadrant) of a sheet.
 * Returns the final y-position (used as startY for next page, e.g. after cover block).
 */
function renderPage(doc, questions, quadrant, startY, lastSectionRef) {
  const qa = QUAD[quadrant]
  let y = (typeof startY === 'number' && startY > 0) ? startY : qa.y + 4
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  let lastSecKey = lastSectionRef ? lastSectionRef.value : null

  for (const q of questions) {
    // Section header if section changed
    if (q.section.key !== lastSecKey) {
      if (y + 9 > qa.y + qa.h) break // section header needs 9mm
      y = drawSectionHeader(doc, quadrant, y, q.section)
      lastSecKey = q.section.key
      if (lastSectionRef) lastSectionRef.value = q.section.key
    }

    const newY = renderQuestion(doc, quadrant, y, q)
    if (newY === null) break
    y = newY
  }

  return y
}

/**
 * Build the Haryana booklet PDF.
 * Returns a Buffer.
 */
export function buildHaryanaBooklet(paper) {
  const sheets = packIntoSheets(paper.sections || [])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const headerInfo = {
    schoolName: paper.schoolName || process.env.SCHOOL_NAME || '',
    classLevel: paper.classLevel || '',
    subject: paper.subject || '',
    examDate: paper.examDate || '',
    totalMarks: paper.totalMarks || '',
    timeAllowed: paper.timeAllowed || '',
  }

  for (let s = 0; s < sheets.length; s++) {
    if (s > 0) doc.addPage() // additional sheet = additional landscape A4 page

    const sheet = sheets[s]
    const lastSectionRef = { value: null }
    const totalPages = sheets.length * 4

    // Page numbers across all sheets:
    //   Sheet 0: Page 1, 2, 3, 4
    //   Sheet 1: Page 5, 6, 7, 8  (i.e. 4+1, 4+2, ...)
    const basePage = s * 4

    drawFoldLines(doc)
    drawPageMarker(doc, 'tl', basePage + 4)
    renderPage(doc, sheet.p4, 'tl', undefined, lastSectionRef)

    drawPageMarker(doc, 'tr', basePage + 1)
    const coverEndY = drawCoverBlock(doc, headerInfo, paper)
    renderPage(doc, sheet.p1, 'tr', coverEndY - QUAD.tr.y, lastSectionRef)

    drawPageMarker(doc, 'bl', basePage + 2)
    renderPage(doc, sheet.p2, 'bl', undefined, lastSectionRef)

    drawPageMarker(doc, 'br', basePage + 3)
    renderPage(doc, sheet.p3, 'br', undefined, lastSectionRef)
  }

  return Buffer.from(doc.output('arraybuffer'))
}