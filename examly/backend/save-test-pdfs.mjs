import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const res = await fetch('http://localhost:5001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'changeme123' }),
})
const { token } = await res.json()

const dir = join(tmpdir(), 'examly-accountancy-test-papers')
await rm(dir, { recursive: true, force: true })
await mkdir(dir, { recursive: true })

const body = JSON.stringify({
  subject: 'Accountancy',
  class_level: '12',
  chapter_label: 'Partnership',
  count: 3,
})
const r = await fetch('http://localhost:5001/api/ai/test-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body,
})
const json = await r.json()
const summary = { ok: json.papers?.filter((x) => x.ok).length, diversity: json.diversity }

const out = []
for (const paper of json.papers || []) {
  if (!paper.ok) continue
  const pdf = await fetch('http://localhost:5001/api/ai/test-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      subject: 'Accountancy',
      class_level: '12',
      chapter_label: 'Partnership',
      count: 1,
      _paper_index: paper.index,
    }),
  }).catch(() => null)
  const path = join(dir, `accountancy-test-paper-${paper.index}.pdf`)
  out.push({ paper: paper.index, questions: paper.questionCount, path })
}

// Instead of re-issuing per-paper requests, save the multi-paper response PDFs by issuing 1-paper requests.
const perPaper = []
for (let i = 1; i <= 3; i++) {
  const one = await fetch('http://localhost:5001/api/ai/test-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      subject: 'Accountancy',
      class_level: '12',
      chapter_label: 'Partnership',
      count: 1,
    }),
  })
  const j = await one.json()
  const p = (j.papers || []).find((x) => x.ok)
  if (!p) continue
  perPaper.push({ paper: i, questions: p.questionCount, size: (j.pdfs || [{}])[0].size })
}

console.log(JSON.stringify({ summary, multi_result: out, per_paper_runs: perPaper }, null, 2))
