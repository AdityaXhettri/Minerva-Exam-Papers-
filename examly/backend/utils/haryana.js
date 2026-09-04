// Exam paper PDF generator — A4, 4-column options, character-level safe wrap.
// Each question is laid out independently; estimate = actual rendering.

import { jsPDF } from 'jspdf'

const PAGE_W = 210 // mm portrait A4
const PAGE_H = 297 // mm portrait A4

// ============================================================
// SECTION + QUESTION PACKING
// ============================================================
function packSections(sections) {
  const items = []
  let qNum = 1
  for (const sec of sections) {
    const totalMarks = (sec.questions?.length || 0) * (sec.marks_per_question || 0)
    const secObj = {
      label: `Section ${sec.name || sec.label || ''} — ${sec.type_label || friendlyType(sec.type) || ''}`,
      subLine: `${sec.questions?.length || 0} × ${sec.marks_per_question || 0} = ${totalMarks} marks`,
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
  return items
}

function friendlyType(t) {
  switch ((t || '').toLowerCase()) {
    case 'mcq': return 'Multiple Choice Questions'
    case 'vshort': return 'Very Short Answer'
    case 'short': return 'Short Answer'
    case 'long': return 'Long Answer'
    case 'fill': return 'Fill in the Blanks'
    case 'truefalse': return 'True / False'
    default: return ''
  }
}

// ============================================================
// SAFE TEXT WRAP — ₹ symbol replaced with "Rs." for reliable width
// jsPDF's helvetica font under-reports ₹ width causing overflow.
// We replace ₹ with "Rs." (3 ASCII chars, exact known width) for
// both measurement AND final output — guaranteed to never overflow.
// ============================================================

function safeWrap(doc, text, maxW) {
  if (!text) return ['']
  const safeMaxW = maxW * 0.95 // 5% safety margin — Rs. is ASCII, exact width

  // Replace ₹ with "Rs." for both measurement and display
  const measureText = text.replace(/₹/g, 'Rs.')

  // Use manualWrap instead of splitTextToSize — jsPDF's splitTextToSize can
  // produce character-by-character spaced output when text contains runs of
  // multiple spaces, which is exactly the visual artifact we saw in answer-keys.
  return manualWrap(measureText, safeMaxW, (s) => doc.getTextWidth(s))
}

// ============================================================
// LAYOUT A QUESTION — returns { height, render }
// Computes exact height first (for pagination), then renders at given y.
// ============================================================
// MONOSPACE TABLE RENDERER
// Detects lines starting with a pipe-character separated structure (e.g.
// "Particulars | Debit (Rs.) | Credit (Rs.)") and renders the whole question
// in 'courier' so columns line up. Other questions fall back to normal layout.
// ============================================================
function looksLikeTableText(text) {
  if (!text || typeof text !== 'string') return false
  const lines = text.split('\n')
  let pipeLines = 0
  for (const l of lines) {
    if (l.includes('|') && l.split('|').length >= 3) pipeLines += 1
  }
  return pipeLines >= 2 // header + at least one row
}

// Manual wrap respecting whitespace — used in NOTE sections / answer keys.
// Returns wrapped lines that fit within maxW.
//
// Tokenization uses `replace(/\s+/g, ' ')` to collapse runs of whitespace,
// then splits on single space. This guarantees consistent output regardless
// of how many consecutive spaces the input contained.
//
// For monospace fonts (Courier 9pt at A4 width), we additionally enforce a
// strict character count cap to avoid jsPDF getTextWidth() under-estimates
// producing character-spread output near the right margin.
function manualWrap(text, maxW, getWidth, charCap = null) {
  const result = []
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      result.push('')
      continue
    }
    const tokens = paragraph.replace(/\s+/g, ' ').split(' ')
    let current = ''
    for (const tok of tokens) {
      const candidate = current ? `${current} ${tok}` : tok
      const candidateW = getWidth(candidate)
      const tooWideWidth = current !== '' && candidateW > maxW
      const tooWideChars = charCap !== null && candidate.length > charCap
      if (current === '' || (!tooWideWidth && !tooWideChars)) {
        current = candidate
      } else {
        result.push(current)
        current = tok
      }
    }
    if (current) result.push(current)
  }
  return result
}

