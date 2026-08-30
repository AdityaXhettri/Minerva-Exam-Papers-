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
// jsPDF builds pages top-down, so we render: Page 4 first, then Page 1, then Page 2, then Page 3.
//
// The questions are split into 4 sequential chunks:
//   - chunk 1 → page 1 (questions Q1..Qk)
//   - chunk 2 → page 2 (questions Qk+1..Qm)
//   - chunk 3 → page 3 (questions Qm+1..Qn)
//   - chunk 4 → page 4 (questions Qn+1..end)

import { jsPDF } from 'jspdf'

const PAGE_W = 297 // mm landscape
const PAGE_H = 210 // mm landscape
const MARGIN = 8 // mm

/**
 * Distribute questions roughly evenly into 4 chunks.
 * MCQ (option-style) sections render with smaller marks; non-MCQ get full marks.
 */
function chunkQuestions(sections) {
  // Expand to a flat list of {text, marks, type, options?, correct?, sectionLabel, qNum}
  const flat = []
  let qNum = 1
  for (const sec of sections) {
    for (const q of sec.questions || []) {
      flat.push({
        qNum: qNum++,
        sectionLabel: sec.label || sec.name || 'Section',
        sectionType: sec.type,
        text: q.text,
        marks: q.marks,
        options: q.options,
        correct: q.correct,
      })
    }
  }
  const n = flat.length
  const a = Math.ceil(n / 4)
  const b = Math.ceil((n - a) / 3)
  const c = Math.ceil((n - a - b) / 2)
  const d = n - a - b - c
  return {
    p1: flat.slice(0, a),
    p2: flat.slice(a, a + b),
    p3: flat.slice(a + b, a + b + c),
    p4: flat.slice(a + b + c, a + b + c + d),
  }
}

function drawFoldLines(doc) {
  const cx = PAGE_W / 2
  const cy = PAGE_H / 2
  doc.setLineDashPattern([2, 2], 0)
  doc.setDrawColor(120, 120, 120)
  doc.setLineWidth(0.3)
  // Vertical fold line (between left & right halves)
  doc.line(cx, MARGIN, cx, PAGE_H - MARGIN)
  // Horizontal fold line (between top & bottom halves)
  doc.line(MARGIN, cy, PAGE_W - MARGIN, cy)
  doc.setLineDashPattern([], 0)
  doc.setDrawColor(0, 0, 0)
}

function drawPageHeader(doc, pageNum, totalPages, headerInfo) {
  // Header sits inside each quadrant near its outer edge
  const x = MARGIN + 2
  const y = MARGIN + 4
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(80, 80, 80)
  doc.text(`Page ${pageNum} of ${totalPages}`, x, y)
  doc.setTextColor(0, 0, 0)
}

function drawCoverBlock(doc, headerInfo) {
  // Page 1 = top-right quadrant. Put student info here.
  const x = PAGE_W / 2 + MARGIN
  const y = MARGIN + 8
  const w = PAGE_W / 2 - MARGIN * 2

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('EXAMINATION BOOKLET', x, y)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  let yy = y + 6
  doc.text(`School: ${headerInfo.schoolName || '__________'}`, x, yy); yy += 5
  doc.text(`Subject: ${headerInfo.subject || '__________'}`, x, yy); yy += 5
  doc.text(`Class: ${headerInfo.classLevel || '__________'}`, x, yy); yy += 5
  doc.text(`Date: ${headerInfo.examDate || '__________'}`, x, yy); yy += 5
  doc.text(`Max Marks: ${headerInfo.totalMarks || '____'}    Time: ${headerInfo.timeAllowed || '____'}`, x, yy); yy += 5
  yy += 2
  doc.text(`Student Name: __________________________`, x, yy); yy += 5
  doc.text(`Roll No: ___________   Section: _______`, x, yy); yy += 5
  doc.text(`Invigilator Sign: ____________________`, x, yy)
  // Return the y-position where the cover block ended so questions can start below it
  return yy + 4
}

