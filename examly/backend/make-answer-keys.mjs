// Generates 3 Answer Key PDFs (one per paper) — separate from the question papers.
// Uses a dedicated jsPDF renderer (bypasses buildPaperPdf) to avoid the character-
// spreading artifact that occurred when answer-key text passed through layoutQuestion.
//
// Output: offline-papers/answer-keys/answer-key-{1,2,3}.pdf

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { jsPDF } from 'jspdf'

const OUT_DIR = join(process.cwd(), 'offline-papers')
await rm(join(OUT_DIR, 'answer-keys'), { recursive: true, force: true })
await mkdir(join(OUT_DIR, 'answer-keys'), { recursive: true })

// ============================================================
// Hard-edged wrapper: combines width-based wrap with a strict per-line
// token-count cap. We never put more than `maxTokensPerLine` words on a
// single line, and we always collapse double spaces before rendering.
//
// Why two limits: jsPDF's Helvetica kerning occasionally inserts visual
// spaces between two consecutive narrow letters (e.g. "wi", "ll", "ii",
// "ti", "ty") near line-fit boundaries, producing the artefact
// "goodwi l l" instead of "goodwill". Forcing a newline every 5–6 words
// ensures the offending boundary never appears near the right margin.
// ============================================================
function wrapByWidth(doc, text, maxMm, maxTokensPerLine = 6) {
  const out = []
  doc.setCharSpace(0) // reset before measuring
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') { out.push(''); continue }
    let tokens = paragraph.replace(/\s+/g, ' ').trim().split(' ')
    let cur = ''
    let curCount = 0
    for (const tok of tokens) {
      if (tok === '') continue
      const cand = cur ? `${cur} ${tok}` : tok
      const w = doc.getTextWidth(cand)
      const tooWide = cur !== '' && w > maxMm
      const tooMany  = curCount >= maxTokensPerLine
      if (cur === '' || (!tooWide && !tooMany)) {
        cur = cand
        curCount += 1
      } else {
        out.push(cur)
        cur = tok
        curCount = 1
      }
    }
    if (cur) out.push(cur)
  }
  return out
}

// Collapse any double spaces and odd character-spacing leaks before render.
function collapseInternalSpaces(text) {
  return text.replace(/ {2,}/g, ' ').replace(/[\u00A0\u2007\u2009]/g, ' ')
}

// Each item has: { header, lines (array of wrapped lines), number }
// The renderer prints header (small, bold) and then each line with proper spacing.

