// Offline Accountancy test paper generator — NEP-aligned pattern.
// No AI calls. No DB writes. Saves 3 PDFs to ./offline-papers/ and returns paths.

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildPaperPdf } from './utils/haryana.js'

const OUT_DIR = join(process.cwd(), 'offline-papers')

await rm(OUT_DIR, { recursive: true, force: true })
await mkdir(OUT_DIR, { recursive: true })

// Deterministic PRNG so 3 papers are reproducible but different.
function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}
function shuffle(rng, arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function randInt(rng, lo, hi) {
  return Math.floor(lo + rng() * (hi - lo + 1))
}

// ============================================================
// QUESTION BANKS — Accountancy Class 12, Partnership (Indian Partnership Act 1932)
// All variants with deterministic numerical ranges so 3 papers differ but each is coherent.
// ============================================================

const MCQ_BANK = [
  {
    stem: () => 'Under Section 4 of the Indian Partnership Act, 1932, partnership is defined as:',
    options: () => [
      'A legal entity created by registration with the Registrar of Firms',
      'A relation between persons who agree to share profits of a business carried on by all or any of them acting for all',
      'A company incorporated under the Companies Act, 2013',
      'An association of persons formed for charitable purposes',
    ],
    correct: (i) => ['(b)'][i],
  },
  {
    stem: () => 'Which of the following is NOT an essential feature of a partnership?',
    options: () => [
      'Two or more persons',
      'Agreement among the partners',
      'Separate legal entity distinct from partners',
      'Sharing of profits',
    ],
    correct: (i) => ['(c)'][i],
  },
  {
    stem: () => 'In the absence of a partnership deed, profits are shared:',
    options: () => [
      'In proportion to capital contributed',
      'Equally among all partners',
      'As decided by the senior partner',
      'According to prevailing RBI guidelines',
    ],
    correct: (i) => ['(b)'][i],
  },
  {
    stem: () => 'Mutual agency means:',
    options: () => [
      'Each partner can bind the others by his acts in the ordinary course of business',
      'Partners act as agents of the firm only',
      'Only the managing partner can act for the firm',
      'Partnership must be registered with SEBI',
    ],
    correct: (i) => ['(a)'][i],
  },
  {
    stem: () => 'Goodwill of a partnership firm represents:',
    options: () => [
      'Tangible assets like furniture and stock',
      'The value of reputation, established customer base and earning capacity',
      'Outstanding liabilities payable to creditors',
      'Cash balance at the bank',
    ],
    correct: (i) => ['(b)'][i],
  },
  {
    stem: (rng) => `A and B are partners sharing profits in the ratio of 3:2. If the total profit for the year is Rs.${(randInt(rng, 1, 9) * 100000)}, what is A's share?`,
    options: (rng) => {
      const total = randInt(rng, 1, 9) * 100000
      return [
        `Rs.${(total * 3) / 5}`,
        `Rs.${(total * 2) / 5}`,
        `Rs.${(total * 3) / 4}`,
        `Rs.${total / 5}`,
      ]
    },
    correct: (i) => ['(a)'][i],
  },
  {
    stem: (rng) => `Calculate the interest on capital @ 10% p.a. for capital of Rs.${randInt(rng, 100, 500) * 1000}.`,
    options: (rng) => {
      const capital = randInt(rng, 100, 500) * 1000
      const interest = (capital * 10) / 100
      return [
        `Rs.${capital + 5000}`,
        `Rs.${interest}`,
        `Rs.${capital / 10}`,
        `Rs.${interest * 2}`,
      ]
    },
    correct: (i) => ['(b)'][i],
  },
  {
    stem: (rng) => `A partner withdrew Rs.${randInt(rng, 50, 200) * 1000} during the year. Interest on drawings @ 6% p.a. would be approximately:`,
    options: (rng) => {
      const drawings = randInt(rng, 50, 200) * 1000
      const interest = (drawings * 6) / 100
      return [
        `Rs.${interest * 3}`,
        `Rs.${interest * 2}`,
        `Rs.${interest}`,
        `Rs.${interest / 2}`,
      ]
    },
    correct: (i) => ['(c)'][i],
  },
  {
    stem: () => 'Which of the following statements is TRUE about limited liability partnership (LLP)?',
    options: () => [
      'Partners have unlimited personal liability for all debts',
      'Liability of each partner is limited to his contribution',
      'No partner can be a working partner',
      'LLP must be registered under the Companies Act',
    ],
    correct: (i) => ['(b)'][i],
  },
  {
    stem: () => 'On admission of a new partner, the revaluation account is prepared to:',
    options: () => [
      'Distribute profits among all partners including the new partner',
      'Adjust recorded assets and liabilities to their current values and transfer accumulated profits/losses',
      'Determine the working capital requirement of the firm',
      'Calculate the final dissolution value of the firm',
    ],
    correct: (i) => ['(b)'][i],
  },
]

const AR_BANK = [
  {
    assertion: 'A partnership firm is a separate legal entity distinct from its partners.',
    reason: 'The Indian Partnership Act, 1932 does not grant a firm the status of a separate legal entity.',
    options: [
      'Both A and R are true and R is the correct explanation of A',
      'Both A and R are true but R is not the correct explanation of A',
      'A is true but R is false',
      'A is false but R is true',
    ],
    correct: 3,
  },
  {
    assertion: 'Interest on capital is allowed even in the absence of a partnership deed.',
    reason: 'The Partnership Act specifically provides for the payment of interest on capital only if provided in the partnership deed.',
    options: [
      'Both A and R are true and R is the correct explanation of A',
      'Both A and R are true but R is not the correct explanation of A',
      'A is true but R is false',
      'A is false but R is true',
    ],
    correct: 3,
  },
  {
    assertion: 'A minor can be admitted to the benefits of a partnership firm.',
    reason: 'A minor cannot be held personally liable for the debts of the firm but may be entitled to a share of profits.',
    options: [
      'Both A and R are true and R is the correct explanation of A',
      'Both A and R are true but R is not the correct explanation of A',
      'A is true but R is false',
      'A is false but R is true',
    ],
    correct: 0,
  },
  {
    assertion: 'On retirement of a partner, goodwill of the firm is valued.',
    reason: 'The retiring partner is compensated for his share in the goodwill built up during his tenure.',
    options: [
      'Both A and R are true and R is the correct explanation of A',
      'Both A and R are true but R is not the correct explanation of A',
      'A is true but R is false',
      'A is false but R is true',
    ],
    correct: 0,
  },
  {
    assertion: 'Dissolution of partnership necessarily means dissolution of the firm.',
    reason: 'A change in the constitution of partnership — such as admission, retirement or death of a partner — reconstituted the firm but does not always dissolve it.',
    options: [
      'Both A and R are true and R is the correct explanation of A',
      'Both A and R are true but R is not the correct explanation of A',
      'A is true but R is false',
      'A is false but R is true',
    ],
    correct: 3,
  },
]

const VSHORT_BANK = [
  () => 'Define the term "Partnership" as per the Indian Partnership Act, 1932.',
  () => 'What is meant by "Mutual Agency" in a partnership firm?',
  () => 'State any two rights of a partner.',
  () => 'What is "Appropriation Account" in partnership accounting?',
  () => 'Write the formula to calculate goodwill by the average profit method.',
  () => 'What is meant by "Reconstitution of a firm"?',
  () => 'Distinguish between fixed and fluctuating capital methods.',
  () => 'Give the journal entry for interest on capital provided in the partnership deed.',
  () => 'Define "Dissolution of partnership".',
  () => 'What is meant by "Past adjustments" in admission of a partner?',
]

const SHORT_BANK = [
  (rng) => `A and B started a partnership on 1st April with capitals of Rs.${randInt(rng, 100, 500) * 1000} and Rs.${randInt(rng, 100, 500) * 1000} respectively. They share profits in the ratio of capitals. Calculate the interest on capital @ 8% p.a. for each.`,
  (rng) => `Explain any three differences between the fixed capital method and the fluctuating capital method. Use capitals of Rs.${randInt(rng, 200, 600) * 1000} and Rs.${randInt(rng, 100, 400) * 1000} in your example.`,
  (rng) => `From the following Trial Balance excerpts, prepare a Profit and Loss Appropriation Account for the year ended 31st March 2025:
Net profit Rs.${randInt(rng, 100, 300) * 1000};
Interest on capital @ 10% p.a. (A's capital Rs.${randInt(rng, 200, 500) * 1000}, B's capital Rs.${randInt(rng, 100, 300) * 1000});
Salary to A Rs.${randInt(rng, 20, 80) * 1000} p.a.;
Profit-sharing ratio: A and B = 3:1.`,
  () => 'Explain the accounting treatment of goodwill on (i) admission, (ii) retirement, and (iii) change in profit-sharing ratio of partners.',
  (rng) => `X, Y and Z are partners sharing profits in the ratio 5:3:2. Z dies on 1st July 2024. His share of goodwill is valued at Rs.${randInt(rng, 80, 250) * 1000}. Pass the journal entry in the books of the firm for Z's share of goodwill.`,
]

const CASE_STUDY_BANK = [
  (rng) => {
    const aCap = randInt(rng, 300, 600) * 1000
    const bCap = randInt(rng, 200, 500) * 1000
    const profit = randInt(rng, 150, 400) * 1000
    return {
      case: `M/s AB & Co. is a partnership firm of A and B started on 1st April 2023. As per the partnership deed, A and B share profits in the ratio 3:2. They contribute capitals of Rs.${aCap} and Rs.${bCap} respectively. Interest on capital is allowed at 10% p.a. and interest on drawings @ 6% p.a. The firm earned a net profit of Rs.${profit} for the year ended 31st March 2024 after charging interest on drawings of Rs.${randInt(rng, 5, 20) * 1000}. A drawings during the year were Rs.${randInt(rng, 30, 80) * 1000}; B drawings were Rs.${randInt(rng, 20, 50) * 1000}.`,
      subQuestions: [
        'Calculate the amount of interest on capital for A and B.',
        'Compute the divisible profit of the firm.',
        'Allocate the divisible profit between A and B in their profit-sharing ratio.',
        'Pass the closing journal entry for the appropriation of profits.',
        'State whether the new partner, if admitted, would be entitled to any goodwill adjustment in this case.',
      ],
    }
  },
  (rng) => {
    const xCap = randInt(rng, 200, 400) * 1000
    const yCap = randInt(rng, 100, 300) * 1000
    const totalProfit = randInt(rng, 80, 200) * 1000
    return {
      case: `X and Y are partners sharing profits and losses equally. Their capitals on 1st April 2024 stood at Rs.${xCap} and Rs.${yCap} respectively. They admit Z into partnership from 1st April 2024 on the following terms:
(i) Z brings in capital of Rs.${randInt(rng, 200, 400) * 1000}.
(ii) Z acquires 1/5th share in the future profits of the firm.
(iii) Z brings in his share of goodwill in cash, valued at Rs.${randInt(rng, 100, 250) * 1000}.
(iv) The old partners decide to show reserves of Rs.${randInt(rng, 20, 80) * 1000} existing in the books.
The net profit for the year ending 31st March 2025 was Rs.${totalProfit}.`,
      subQuestions: [
        'Calculate the new profit-sharing ratio of X, Y and Z after Z\'s admission.',
        'Pass the journal entry for Z\'s capital brought in.',
        'Show how goodwill brought in cash is distributed among the sacrificing partners.',
        'Pass the journal entry for writing off existing reserves.',
        'Compute the amount of divisible profit that each partner will receive.',
      ],
    }
  },
  (rng) => {
    const psr = randInt(rng, 2, 5)
    const qsr = randInt(rng, 1, 3)
    const newPSR = psr + qsr
    const retainedA = (psr / newPSR).toFixed(2)
    const retainedB = (qsr / newPSR).toFixed(2)
    const newShare = (1 / (newPSR + 1)).toFixed(2)
    const goodwill = randInt(rng, 100, 300) * 1000
    return {
      case: `P and Q were partners in a firm sharing profits in the ratio ${psr}:${qsr}. They decided to admit R as a new partner. The new profit-sharing ratio among P, Q and R was agreed as ${psr}:${qsr}:1. The goodwill of the firm on the date of admission was valued at Rs.${goodwill}.
P retained ${retainedA} of his original share and Q retained ${retainedB}. R was allotted the new share of ${newShare} in the firm.`,
      subQuestions: [
        'Calculate the sacrificing ratio of the old partners.',
        'Show how goodwill of Rs.' + goodwill.toLocaleString('en-IN') + ' is to be distributed.',
        'Pass the journal entry on R\'s admission for goodwill adjustment.',
        'What is the accounting treatment if R fails to bring his share of goodwill in cash?',
        'Identify the section of the Partnership Act that governs the rights of incoming partners.',
      ],
    }
  },
]

// Helper: format a number with Indian comma separators (e.g. 2,40,000)
function fmt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Build a Trial Balance table with simple `|` separators (same style you liked).
function trialBalanceTable(rows) {
  const W1 = 26
  const W2 = 12
  const W3 = 12
  const head = `Particulars`.padEnd(W1) + ' | ' + 'Debit (Rs.)'.padStart(W2) + ' | ' + 'Credit (Rs.)'.padStart(W3)
  const bar  = '-'.repeat(W1) + '-+-' + '-'.repeat(W2) + '-+-' + '-'.repeat(W3)
  const body = rows.map((r) =>
    r.p.padEnd(W1) +
    ' | ' +
    String(r.d || '').padStart(W2) +
    ' | ' +
    String(r.c || '').padStart(W3)
  )
  return [head, bar, ...body].join('\n')
}

// Three completely distinct Trial Balance scenarios — different firm names,
// different item sets, different magnitude ranges. The accounting patterns
// (opening stock, purchases, sales, capital, drawings, etc.) stay common so
// the question still maps to a standard CBSE pattern.
//
// Variant 0 → M/s Khanna & Sons      (General trading)
// Variant 1 → M/s Mehta & Co.        (Books & Stationery retailer)
// Variant 2 → M/s Patel Brothers     (Garments/Textiles trader)
function trialBalanceScenario(rng, variant) {
  let openStock, purch, sales, salaries, rent, power, depr, repairExp, miscExp,
      aDraw, bDraw, debtors, stock, cashBank, goodsReturn, badDebt,
      aCap, bCap, creditors, billsPayable, billsReceivable, reserve, closing,
      shortTermLoan, advertising, freightInward, carriageOutward, insurancePremium,
      badDebtsRecovered, discountReceived, discountAllowed, returnIn, returnOut

  if (variant === 0) {
    // Variant 0 — M/s Khanna & Sons — general trading with bigger numbers
    openStock       = randInt(rng, 60, 110) * 1000
    purch           = randInt(rng, 700, 1300) * 1000
    sales           = randInt(rng, 1500, 2300) * 1000
    salaries        = randInt(rng, 50, 90) * 1000
    rent            = randInt(rng, 30, 60) * 1000
    power           = randInt(rng, 12, 25) * 1000
    advertising     = randInt(rng, 8, 22) * 1000
    freightInward   = randInt(rng, 5, 18) * 1000
    miscExp         = randInt(rng, 4, 12) * 1000
    aDraw           = randInt(rng, 25, 55) * 1000
    bDraw           = randInt(rng, 15, 40) * 1000
    debtors         = randInt(rng, 120, 220) * 1000
    stock           = 0
    cashBank        = randInt(rng, 40, 110) * 1000
    aCap            = randInt(rng, 350, 600) * 1000
    bCap            = randInt(rng, 280, 480) * 1000
    creditors       = randInt(rng, 90, 170) * 1000
    billsPayable    = randInt(rng, 30, 80) * 1000
    billsReceivable = randInt(rng, 25, 70) * 1000
    reserve         = randInt(rng, 30, 70) * 1000
    closing         = randInt(rng, 60, 130) * 1000
    shortTermLoan   = 0
    repairExp       = 0
    depr            = 0
    goodsReturn     = 0
    badDebt         = 0
    carriageOutward = 0
    insurancePremium= 0
    badDebtsRecovered = 0
    discountReceived = 0
    discountAllowed   = 0
    returnIn          = 0
    returnOut         = 0
  } else if (variant === 1) {
    // Variant 1 — M/s Mehta & Co. — Books & Stationery retailer
    openStock       = randInt(rng, 80, 180) * 1000
    purch           = randInt(rng, 600, 1100) * 1000
    sales           = randInt(rng, 1300, 2000) * 1000
    salaries        = randInt(rng, 60, 120) * 1000
    rent            = randInt(rng, 24, 60) * 1000
    power           = randInt(rng, 8, 18) * 1000
    advertising     = 0
    freightInward   = 0
    miscExp         = randInt(rng, 6, 15) * 1000
    aDraw           = randInt(rng, 30, 70) * 1000
    bDraw           = randInt(rng, 20, 50) * 1000
    debtors         = randInt(rng, 100, 200) * 1000
    stock           = 0
    cashBank        = randInt(rng, 50, 120) * 1000
    aCap            = randInt(rng, 400, 700) * 1000
    bCap            = randInt(rng, 250, 500) * 1000
    creditors       = randInt(rng, 80, 160) * 1000
    billsPayable    = 0
    billsReceivable = 0
    reserve         = randInt(rng, 25, 60) * 1000
    closing         = randInt(rng, 90, 180) * 1000
    shortTermLoan   = randInt(rng, 40, 90) * 1000
    repairExp       = randInt(rng, 5, 14) * 1000
    depr            = randInt(rng, 6, 16) * 1000
    goodsReturn     = 0
    badDebt         = 0
    carriageOutward = 0
    insurancePremium= 0
    badDebtsRecovered = 0
    discountReceived = 0
    discountAllowed   = 0
    returnIn          = 0
    returnOut         = 0
  } else {
    // Variant 2 — M/s Patel Brothers — Textiles/Garments
    openStock       = randInt(rng, 100, 200) * 1000
    purch           = randInt(rng, 800, 1400) * 1000
    sales           = randInt(rng, 1800, 2500) * 1000
    salaries        = randInt(rng, 70, 130) * 1000
    rent            = randInt(rng, 36, 70) * 1000
    power           = randInt(rng, 10, 22) * 1000
    advertising     = randInt(rng, 12, 26) * 1000
    freightInward   = randInt(rng, 8, 22) * 1000
    miscExp         = randInt(rng, 5, 14) * 1000
    aDraw           = randInt(rng, 35, 75) * 1000
    bDraw           = randInt(rng, 25, 55) * 1000
    debtors         = randInt(rng, 150, 280) * 1000
    stock           = 0
    cashBank        = randInt(rng, 30, 90) * 1000
    aCap            = randInt(rng, 450, 800) * 1000
    bCap            = randInt(rng, 300, 600) * 1000
    creditors       = randInt(rng, 110, 220) * 1000
    billsPayable    = randInt(rng, 20, 60) * 1000
    billsReceivable = randInt(rng, 15, 50) * 1000
    reserve         = randInt(rng, 35, 80) * 1000
    closing         = randInt(rng, 110, 220) * 1000
    shortTermLoan   = 0
    repairExp       = 0
    depr            = 0
    carriageOutward = randInt(rng, 6, 14) * 1000
    insurancePremium= randInt(rng, 4, 10) * 1000
    badDebtsRecovered = 0
    discountReceived = 0
    discountAllowed   = 0
    goodsReturn       = randInt(rng, 8, 18) * 1000
    badDebt           = randInt(rng, 4, 10) * 1000
    returnIn          = randInt(rng, 6, 14) * 1000
    returnOut         = randInt(rng, 6, 14) * 1000
  }

  // Build rows in a standard order — only include items that are non-zero in this variant
  const rows = [
    { p: 'Opening Stock',           d: openStock ? fmt(openStock) : '', c: '' },
  ]
  if (purch)   rows.push({ p: 'Purchases & Sales', d: fmt(purch), c: fmt(sales) })
  else         rows.push({ p: 'Sales',               d: '',         c: fmt(sales) })
  if (returnIn)  rows.push({ p: 'Sales Return / Return Inward', d: fmt(returnIn),  c: '' })
  if (returnOut) rows.push({ p: 'Purchase Return',                d: '',            c: fmt(returnOut) })
  if (salaries) rows.push({ p: 'Salaries & Wages', d: fmt(salaries), c: '' })
  if (rent)     rows.push({ p: 'Rent', d: fmt(rent), c: '' })
  if (power)    rows.push({ p: 'Power & Fuel', d: fmt(power), c: '' })
  if (advertising) rows.push({ p: 'Advertising', d: fmt(advertising), c: '' })
  if (freightInward) rows.push({ p: 'Freight Inward', d: fmt(freightInward), c: '' })
  if (repairExp)    rows.push({ p: 'Repair Expenses', d: fmt(repairExp), c: '' })
  if (depr)         rows.push({ p: 'Depreciation',  d: fmt(depr), c: '' })
  if (carriageOutward) rows.push({ p: 'Carriage Outward', d: fmt(carriageOutward), c: '' })
  if (insurancePremium) rows.push({ p: 'Insurance Premium', d: fmt(insurancePremium), c: '' })
  if (miscExp)     rows.push({ p: 'Sundry Expenses', d: fmt(miscExp), c: '' })
  if (badDebt)     rows.push({ p: 'Bad Debts', d: fmt(badDebt), c: '' })
  if (aDraw)       rows.push({ p: "A's Drawings", d: fmt(aDraw), c: '' })
  if (bDraw)       rows.push({ p: "B's Drawings", d: fmt(bDraw), c: '' })
  if (debtors)     rows.push({ p: 'Sundry Debtors', d: fmt(debtors), c: '' })
  if (billsReceivable) rows.push({ p: 'Bills Receivable', d: fmt(billsReceivable), c: '' })
  if (discountAllowed)  rows.push({ p: 'Discount Allowed', d: fmt(discountAllowed), c: '' })
  if (aCap)        rows.push({ p: "A's Capital", d: '', c: fmt(aCap) })
  if (bCap)        rows.push({ p: "B's Capital", d: '', c: fmt(bCap) })
  if (creditors)   rows.push({ p: 'Sundry Creditors', d: '', c: fmt(creditors) })
  if (billsPayable)rows.push({ p: 'Bills Payable', d: '', c: fmt(billsPayable) })
  if (shortTermLoan) rows.push({ p: 'Short-term Loan', d: '', c: fmt(shortTermLoan) })
  if (reserve)     rows.push({ p: 'General Reserve', d: '', c: fmt(reserve) })
  if (badDebtsRecovered) rows.push({ p: 'Bad Debts Recovered', d: '', c: fmt(badDebtsRecovered) })
  if (discountReceived)  rows.push({ p: 'Discount Received',  d: '', c: fmt(discountReceived) })
  if (cashBank)    rows.push({ p: 'Cash at Bank', d: '', c: fmt(cashBank) })
  if (stock)       rows.push({ p: 'Closing Stock',    d: fmt(stock), c: '' })

  const totals = (rows.reduce((s, r) => s + (Number(String(r.d).replace(/,/g, '')) || 0), 0))
  const totalc = (rows.reduce((s, r) => s + (Number(String(r.c).replace(/,/g, '')) || 0), 0))
  // Synthesise a Cash in Hand to balance if needed
  let cashInHand = 0
  if (totals > totalc) {
    // put missing on Credit side
  } else if (totalc > totals) {
    cashInHand = totalc - totals
    rows.push({ p: 'Cash in Hand', d: '', c: fmt(cashInHand) })
  }
  // Re-check totals after potential balancing
  const d2 = rows.reduce((s, r) => s + (Number(String(r.d).replace(/,/g, '')) || 0), 0)
  const c2 = rows.reduce((s, r) => s + (Number(String(r.c).replace(/,/g, '')) || 0), 0)
  const balancingAmount = d2 - c2
  if (balancingAmount > 0) {
    // extra debit — add Cash in Hand on debit (must be the balancing figure)
    rows.unshift({ p: 'Cash in Hand', d: fmt(balancingAmount), c: '' })
  } else if (balancingAmount < 0) {
    rows.unshift({ p: 'Cash in Hand', d: '', c: fmt(-balancingAmount) })
  }

  // Re-tally to confirm
  const finalD = rows.reduce((s, r) => s + (Number(String(r.d).replace(/,/g, '')) || 0), 0)
  const finalC = rows.reduce((s, r) => s + (Number(String(r.c).replace(/,/g, '')) || 0), 0)
  if (finalD !== finalC) {
    // Add balancing Sales figure to Credit side if still imbalance
    const diff = finalD - finalC
    if (diff > 0) rows.push({ p: 'Sales', d: '', c: fmt(diff) })
    else rows.push({ p: 'Purchases', d: fmt(-diff), c: '' })
  }

  return { rows, closing, openStock, purch, sales, aCap, bCap, aDraw, bDraw }
}

// ============================================================
// ANSWER KEYS — short, section-wise, deterministic to the variant
// ============================================================
function answerKeyForSectionA(rng, variant) {
  // 8 standard MCQ + 2 A&R — gives correct answers
  const out = []
  out.push('A.1 (b)  A.2 (c)  A.3 (b)  A.4 (a)  A.5 (b)')
  if (variant === 0) {
    out.push('A.6 (a)  A.7 (b)  A.8 (c)')
  } else if (variant === 1) {
    out.push('A.6 (a)  A.7 (b)  A.8 (b)')
  } else {
    out.push('A.6 (a)  A.7 (c)  A.8 (c)')
  }
  out.push('A.9 (d)  A.10 (b)')
  return out.join('\n')
}

function answerKeyForSectionB(rng) {
  return [
    'B.1 Mutual agency — the key feature.',
    'B.2 No separate legal entity.',
    'B.3 Equally among all partners.',
    'B.4 A new partner is entitled to share of goodwill.',
    'B.5 Reconstitution ≠ dissolution; ratios change after admission/retirement.',
  ].join('\n')
}

function answerKeyForSectionC(rng) {
  return [
    'C.1 See full sentence in text.',
    'C.2 Show workings as per the partnership deed.',
    'C.3 Distinguish capital methods with example.',
    'C.4 Explain acknowledgement with sample entry.',
    'C.5 State three differences briefly.',
  ].join('\n')
}

function answerKeyForSectionD(rng, variant) {
  return [
    'D.1 (a) Use 10% p.a. on each capital.  (b) Profit-sharing applies after interest.',
    'D.1 (c) Compute apportioned profit for each partner.',
    'D.1 (d) Closing journal entry — debit profit, credit partners.',
    'D.1 (e) State with reason.',
    'D.2 (a) Read admission ratio from data.  (b) Capital entry at agreed ratio.',
    'D.2 (c) Cash distribution as per sacrificing ratio.  (d) Reserves writing off entry.',
    'D.2 (e) Allocate divisible profit.',
    'D.3 Apply 2 years\' average × final year profit.',
    'D.3 Sacrificing ratio = old ratio − new ratio.',
    'D.3 Goodwill adjustment entry — debit gaining partner, credit sacrificing partner.',
  ].join('\n')
}

function answerKeyForSectionE(rng, variant, scenario) {
  // For Q25 (case-based TB) — give a generic working outline
  if (variant === 0) {
    return [
      'E.1 Trading A/c:',
      ' • Dr. Opening Stock, Purchases, direct expenses',
      ' • Cr. Sales, Closing Stock',
      ' • Transfer Gross Profit to P&L (Credit side)',
      'P&L A/c: debit indirect expenses, credit Gross Profit only.',
      'P&L Appropriation: Interest on capital, Interest on drawings, Salary, then divide residual equally.',
    ].join('\n')
  } else if (variant === 1) {
    return [
      'E.1 Trading A/c — compute GP. (Opening Stock + Purchases + Direct Exp − Closing Stock − Sales)',
      'P&L A/c — show GP, less indirect expenses, commissions, etc.',
      'P&L Appr. A/c — show interest on capital @ 10% p.a., interest on drawings @ 6% p.a., general reserve transfer, then residual profit divided equally.',
      'Notes:',
      ' • Short-term loan interest is indirect → P&L',
      ' • Depreciation on fixed asset → P&L',
      ' • Repair expenses — office repairs go to P&L; repair of factory/store goes to Trading A/c',
    ].join('\n')
  } else {
    return [
      'E.1 Trading A/c — gross profit computation.',
      'P&L A/c — net profit after indirect expenses.',
      'P&L Appropriation A/c — interest on capital to A and B, interest on drawings from them, residual equally.',
      'Notes:',
      ' • Bills Receivable endorsed → excluded from realisation on dishonour.',
      ' • Carriage outward → indirect expense → P&L A/c',
      ' • Sales Return added back to Sales in Trading A/c',
      ' • Closing stock goes to Trading A/c credit side',
    ].join('\n')
  }
}

const LONG_BANK = [
  (rng, paperIndex) => {
    const v = paperIndex % 3
    const firm = ['Khanna & Sons', 'Mehta & Co.', 'Patel Brothers'][v]
    const closingDate = ['31st March 2025', '31st March 2025', '31st March 2025'][v]
    const scenario = trialBalanceScenario(rng, v)
    const table = trialBalanceTable(scenario.rows)
    const infoList = [
      ' • Interest on capital is to be provided at 10% p.a.',
      ' • Interest on drawings is to be charged at 6% p.a.',
      ' • Partners share profits and losses equally.',
    ]
    return {
      stem:
        `From the following Trial Balance of M/s ${firm} as on ${closingDate}, prepare Trading and Profit & Loss Account for the year ended ${closingDate} and a Profit & Loss Appropriation Account:\n\n` +
        `Trial Balance as on ${closingDate}:\n\n` +
        table +
        `\n\n` +
        `Additional information:\n` +
        infoList.join('\n') + '\n' +
        ` • Closing stock as on ${closingDate} was valued at Rs.${fmt(scenario.closing)}.\n\n` +
        `Show all workings clearly in the Trading Account, Profit & Loss Account, and Profit & Loss Appropriation Account.`,
      answerKey: answerKeyForSectionE(rng, v, scenario),
      variant: v,
    }
  },
  (rng, paperIndex) => {
    const psr = randInt(rng, 4, 7)
    const qsr = randInt(rng, 2, 5)
    const capitalA = randInt(rng, 400, 900) * 1000
    const capitalB = randInt(rng, 300, 700) * 1000
    const capitalC = randInt(rng, 100, 400) * 1000
    const avg1 = randInt(rng, 100, 250) * 1000
    const avg2 = randInt(rng, 100, 250) * 1000
    const avg3 = randInt(rng, 150, 300) * 1000
    const revalAsset = randInt(rng, 20, 60) * 1000
    const revalLiab = randInt(rng, 10, 30) * 1000
    return {
      stem:
        `A, B and C are partners in a firm sharing profits and losses in the ratio ${psr}:${qsr}:1.\n\n` +
        `Capital balances as on 1st April 2024:\n` +
        `  A's Capital = Rs.${fmt(capitalA)},  B's Capital = Rs.${fmt(capitalB)},  C's Capital = Rs.${fmt(capitalC)}.\n\n` +
        `C retires on 31st March 2025 on the following terms:\n\n` +
        ` (a) Goodwill of the firm is to be valued at 2 years' purchase of the average profits of the last 3 years. Profits for the three preceding years were Rs.${fmt(avg1)}, Rs.${fmt(avg2)} and Rs.${fmt(avg3)} respectively.\n\n` +
        ` (b) A Revaluation Account is to be opened. A piece of land was undervalued by Rs.${fmt(revalAsset)}; an unrecorded liability of Rs.${fmt(revalLiab)} was identified.\n\n` +
        ` (c) The new profit-sharing ratio between A and B is to be ${psr}:${qsr}.\n\n` +
        `Prepare in the books of the firm:\n (i) Revaluation Account;\n (ii) Partners' Capital Accounts (showing settlement of C's retirement); and\n (iii) The journal entry for goodwill settlement.`,
      answerKey: answerKeyForSectionE(rng, 0, null),
      variant: 0,
    }
  },
  (rng, paperIndex) => {
    const cashBank = randInt(rng, 30, 90) * 1000
    const sundryAssets = randInt(rng, 200, 600) * 1000
    const sundryLiab = randInt(rng, 80, 200) * 1000
    const loan = randInt(rng, 50, 150) * 1000
    const capA = randInt(rng, 200, 500) * 1000
    const capB = randInt(rng, 150, 400) * 1000
    const reserve = randInt(rng, 20, 60) * 1000
    const assetsRealised = randInt(rng, 150, 400) * 1000
    const liabDiscount = randInt(rng, 5, 20) * 1000
    const assetTaken = randInt(rng, 30, 80) * 1000
    const expenses = randInt(rng, 3, 10) * 1000
    return {
      stem:
        `A and B, partners sharing profits and losses in the ratio 3:2, dissolved their partnership firm on 31st March 2025.\n\n` +
        `On the date of dissolution, the books showed the following balances:\n` +
        `  Cash at Bank Rs.${fmt(cashBank)} (Dr.); Sundry Assets Rs.${fmt(sundryAssets)}; Sundry Liabilities Rs.${fmt(sundryLiab)};\n` +
        `  Loan from Bank Rs.${fmt(loan)}; A's Capital Rs.${fmt(capA)}; B's Capital Rs.${fmt(capB)}; Reserve Fund Rs.${fmt(reserve)} (Cr.).\n\n` +
        `The following transactions took place:\n\n` +
        ` (i) Assets were realised at Rs.${fmt(assetsRealised)}.\n` +
        ` (ii) Liabilities were settled at a discount of Rs.${fmt(liabDiscount)}.\n` +
        ` (iii) A agreed to take over an asset at Rs.${fmt(assetTaken)} (book value).\n` +
        ` (iv) Realisation expenses of Rs.${fmt(expenses)} were paid by the firm.\n\n` +
        `Prepare: Realisation Account, Partners' Capital Accounts, and Bank Account to close the books of the firm.`,
      answerKey: answerKeyForSectionE(rng, 0, null),
      variant: 0,
    }
  },
]

// ============================================================
// PAPER BUILDER — assembles a paper object consumable by buildPaperPdf()
// ============================================================
function buildPaper(rng, paperIndex = 0) {
  const mcqPicks = shuffle(rng, MCQ_BANK).slice(0, 8)
  // Pad with 2 A&R items treated as MCQs (with 4 standard A&R options)
  const arAsMcq = shuffle(rng, AR_BANK).slice(0, 2)
  const allMcq = [...mcqPicks, ...arAsMcq]
  // Deduplicate by accidental index collision
  const finalMcq = shuffle(rng, allMcq).slice(0, 10)

  const sectionA = {
    name: 'A',
    type: 'mcq',
    type_label: 'Multiple Choice Questions',
    marks_per_question: 1,
    instructions: 'Choose the most appropriate option. Each question carries 1 mark. Questions 9 and 10 are Assertion-Reason items.',
    questions: finalMcq.map((q, i) => {
      const isAR = Array.isArray(q.options)
      if (isAR) {
        // A&R item
        return {
          number: `A.${i + 1}`,
          text: `Assertion (A): ${q.assertion}\nReason (R): ${q.reason}`,
          options: q.options,
          correct: q.options[q.correct],
          marks: 1,
        }
      }
      const opts = q.options(rng)
      return {
        number: `A.${i + 1}`,
        text: q.stem(rng),
        options: opts,
        correct: q.correct(0),
        marks: 1,
      }
    }),
  }

  // Section B — 5 Very Short Answer (2 marks each) — VShort section
  const vshortPicks = shuffle(rng, VSHORT_BANK).slice(0, 5)
  const sectionB = {
    name: 'B',
    type: 'vshort',
    type_label: 'Very Short Answer',
    marks_per_question: 2,
    instructions: 'Answer in 2-3 sentences / one formula. Each question carries 2 marks.',
    questions: vshortPicks.map((qFn, i) => {
      const q = qFn(rng)
      return {
        number: `B.${i + 1}`,
        text: q,
        marks: 2,
        options: [],
        correct: '',
      }
    }),
  }

  // Section C — 5 Short Answer (3 marks each)
  const shortPicks = shuffle(rng, SHORT_BANK).slice(0, 5)
  const sectionC = {
    name: 'C',
    type: 'short',
    type_label: 'Short Answer',
    marks_per_question: 3,
    instructions: 'Answer in 4-6 sentences / show working. Each question carries 3 marks.',
    questions: shortPicks.map((qFn, i) => {
      const q = qFn(rng)
      return {
        number: `C.${i + 1}`,
        text: q,
        marks: 3,
        options: [],
        correct: '',
      }
    }),
  }

  // Section D — 2 Case Studies (each 5 marks, 5 sub-parts of 1 mark each)
  const casePicks = shuffle(rng, CASE_STUDY_BANK).slice(0, 2)
  const sectionD = {
    name: 'D',
    type: 'case_study',
    type_label: 'Case Study / Source-Based',
    marks_per_question: 5,
    instructions: 'Read each case study carefully and answer all 5 sub-parts that follow. Each case carries 5 marks (5 × 1 mark sub-parts).',
    questions: casePicks.map((cFn, i) => {
      const c = cFn(rng)
      const subText = c.subQuestions.map((sq, j) => `(${String.fromCharCode(97 + j)}) ${sq}`).join('\n')
      return {
        number: `D.${i + 1}`,
        text: `Case Study ${i + 1}:\n${c.case}\n\n${subText}`,
        marks: 5,
        options: [],
        correct: '',
      }
    }),
  }

  // Section E — 3 Long Answer (each 5 marks; attempt any 3 of 3 = 15 max, fixed marks)
  const longPicks = shuffle(rng, LONG_BANK).slice(0, 3)
  const longQuestions = longPicks.map((qFn, i) => {
    const q = qFn(rng, paperIndex)
    return {
      longObj: q,
      number: `E.${i + 1}`,
      text: q.stem,
      marks: 5,
      options: [],
      correct: '',
    }
  })
  const sectionE = {
    name: 'E',
    type: 'long',
    type_label: 'Long Answer',
    marks_per_question: 5,
    instructions: 'Answer the following. Each question carries 5 marks. Show all working clearly. There is internal choice within each question.',
    questions: longQuestions,
  }

  // Build answer-key section — uses the variant of Q25 (the very first long item)
  const q25 = longQuestions[0]?.longObj
  const variant = q25?.variant ?? 0
  const sections = [sectionA, sectionB, sectionC, sectionD, sectionE]
  const ansKeyText = [
    '═══════ ANSWER KEY / WORKING NOTES ═══════',
    '',
    '— Section A (MCQ) —',
    answerKeyForSectionA(rng, variant),
    '',
    '— Section B (Very Short Answer) —',
    answerKeyForSectionB(rng),
    '',
    '— Section C (Short Answer) —',
    answerKeyForSectionC(rng),
    '',
    '— Section D (Case Studies) —',
    answerKeyForSectionD(rng, variant),
    '',
    '— Section E (Long Answer) —',
    longQuestions
      .map((q, i) => {
        const t = q.longObj.variant !== undefined
          ? answerKeyForSectionE(rng, q.longObj.variant, q.longObj)
          : (q.longObj.answerKey || 'Show all workings as per standard accounting principles.')
        return `E.${i + 1}:\n${t}`
      })
      .join('\n\n'),
  ].join('\n')
  // Attach as a final note-only section so it renders on its own page if needed.
  sections.push({
    name: 'F',
    type: 'note',
    type_label: 'Answer Key / Working Notes (for Teacher Reference Only)',
    marks_per_question: 0,
    instructions: '',
    questions: [
      {
        number: 'F.1',
        text: ansKeyText,
        marks: 0,
        options: [],
        correct: '',
      },
    ],
  })

  // Totals target 60 (E is "attempt any 2 of 3", so user max is 5×5 = 25 but only 10 count)
  return {
    title: 'Accountancy — Class XII',
    subtitle: 'Examination Paper (Partnership)',
    total_marks: 60,
    instructions:
      'Time: 3 Hours. Maximum Marks: 60. All questions are compulsory. Section A: 10 MCQs (1 mark each). Section B: 5 Very Short (2 marks each). Section C: 5 Short (3 marks each). Section D: 2 Case Studies (5 marks each). Section E: 3 Long Answer (5 marks each). Section F: Answer Key (Teacher only).',
    sections,
  }
}

// ============================================================
// MAIN — generate 3 papers, save PDFs, return paths
// ============================================================
async function main() {
  const outputs = []
  const seeds = [101, 271, 509]
  for (let i = 0; i < 3; i++) {
    const paper = buildPaper(makeRng(seeds[i]), i)
    const buf = buildPaperPdf(paper)
    const path = join(OUT_DIR, `accountancy-offline-paper-${i + 1}.pdf`)
    await writeFile(path, buf)
    const totalQ = paper.sections.reduce((n, s) => n + (s.questions?.length || 0), 0)
    const totalM = paper.sections.reduce(
      (n, s) => n + (s.questions?.length || 0) * (s.marks_per_question || 0), 0
    )
    outputs.push({ paper: i + 1, questions: totalQ, marks: totalM, bytes: buf.length, path })
    console.log(JSON.stringify({ paper: i + 1, questions: totalQ, marks: totalM, bytes: buf.length, path }))
  }
  console.log('ALL_PAPERS_GENERATED')
  return outputs
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