function drawQuestionsInQuadrant(doc, questions, quadrant, startY) {
  // quadrant: 'tl' | 'tr' | 'bl' | 'br'
  // startY: optional absolute y to begin rendering (e.g. after cover block)
  const halfW = PAGE_W / 2
  const halfH = PAGE_H / 2
  const innerPad = 4

  const rects = {
    tl: { x: MARGIN, y: MARGIN, w: halfW - MARGIN - innerPad, h: halfH - MARGIN - innerPad },
    tr: { x: halfW + innerPad, y: MARGIN, w: halfW - MARGIN - innerPad, h: halfH - MARGIN - innerPad },
    bl: { x: MARGIN, y: halfH + innerPad, w: halfW - MARGIN - innerPad, h: halfH - MARGIN - innerPad },
    br: { x: halfW + innerPad, y: halfH + innerPad, w: halfW - MARGIN - innerPad, h: halfH - MARGIN - innerPad },
  }
  const r = rects[quadrant]

  let y = (typeof startY === 'number' && startY > r.y + 4) ? startY : r.y + 4
  const lineH = 4
  let lastSectionLabel = null
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')

  for (const q of questions) {
    if (y > r.y + r.h - lineH) {
      // overflow — add ellipsis
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      doc.text('…(continued on next page)', r.x, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      break
    }

    // Section badge — only when section changes within this quadrant
    if (q.sectionLabel && q.sectionLabel !== lastSectionLabel) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(40, 40, 100)
      doc.text(q.sectionLabel, r.x, y)
      y += lineH
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      lastSectionLabel = q.sectionLabel
    }

    // Question text + marks
    const marks = `[${q.marks}m]`
    const head = `Q${q.qNum}. ${q.text}  ${marks}`
    const lines = doc.splitTextToSize(head, r.w - 4)
    doc.text(lines, r.x, y)
    y += lines.length * lineH

    // Options for MCQ — DB stores them as strings like "(a) Quadratic equations"
    if (q.options && q.options.length) {
      doc.setFontSize(7)
      for (const opt of q.options) {
        if (y > r.y + r.h - lineH) break
        const optStr = typeof opt === 'string' ? opt : `(${opt.letter}) ${opt.text}`
        const optLines = doc.splitTextToSize(`   ${optStr}`, r.w - 6)
        doc.text(optLines, r.x + 2, y)
        y += optLines.length * lineH
      }
      doc.setFontSize(7.5)
    } else {
      // Answer space (3 short lines)
      const space = q.marks >= 3 ? 3 : 2
      for (let i = 0; i < space; i++) {
        if (y > r.y + r.h - lineH) break
        doc.setDrawColor(200, 200, 200)
        doc.line(r.x, y + 1, r.x + r.w - 4, y + 1)
        doc.setDrawColor(0, 0, 0)
        y += lineH
      }
    }
    y += 1
  }
}

/**
 * Build the Haryana booklet PDF.
 * Returns a Buffer.
 *
 * @param {Object} paper - {sections: [{label,type,questions:[]}], totalMarks, examDate, timeAllowed, schoolName, classLevel, subject, instructions}
 */
export function buildHaryanaBooklet(paper) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const sections = paper.sections || []
  const chunks = chunkQuestions(sections)

  const headerInfo = {
    schoolName: paper.schoolName || process.env.SCHOOL_NAME || '',
    classLevel: paper.classLevel || '',
    subject: paper.subject || '',
    examDate: paper.examDate || '',
    totalMarks: paper.totalMarks || '',
    timeAllowed: paper.timeAllowed || '',
  }

  // Single landscape sheet with all 4 quadrants
  drawFoldLines(doc)

  // Render order on the unfolded sheet:
  //   top-left  = Page 4 (q chunk 4)
  //   top-right = Page 1 (q chunk 1 + cover info)
  //   bot-left  = Page 2 (q chunk 2)
  //   bot-right = Page 3 (q chunk 3)

  drawPageHeader(doc, 4, 4, headerInfo)
  drawQuestionsInQuadrant(doc, chunks.p4, 'tl')

  drawPageHeader(doc, 1, 4, headerInfo)
  const coverEndY = drawCoverBlock(doc, headerInfo)
  drawQuestionsInQuadrant(doc, chunks.p1, 'tr', coverEndY)

  drawPageHeader(doc, 2, 4, headerInfo)
  drawQuestionsInQuadrant(doc, chunks.p2, 'bl')

  drawPageHeader(doc, 3, 4, headerInfo)
  drawQuestionsInQuadrant(doc, chunks.p3, 'br')

  return Buffer.from(doc.output('arraybuffer'))
}