const ITEMS = (variant) => {
  // Section A — MCQ answers only
  const A_VARIANTS = {
    0: [
      { q: 'A.1', ans: '(b)', rationale: 'Partnership is a relation between persons who agree to share profits of a business carried on by all or any of them acting for all (Section 4 of the Indian Partnership Act, 1932).' },
      { q: 'A.2', ans: '(c)', rationale: 'A partnership firm does not have a separate legal entity distinct from its partners.' },
      { q: 'A.3', ans: '(b)', rationale: 'In the absence of a partnership deed, profits are shared equally among all partners.' },
      { q: 'A.4', ans: '(a)', rationale: 'Mutual agency means each partner can bind the others by his acts in the ordinary course of business.' },
      { q: 'A.5', ans: '(b)', rationale: 'Goodwill represents the value of reputation, established customer base and earning capacity of a firm.' },
      { q: 'A.6', ans: '(a)', rationale: 'A\'s share = (3/5) of total profit using the ratio 3:2.' },
      { q: 'A.7', ans: '(b)', rationale: 'Interest on capital = capital × rate × time. At 10% p.a. for one year on the given capital.' },
      { q: 'A.8', ans: '(c)', rationale: 'Interest on drawings = drawings × rate. Identify the option that matches drawings × 6%.' },
      { q: 'A.9 (A&R)', ans: '(d)', rationale: 'A is false (firm is not a separate legal entity), R is true. Both A false, R true → (d).' },
      { q: 'A.10 (A&R)', ans: '(b)', rationale: 'Both A and R are true about goodwill on retirement, but R does not explain A → (b).' },
    ],
    1: [
      { q: 'A.1', ans: '(b)', rationale: 'Section 4 of the Indian Partnership Act, 1932 defines partnership.' },
      { q: 'A.2', ans: '(c)', rationale: 'A partnership firm does not have a separate legal entity.' },
      { q: 'A.3', ans: '(b)', rationale: 'In the absence of a partnership deed, profits are shared equally.' },
      { q: 'A.4', ans: '(a)', rationale: 'Mutual agency binds all partners by acts of any partner in ordinary course.' },
      { q: 'A.5', ans: '(b)', rationale: 'Goodwill = intangible value of reputation and earning capacity.' },
      { q: 'A.6', ans: '(a)', rationale: 'A\'s share = (3/5) × total using profit-share ratio 3:2.' },
      { q: 'A.7', ans: '(b)', rationale: 'Interest on capital @ 10% p.a. = capital × 0.10.' },
      { q: 'A.8', ans: '(b)', rationale: 'Revaluation account adjusts recorded assets/liabilities to current values and transfers accumulated profits/losses.' },
      { q: 'A.9 (A&R)', ans: '(d)', rationale: 'A is false (no separate legal entity), R is true → (d).' },
      { q: 'A.10 (A&R)', ans: '(b)', rationale: 'Both A and R true about goodwill on retirement; R is not the explanation of A → (b).' },
    ],
    2: [
      { q: 'A.1', ans: '(b)', rationale: 'Section 4 of the Indian Partnership Act, 1932.' },
      { q: 'A.2', ans: '(c)', rationale: 'A partnership firm does not have a separate legal entity.' },
      { q: 'A.3', ans: '(b)', rationale: 'No partnership deed → equal share of profits.' },
      { q: 'A.4', ans: '(a)', rationale: 'Mutual agency binds partners in ordinary course of business.' },
      { q: 'A.5', ans: '(b)', rationale: 'Goodwill = intangible value of reputation and earnings.' },
      { q: 'A.6', ans: '(a)', rationale: 'A\'s share = (3/5) × total profit using profit-sharing ratio 3:2.' },
      { q: 'A.7', ans: '(c)', rationale: 'Drawings × 6% p.a. for full year — match with the option that has this computation.' },
      { q: 'A.8', ans: '(c)', rationale: 'Revaluation account adjusts recorded assets/liabilities to current values and transfers reserves and P&L.' },
      { q: 'A.9 (A&R)', ans: '(d)', rationale: 'A is false (no separate legal entity), R is true → (d).' },
      { q: 'A.10 (A&R)', ans: '(b)', rationale: 'Both A and R are true about goodwill on retirement; R is not the explanation of A → (b).' },
    ],
  }

  const B_ITEMS = [
    { q: 'B.1', rationale: 'Define partnership per Section 4 of the Indian Partnership Act, 1932 in 1–2 sentences: persons, business, agreement, profit sharing, mutual agency.' },
    { q: 'B.2', rationale: 'Formula: Sum of all capital balances × average profit rate / number of years, OR average profit × number of years of purchase.' },
    { q: 'B.3', rationale: 'Two rights: (i) right to share profits; (ii) right to participate in management. Any two listed in the Partnership Act.' },
    { q: 'B.4', rationale: 'Interest on capital is provided ONLY if partnership deed allows it; otherwise NIL when deed is silent.' },
    { q: 'B.5', rationale: 'Differentiate fixed capital (separate current account) vs fluctuating capital (all transactions in one capital account).' },
  ]

  const C_ITEMS = [
    { q: 'C.1', rationale: 'Interest on capital = capital × 0.10 for each partner. A\'s interest = A\'s capital × 10%; B\'s interest = B\'s capital × 10%. Show numerical answer with rupee symbol.' },
    { q: 'C.2', rationale: 'Three differences in tabular form: capital balance vs current account; current vs fluctuating method; treatment of interest on capital and drawings.' },
    { q: 'C.3', rationale: 'Use given capital values × 10% p.a. for interest; subtract drawings interest (drawings × 6% if asked); show work step by step.' },
    { q: 'C.4', rationale: 'On admission: goodwill brought in cash → debit cash/bank, credit sacrificing partners\' capital accounts in sacrificing ratio.' },
    { q: 'C.5', rationale: 'Average profit = (P1+P2+P3)/3, goodwill = average profit × number of years of purchase. Show journal entry for Z.' },
  ]

  const D_VARIANTS = {
    0: [
      { q: 'D.1 (a)', rationale: 'Interest on capital @ 10% p.a. for both partners.' },
      { q: 'D.1 (b)', rationale: 'Apply gross profit (after all direct adjustments) to partners in ratio 3:2 or equally.' },
      { q: 'D.1 (c)', rationale: 'Distribution of divisible profit in 3:2 (or agreed ratio) after charging interest on capital and drawings.' },
      { q: 'D.1 (d)', rationale: 'Closing entry: debit Profit & Loss Appropriation A/c, credit Partners\' Capital A/c individually.' },
      { q: 'D.1 (e)', rationale: 'New partner is entitled to his share of goodwill (calculated at entry).' },
      { q: 'D.2 (a)', rationale: 'New ratio of X:Y:Z determined by subtracting sacrificing share from old ratio.' },
      { q: 'D.2 (b)', rationale: 'Pass journal entry for Z\'s capital (debit cash/bank, credit Z\'s capital A/c).' },
      { q: 'D.2 (c)', rationale: 'Distribute goodwill (cash) between X and Y in their sacrificing ratio.' },
      { q: 'D.2 (d)', rationale: 'Show reserves transferred to partners\' capital A/c (if no change in profit-sharing ratio) or to new profit-sharing ratio.' },
      { q: 'D.2 (e)', rationale: 'Allocate divisible profit in the new ratio 5:3:2 for X:Y:Z.' },
    ],
    1: [
      { q: 'D.1 (a)', rationale: 'Interest on capital at 10% p.a. for both partners.' },
      { q: 'D.1 (b)', rationale: 'Compute divisible profit after interest on capital and drawings.' },
      { q: 'D.1 (c)', rationale: 'Distribute residual profit in 3:2 ratio (or as per question).' },
      { q: 'D.1 (d)', rationale: 'Closing journal entry — debit P&L Appropriation A/c, credit partners\' capital A/c.' },
      { q: 'D.1 (e)', rationale: 'Goodwill adjustment in case of change in profit-sharing ratio.' },
      { q: 'D.2 (a)', rationale: 'Identify the firm\'s capital balances as on date of admission.' },
      { q: 'D.2 (b)', rationale: 'Pass entry for new partner\'s capital.' },
      { q: 'D.2 (c)', rationale: 'Distribute goodwill brought in cash to sacrificing partners.' },
      { q: 'D.2 (d)', rationale: 'Write off existing reserves.' },
      { q: 'D.2 (e)', rationale: 'Allocate divisible profit in new ratio.' },
    ],
    2: [
      { q: 'D.1 (a)', rationale: 'Calculate capital interest at 10% p.a. for each partner.' },
      { q: 'D.1 (b)', rationale: 'Apply drawings interest @ 6% p.a. for the year.' },
      { q: 'D.1 (c)', rationale: 'Determine divisible profit.' },
      { q: 'D.1 (d)', rationale: 'Closing entry: debit P&L Appr, credit partners\' capital A/c.' },
      { q: 'D.1 (e)', rationale: 'Goodwill treatment on admission.' },
      { q: 'D.2 (a)', rationale: 'Read admission ratio and old ratio.' },
      { q: 'D.2 (b)', rationale: 'Capital entry for new partner.' },
      { q: 'D.2 (c)', rationale: 'Sacrificing ratio distribution of goodwill.' },
      { q: 'D.2 (d)', rationale: 'Existing reserves written off.' },
      { q: 'D.2 (e)', rationale: 'Final distribution in new ratio.' },
    ],
  }

  const E_TEXT = {
    0: [
      { q: 'E.1', rationale: 'Trading A/c: Dr. Opening Stock + Purchases + direct expenses (Freight Inward, Carriage Inward, Manufacturing Wages). Cr. Sales + Closing Stock. Compute Gross Profit = (Sales + Closing Stock) − (Opening Stock + Purchases + Direct Exp). Transfer Gross Profit to P&L A/c. P&L A/c: Dr. indirect expenses (Salaries, Rent, Power, Advtg, Depr, Insurance). Net profit transferred to P&L Appropriation A/c. P&L Appr: provide Interest on capital @ 10% p.a. (Dr) and interest on drawings @ 6% p.a. (Cr). Divide residual equally.' },
      { q: 'E.2', rationale: 'Average profit = (P1+P2+P3)/3. Goodwill = average × 2 years\' purchase. C\'s share of goodwill = goodwill × C\'s share. Open Revaluation A/c for undervalued asset + unrecorded liability. Show full settlement of C\'s Capital A/c and adjust A and B in new profit-sharing ratio.' },
      { q: 'E.3', rationale: 'Transfer all assets (except cash) and all liabilities (except capital) to Realisation A/c. Add asset realised + partner-asset taken over + recovery (Cr); payment of liabilities, expenses, asset taken over (Dr). Profit/loss transferred to Partners\' Capital A/c in old ratio. Settle partners\' Capital A/c with cash.' },
    ],
    1: [
      { q: 'E.1', rationale: 'Compute GP from given TB. Trading A/c: Op Stock, Purchases, Freight/Carriage Inward on Dr; Sales, Closing Stock on Cr. P&L: indirect expenses (Salaries, Rent, Power, Repair, Depr, Short-term Loan interest). Net profit to P&L Appr. Provide interest on capital @ 10% (Dr), interest on drawings @ 6% (Cr); transfer General Reserve; remainder divided equally.' },
      { q: 'E.2', rationale: 'Average profit = (P1+P2+P3)/3. Goodwill = average × 2. C\'s share = goodwill × C\'s proportion. Revaluation A/c covers asset/liability adjustments. Settle C\'s Capital, balance to A and B in new ratio.' },
      { q: 'E.3', rationale: 'Realisation A/c pattern unchanged: transfer assets/liabilities, add asset realised on Cr, payment of liabilities + expenses on Dr; profit/loss to capital. Settle cash to partners in old ratio.' },
    ],
    2: [
      { q: 'E.1', rationale: 'Trading A/c: include Sales Return on Dr; Closing Stock on Cr. Direct expenses include Freight Inward. P&L A/c: include Carriage Outward, Insurance Premium as indirect. P&L Appr: interest on capital (10%) Dr, interest on drawings (6%) Cr; remainder divided equally.' },
      { q: 'E.2', rationale: 'Average profit + 2-year purchase. C\'s share of goodwill. Revaluation A/c + settlement of Capital A/c as per the new ratio among A and B.' },
      { q: 'E.3', rationale: 'Realisation A/c standard format. Transfer Bills Receivable endorsed (excluded). Profit/loss transferred to Capital A/c.' },
    ],
  }

  return {
    A: A_VARIANTS[variant],
    B: B_ITEMS,
    C: C_ITEMS,
    D: D_VARIANTS[variant],
    E: E_TEXT[variant],
  }
}

