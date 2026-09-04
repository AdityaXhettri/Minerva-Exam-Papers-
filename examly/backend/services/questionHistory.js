// Question history + fingerprint utilities
// Goal: prevent repeat questions when the same chapter is used to generate multiple papers
// Strategy:
//   1. Fingerprint = normalised lowercased text + bag of first 6-8 keywords (cheap "semantic-ish" dedup)
//   2. Store every generated question in question_history
//   3. Before generating a new paper, fetch last N fingerprints for the same subject+class+chapter
//      and inject them into the AI prompt as "DO NOT REPEAT" examples.

import crypto from 'crypto'

// Lightweight stopwords for English + a few Hindi/Hinglish common words
const STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','am','do','does','did','done',
  'has','have','had','having','of','in','on','at','to','for','with','by','from','as','into',
  'and','or','but','if','so','than','that','this','these','those','it','its','which','what',
  'who','whom','whose','where','when','why','how','can','could','should','would','may','might',
  'will','shall','must','also','such','any','all','each','every','some','most','more','less',
  'much','many','few','one','two','three','four','five','six','seven','eight','nine','ten',
  'given','calculate','find','state','define','explain','write','mention','list','name','describe',
  'discuss','examine','analyse','analyze','compare','contrast','differentiate','distinguish',
  'illustrate','give','example','examples','your','answer','following','below','above','true',
  'false','yes','no','not','only','just','about','because','between','during','without',
  'ke','ka','ki','hai','hain','mein','me','ko','se','par','aur','ya','jo','ki','ek','do',
  'teen','char','paanch','bataiye','likhiye','samjhaiye','kiya','kya','kar','kre','kaun',
])

export function normaliseText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\u0900-\u097F]/g, ' ') // keep a-z, 0-9, devanagari
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractKeywords(text, max = 8) {
  const norm = normaliseText(text)
  const tokens = norm.split(' ').filter((t) => t && t.length >= 3 && !STOPWORDS.has(t))
  // Take the first N significant tokens (in order). Same first-token order usually = same topic.
  const seen = new Set()
  const out = []
  for (const t of tokens) {
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= max) break
  }
  return out
}

// Fingerprint: SHA-256 of (first 8 keywords joined). Stable, fast, collision-resistant enough.
export function fingerprint(text) {
  const keywords = extractKeywords(text, 8)
  const joined = keywords.join('|')
  return crypto.createHash('sha256').update(joined).digest('hex')
}

// Similarity (Jaccard) over keyword sets — used to find "near-duplicates" not just exact.
export function similarity(a, b) {
  const ka = new Set(extractKeywords(a, 12))
  const kb = new Set(extractKeywords(b, 12))
  if (ka.size === 0 || kb.size === 0) return 0
  let inter = 0
  for (const t of ka) if (kb.has(t)) inter++
  const union = new Set([...ka, ...kb]).size
  return inter / union
}

import { db } from '../db.js'

// Record every generated question into history
export function recordQuestions({ subject, classLevel, paperId, sections }) {
  const insert = db.prepare(`
    INSERT INTO question_history (subject, class_level, chapter, paper_id, question_text, fingerprint, content_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  for (const sec of sections || []) {
    const ct = sec.contentType || sec.type || 'mcq'
    for (const q of sec.questions || []) {
      const text = (q.text || '').trim()
      if (!text) continue
      insert.run(
        String(subject || ''),
        String(classLevel || ''),
        String(q.chapter || '').slice(0, 200),
        paperId || null,
        text,
        fingerprint(text),
        ct
      )
    }
  }
}

// Fetch recent questions to inject into AI prompt so it avoids repetition.
// Returns array of { text, chapter, fingerprint }
export function getRecentQuestions({ subject, classLevel, limit = 60 }) {
  const rows = db.prepare(`
    SELECT question_text as text, chapter, fingerprint, created_at
    FROM question_history
    WHERE subject = ? AND class_level = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(String(subject || ''), String(classLevel || ''), Number(limit) || 60)
  return rows
}

// Check whether a candidate question is too similar to any existing one.
// Returns the matching existing question if found, else null.
export function findDuplicate({ subject, classLevel, candidateText, threshold = 0.7 }) {
  const fp = fingerprint(candidateText)
  const exact = db.prepare(`
    SELECT question_text as text, chapter FROM question_history
    WHERE subject = ? AND class_level = ? AND fingerprint = ?
    LIMIT 1
  `).get(String(subject || ''), String(classLevel || ''), fp)
  if (exact) return exact

  // Near-duplicate check: scan recent questions and compute Jaccard similarity.
  const recent = getRecentQuestions({ subject, classLevel, limit: 80 })
  for (const r of recent) {
    if (r.fingerprint === fp) return r
    const s = similarity(candidateText, r.text)
    if (s >= threshold) return r
  }
  return null
}

// Build a "DO NOT REPEAT" block for the AI prompt from recent history.
export function buildAvoidRepetitionBlock({ subject, classLevel, maxItems = 30 }) {
  const recent = getRecentQuestions({ subject, classLevel, limit: maxItems })
  if (!recent.length) return ''
  const list = recent
    .filter((r) => r.text && r.text.length > 10)
    .slice(0, maxItems)
    .map((r, i) => `${i + 1}. ${r.text.slice(0, 200)}${r.chapter ? ` [${r.chapter}]` : ''}`)
    .join('\n')
  return `\n- DO NOT REPEAT THE FOLLOWING ${recent.length} RECENTLY-GENERATED QUESTIONS for ${subject} Class ${classLevel}. Phrase each question DIFFERENTLY or pick a different concept/angle. You may test the same concept if worded substantially differently:\n${list}\n`
}