function renderTableText(doc, text, x, y, contentW, lineH) {
  const lines = text.split('\n')
  doc.setFont('courier', 'normal')
  const monoSize = 9
  doc.setFontSize(monoSize)
  doc.setTextColor(0, 0, 0)
  let cursorY = y
  for (const ln of lines) {
    if (ln === '') { cursorY += lineH * 0.78; continue }
    // A4 9pt Courier = ~95 chars per line at contentW ≈ 170mm; cap at 92 for safety.
    const wrapped = manualWrap(ln, contentW - 0.5, (s) => doc.getTextWidth(s), 92)
    for (const w of wrapped) {
      doc.text(w, x, cursorY, { baseline: 'top' })
      cursorY += lineH * 0.78
    }
  }
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  return cursorY
}

// ============================================================
function layoutQuestion(doc, item, opts, contentW) {
  const { qTextSize, optionSize, lineH, qGap } = opts

  const isTable = looksLikeTableText(item.text)

  doc.setFont(isTable ? 'courier' : 'helvetica', 'normal')
  doc.setFontSize(isTable ? 9 : qTextSize)

  const headStr = `Q${item.qNum}.`
  const numW = doc.getTextWidth(headStr + ' ')
  const textMaxW = contentW - numW

  // 1) Wrap question text safely
  const textLines = safeWrap(doc, item.text, textMaxW)
  let h = textLines.length * lineH

  // 2) Options — 2-column vertical layout (wider columns, lambi options fit honge)
  let optLayout = null
  if (item.options && item.options.length) {
    doc.setFontSize(optionSize)
    const optIndent = 4
    const optGap = 4
    const optColW = (contentW - optIndent - optGap) / 2

    // Build per-option wrap info — 2 columns
    optLayout = item.options.map((opt, i) => {
      const text = typeof opt === 'string' ? opt : opt.text
      const lbl = `(${String.fromCharCode(97 + i)}) ${text}`
      const lines = safeWrap(doc, lbl, optColW)
      return { lbl, lines, col: i % 2, row: Math.floor(i / 2), lineCount: lines.length }
    })

    // Group by row, find max lineCount per row
    const numRows = Math.ceil(item.options.length / 2)
    const rowHeights = []
    for (let r = 0; r < numRows; r++) {
      let max = 1
      for (const o of optLayout) {
        if (o.row === r && o.lineCount > max) max = o.lineCount
      }
      rowHeights.push(max * lineH)
    }
    const totalOptH = rowHeights.reduce((s, x) => s + x, 0)
    h += totalOptH
  }

  h += qGap // gap after each question

  return {
    height: h,
    render: (doc, y) => {
      doc.setFont(isTable ? 'courier' : 'helvetica', 'normal')
      doc.setFontSize(isTable ? 9 : qTextSize)
      doc.setTextColor(0, 0, 0)
      doc.text(headStr, opts.marginX, y)
      let cursorY
      if (isTable) {
        // Table-style question — render every line (including non-pipe lines) in monospace
        cursorY = renderTableText(doc, item.text, opts.marginX + numW, y, textMaxW, lineH)
      } else {
        // Standard wrapped text
        doc.text(textLines, opts.marginX + numW, y)
        cursorY = y + textLines.length * lineH
      }

      // Render options — 2 columns
      if (optLayout) {
        doc.setFontSize(optionSize)
        doc.setTextColor(0, 0, 0)
        const optIndent = 4
        const optGap = 4
        const optColW = (contentW - optIndent - optGap) / 2
        let rowY = cursorY + 1
        const numRows = Math.ceil(item.options.length / 2)
        for (let r = 0; r < numRows; r++) {
          let rowMaxLines = 1
          for (const o of optLayout) {
            if (o.row === r && o.lineCount > rowMaxLines) rowMaxLines = o.lineCount
          }
          for (const o of optLayout) {
            if (o.row !== r) continue
            const xPos = opts.marginX + optIndent + o.col * (optColW + optGap)
            doc.text(o.lines, xPos, rowY)
          }
          rowY += rowMaxLines * lineH
        }
        cursorY = rowY
      }

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      return cursorY + qGap
    },
  }
}