// ============================================================
// RENDERER — directly uses jsPDF; bypasses buildPaperPdf entirely.
// Strict character-count wrap per line so nothing overflows the A4 width.
// ============================================================
function renderAnswerKey(variant, paperIndex) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PAGE_W = 210
  const PAGE_H = 297
  const MARGIN_X = 18
  const MARGIN_Y_TOP = 18
  const MARGIN_Y_BOTTOM = 18
  const CONTENT_W = PAGE_W - MARGIN_X * 2

  // Strict character cap based on font size: at 11pt Helvetica, ~95 chars
  // per 170mm content width is empirically safe. Allow a buffer.
  // Use a moderate font size with extra line height — wider font + taller
  // line height keeps characters apart sufficiently so jsPDF's kerning
  // doesn't insert phantom spaces between paired narrow letters.
  const SMALL_FONT_SIZE = 11
  const RAT_FONT_SIZE = 12
  const LINE_H = 6.2      // mm per line — comfortable for readability
  const PARA_GAP = 1.2    // mm between rationale lines
  const SECTION_GAP = 4.0 // mm between sections
  const TOKENS_PER_LINE = 6

  let y = MARGIN_Y_TOP
  let pageNum = 1

  const newPageIfNeeded = (needMm) => {
    if (y + needMm > PAGE_H - MARGIN_Y_BOTTOM) {
      doc.addPage()
      pageNum += 1
      y = MARGIN_Y_TOP
    }
  }

  // ---- Header ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(0, 0, 0)
  doc.text('Accountancy — Class XII', PAGE_W / 2, y, { align: 'center' })
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(`Answer Key Paper ${paperIndex + 1} — Detailed Working Notes`, PAGE_W / 2, y, { align: 'center' })
  y += 6

  doc.setFontSize(10)
  doc.text(`Total Marks: 60        Subject: Accountancy (Partnership)        Class: XII`, PAGE_W / 2, y, { align: 'center' })
  y += 6

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
  y += 4

  // ---- Note (How to use this key) ----
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  const noteLines = [
    'How to use this Answer Key:',
    '• Section A: ONLY the correct option letter is given for each MCQ/A&R item.',
    '• Sections B–E: detailed working steps shown for each item, with the final answer hint.',
    '• Total marks: 60 (A:10, B:10, C:15, D:10, E:15). Partial credit is allowed for individual steps.',
  ]
  for (const line of noteLines) {
    newPageIfNeeded(LINE_H)
    doc.text(line, MARGIN_X, y)
    y += LINE_H
  }
  y += SECTION_GAP

  // ---- Section A header ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  newPageIfNeeded(LINE_H)
  doc.text('Section A — Multiple Choice Questions (Answer Key)', MARGIN_X, y)
  y += LINE_H + 1

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const itemsBySection = ITEMS(variant)

  // ---- Section A items: question | answer | rationale each on its own block ----
  for (const item of itemsBySection.A) {
    newPageIfNeeded(LINE_H * 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(RAT_FONT_SIZE)
    doc.text(`${item.q.padEnd(10)}`, MARGIN_X, y)
    const qWidth = doc.getTextWidth(item.q.padEnd(10)) + 1
    doc.setFont('helvetica', 'normal')
    doc.text(`Answer: ${collapseInternalSpaces(item.ans)}`, MARGIN_X + qWidth, y)
    y += LINE_H
    // Rationale on next line, indented, with strict 6-tokens-per-line cap
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(SMALL_FONT_SIZE)
    const availableW = CONTENT_W - 5 // 5mm indent for rationale text
    const rationaleLines = wrapByWidth(doc, collapseInternalSpaces(item.rationale), availableW, TOKENS_PER_LINE)
    for (const rl of rationaleLines) {
      newPageIfNeeded(LINE_H)
      doc.text('    ' + rl, MARGIN_X, y)
      y += LINE_H
    }
    y += PARA_GAP
  }

  y += SECTION_GAP - PARA_GAP

  // ---- Section B header ----
  newPageIfNeeded(LINE_H * 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(RAT_FONT_SIZE)
  doc.text('Section B — Very Short Answer (2 marks each)', MARGIN_X, y)
  y += LINE_H + 1

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(SMALL_FONT_SIZE)

  for (const item of itemsBySection.B) {
    newPageIfNeeded(LINE_H * 3)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(RAT_FONT_SIZE)
    doc.text(`${item.q.padEnd(8)}  Working + Final Answer:`, MARGIN_X, y)
    y += LINE_H
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(SMALL_FONT_SIZE)
    const availableW = CONTENT_W - 5
    const rationaleLines = wrapByWidth(doc, collapseInternalSpaces(item.rationale), availableW, TOKENS_PER_LINE)
    for (const rl of rationaleLines) {
      newPageIfNeeded(LINE_H)
      doc.text('    ' + rl, MARGIN_X, y)
      y += LINE_H
    }
    y += PARA_GAP
  }

  y += SECTION_GAP - PARA_GAP

  // ---- Section C ----
  newPageIfNeeded(LINE_H * 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(RAT_FONT_SIZE)
  doc.text('Section C — Short Answer (3 marks each)', MARGIN_X, y)
  y += LINE_H + 1
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(SMALL_FONT_SIZE)

  for (const item of itemsBySection.C) {
    newPageIfNeeded(LINE_H * 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(RAT_FONT_SIZE)
    doc.text(`${item.q.padEnd(8)}  Working + Final Answer:`, MARGIN_X, y)
    y += LINE_H
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(SMALL_FONT_SIZE)
    const availableW = CONTENT_W - 5
    const rationaleLines = wrapByWidth(doc, collapseInternalSpaces(item.rationale), availableW, TOKENS_PER_LINE)
    for (const rl of rationaleLines) {
      newPageIfNeeded(LINE_H)
      doc.text('    ' + rl, MARGIN_X, y)
      y += LINE_H
    }
    y += PARA_GAP
  }

  y += SECTION_GAP - PARA_GAP

  // ---- Section D ----
  newPageIfNeeded(LINE_H * 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(RAT_FONT_SIZE)
  doc.text('Section D — Case Studies (5 marks each = 5 sub-parts × 1 mark)', MARGIN_X, y)
  y += LINE_H + 1
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(SMALL_FONT_SIZE)

  for (const item of itemsBySection.D) {
    newPageIfNeeded(LINE_H * 3)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(RAT_FONT_SIZE)
    doc.text(`${item.q.padEnd(10)}  Working:`, MARGIN_X, y)
    y += LINE_H
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(SMALL_FONT_SIZE)
    const availableW = CONTENT_W - 5
    const rationaleLines = wrapByWidth(doc, collapseInternalSpaces(item.rationale), availableW, TOKENS_PER_LINE)
    for (const rl of rationaleLines) {
      newPageIfNeeded(LINE_H)
      doc.text('    ' + rl, MARGIN_X, y)
      y += LINE_H
    }
    y += PARA_GAP
  }

  y += SECTION_GAP - PARA_GAP

  // ---- Section E ----
  newPageIfNeeded(LINE_H * 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(RAT_FONT_SIZE)
  doc.text('Section E — Long Answer (5 marks each)', MARGIN_X, y)
  y += LINE_H + 1
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(SMALL_FONT_SIZE)

  for (const item of itemsBySection.E) {
    newPageIfNeeded(LINE_H * 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(RAT_FONT_SIZE)
    doc.text(`${item.q.padEnd(8)}  Working Steps:`, MARGIN_X, y)
    y += LINE_H
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(SMALL_FONT_SIZE)
    const availableW = CONTENT_W - 5
    const rationaleLines = wrapByWidth(doc, collapseInternalSpaces(item.rationale), availableW, TOKENS_PER_LINE)
    for (const rl of rationaleLines) {
      newPageIfNeeded(LINE_H)
      doc.text('    ' + rl, MARGIN_X, y)
      y += LINE_H
    }
    y += PARA_GAP
  }

  // Page numbers
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 95)
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN_X, PAGE_H - 8, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const outputs = []
  for (let i = 0; i < 3; i++) {
    const buf = renderAnswerKey(i, i)
    const path = join(OUT_DIR, 'answer-keys', `answer-key-paper-${i + 1}.pdf`)
    await writeFile(path, buf)
    outputs.push({ paper: i + 1, bytes: buf.length, path })
    console.log(JSON.stringify({ paper: i + 1, bytes: buf.length, path }))
  }
  console.log('ALL_ANSWER_KEYS_GENERATED')
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