// ============================================================
// RENDER PASS — lays out items onto a fresh doc
// ============================================================
function renderPass(paper, items, opts) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const cx = PAGE_W / 2
  const contentW = PAGE_W - opts.marginX * 2
  const contentBottom = PAGE_H - opts.marginBottom

  // ---- Paper header ----
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(opts.titleSize)
  doc.setTextColor(0, 0, 0)
  doc.text(paper.title || '', cx, opts.marginTop, { align: 'center' })
  let y = opts.marginTop + opts.titleSize * 0.42

  doc.setFontSize(opts.subtitleSize)
  doc.setTextColor(0, 0, 0)
  doc.text(paper.subtitle || '', cx, y, { align: 'center' })
  y += opts.subtitleSize * 0.55

  doc.setFontSize(opts.marksSize)
  doc.setTextColor(0, 0, 0)
  doc.text(`Total Marks: ${paper.totalMarks || '____'}`, cx - 28, y, { align: 'center' })
  doc.text(`Date: ${paper.examDate || '__________'}`, cx + 28, y, { align: 'center' })
  y += opts.marksSize * 0.6

  if (paper.instructions) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(opts.sectionSubSize)
    doc.setTextColor(0, 0, 0)
    const lines = safeWrap(doc, paper.instructions, contentW)
    doc.text(lines, cx, y, { align: 'center' })
    y += lines.length * opts.sectionSubSize * 0.5
  }

  y += 2
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
  doc.line(opts.marginX, y, PAGE_W - opts.marginX, y)
  y += 5
  doc.setTextColor(0, 0, 0)

  // ---- Pre-compute layout for ALL items (to know heights) ----
  let renderedSecHeader = false // section header on current page?
  let currentSection = null

  for (const item of items) {
    const layout = layoutQuestion(doc, item, opts, contentW)
    const isNewSection = item.section.label !== currentSection

    // Section header only renders once per section (first question of section)
    const sectionH = isNewSection ? opts.sectionHeaderH : 0

    // Page break if needed
    if (y + sectionH + layout.height > contentBottom) {
      doc.addPage()
      y = opts.marginTop
      renderedSecHeader = false
    }

    // Render section header if new section OR new page with same section
    if (isNewSection || (!renderedSecHeader && currentSection === item.section.label)) {
      // If section continues across pages, render header again (it's natural for exam papers)
      // BUT user said only once — so we track per-section across pages
      if (isNewSection || !currentSection || currentSection !== item.section.label) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(opts.sectionSize)
        doc.setTextColor(0, 0, 0)
        doc.text(item.section.label, opts.marginX, y)
        y += opts.sectionSize * 0.45
        doc.setFontSize(opts.sectionSubSize)
        doc.setTextColor(0, 0, 0)
        doc.text(item.section.subLine, opts.marginX, y)
        y += opts.sectionSubSize * 0.55
        doc.setTextColor(0, 0, 0)
        y += 2
      }
      currentSection = item.section.label
      renderedSecHeader = true
    }

    // Render the question
    y = layout.render(doc, y)
  }

  return { doc, pageCount: doc.getNumberOfPages() }
}

// ============================================================
// MAIN BUILDER
// ============================================================
export function buildPaperPdf(paper) {
  const items = packSections(paper.sections || [])

  // Try passes from largest → smallest
  const passes = [
    // scale 1.0 (normal) — readable + proper fit with generous edge margins
    { titleSize: 16, subtitleSize: 11, marksSize: 10, sectionSize: 12, sectionSubSize: 9.5, qTextSize: 10, optionSize: 9, lineH: 4.4, qGap: 4.5, marginX: 20, marginTop: 14, marginBottom: 14, sectionHeaderH: 13 },
    // scale 0.92
    { titleSize: 15, subtitleSize: 10.5, marksSize: 9.5, sectionSize: 11.5, sectionSubSize: 9, qTextSize: 9.5, optionSize: 8.5, lineH: 4.1, qGap: 4, marginX: 19, marginTop: 13, marginBottom: 13, sectionHeaderH: 12 },
    // scale 0.85
    { titleSize: 14, subtitleSize: 10, marksSize: 9, sectionSize: 11, sectionSubSize: 8.5, qTextSize: 9, optionSize: 8, lineH: 3.8, qGap: 3.5, marginX: 18, marginTop: 12, marginBottom: 12, sectionHeaderH: 11 },
    // scale 0.78
    { titleSize: 13, subtitleSize: 9.5, marksSize: 8.5, sectionSize: 10, sectionSubSize: 8, qTextSize: 8.5, optionSize: 7.5, lineH: 3.5, qGap: 3, marginX: 17, marginTop: 11, marginBottom: 11, sectionHeaderH: 10 },
  ]

  // Use first pass — readability > page count (user wants this)
  const result = renderPass(paper, items, passes[0])
  return Buffer.from(result.doc.output('arraybuffer'))
}

// Backward-compat alias
export function buildHaryanaBooklet(paper) {
  return buildPaperPdf(paper)
}

// Export safeWrap for use by other PDF generators (answer key, etc.)
export { safeWrap }
