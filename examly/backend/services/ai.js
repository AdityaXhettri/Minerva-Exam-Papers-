// Pluggable AI provider for question generation
// Supports OpenAI (gpt-4o-mini) and Google Gemini (gemini-1.5-flash)

const SYSTEM_PROMPT = `You are an expert exam paper setter for Indian schools (CBSE/State board).
You generate exam questions strictly based on the chapter content provided.
You ALWAYS return valid JSON matching the schema requested. No prose, no markdown.`

// Subjects where questions MUST include numerical/computational elements (figures, amounts, rates, dates, etc.)
const NUMERICAL_SUBJECTS = new Set([
  'accountancy', 'accounting', 'business studies', 'economics', 'commerce',
  'mathematics', 'maths', 'math', 'physics', 'chemistry', 'computer science',
  'information technology', 'statistics', 'taxation', 'banking', 'marketing',
  'entrepreneurship',
])

function buildPrompt({ subject, classLevel, totalMarks, sections, difficulty, instructions, chaptersText }) {
  const sectionPlan = sections.map((s) =>
    `Section ${s.name}: ${s.question_count} questions of type "${s.type}", each worth ${s.marks_per_question} marks`
  ).join('\n')

  const diffPlan = `Difficulty mix — Easy: ${difficulty.easy}%, Medium: ${difficulty.medium}%, Hard: ${difficulty.hard}%`

  const isNumerical = NUMERICAL_SUBJECTS.has((subject || '').toLowerCase())
  const subjectLower = (subject || '').toLowerCase()
  const isSocialScience = subjectLower === 'social science' || subjectLower === 'social studies'
  const numericalRule = isNumerical
    ? `\n- SUBJECT "${subject}" REQUIRES NUMERICAL/COMPUTATIONAL QUESTIONS IN EVERY SECTION. NEVER make any section 100% theory — every section MUST include numerical questions with figures, amounts, ratios, dates, or calculations.
- Section A (MCQ / VShort): AT LEAST 50% numerical questions. Mix conceptual MCQs with calculation-based MCQs (e.g. "If profit is ₹1,20,000 shared in 3:2, A's share is:" with numeric options, ratio problems, interest calculations).
- Section B (Short Answer): AT LEAST 50% numerical questions. Half the questions must involve small computations, journal entries, interest calculations, ratio-based problems with specific amounts. Other half can be theory (definitions, features).
- Section C (Short Answer): 50-60% numerical questions. Most questions should involve calculations, amounts, dates, profit sharing, capital adjustments, interest computations.
- Section D (Long Answer / highest marks): 75% numerical questions. MAJORITY must be calculations-heavy with specific amounts, ratios, dates, multiple partners, prepare Profit & Loss Account, Profit & Loss Appropriation Account, Partners' Capital Accounts, etc. Only 25% can be theory (definitions, features, comparisons).
- Numerical formats for Accountancy: "From the following Trial Balance of M/s X as on 31st March 2024, prepare Trading and P&L Account", "X and Y are partners sharing profits in ratio 3:2. Z is admitted for 1/4 share...", "Calculate interest on capital @ 10% p.a. given capitals of ₹5,00,000 and ₹3,00,000", prepare journal entries, show P&L Appropriation, etc.
- For Mathematics/Physics/Chemistry: include equations, given data, "find" / "calculate" / "solve" / "prove" with explicit numerical values.
- Theory formats (allowed only as minority): definitions, conceptual explanations, classifications, advantages/disadvantages, comparison questions, journal entry explanations, etc.`
    : ''
  const socialScienceRule = isSocialScience
    ? `\n- SUBJECT "Social Science" — STRICT BALANCE RULE: Distribute questions ACROSS History, Geography, Civics / Political Science, and Economics. History should NOT exceed 25% of total questions. Aim for roughly: History 20-25%, Geography 25-30%, Civics / Political Science 25-30%, Economics 20-25%. Use a mix of all four sub-disciplines in EVERY section (A, B, C, D). Do NOT pile up history questions.`
    : ''

  return `Generate an exam paper with the following structure:

Subject: ${subject}
Class: ${classLevel}
Total marks: ${totalMarks}
${diffPlan}

${sectionPlan}

${instructions ? `Special instructions: ${instructions}\n` : ''}

=== CHAPTER CONTENT (use ONLY this to generate questions) ===
${chaptersText}
=== END CHAPTER CONTENT ===

Return JSON in EXACTLY this shape:
{
  "title": "${subject} — Class ${classLevel}",
  "subtitle": "Examination Paper",
  "total_marks": ${totalMarks},
  "instructions": "${instructions || 'All questions are compulsory.'}",
  "sections": [
    {
      "name": "A",
      "type": "<type>",
      "type_label": "<human label>",
      "marks_per_question": <int>,
      "questions": [
        {
          "number": "A.1",
          "text": "<question text>",
          "options": ["(a) ...", "(b) ...", "(c) ...", "(d) ..."],
          "correct": "(a) ...",
          "marks": <int>,
          "difficulty": "easy|medium|hard"
        }
      ]
    }
  ]
}

Rules:
- Include "options" and "correct" only when type is "mcq" or "truefalse"
- For "truefalse", options are ["(a) True", "(b) False"]
- For "vshort", ask 1-3 word answers (definitions, terms, one-line answers). NO options.
- "correct" must match one of the options exactly
- Distribute difficulty across the requested mix (Easy/Medium/Hard percentages)
- Question text should reference the chapter content; do not invent facts outside the chapter
- Numbers MUST be sequential within each section: A.1, A.2, ... B.1, B.2, ...
- Total marks across all questions MUST equal ${totalMarks}${numericalRule}${socialScienceRule}`
}

async function callOpenAI({ apiKey, prompt, baseURL = 'https://api.openai.com/v1', model = null }) {
  const body = {
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 6000,
  }

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenAI-compatible error ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices[0].message.content || ''
}

async function callGemini({ apiKey, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gemini error ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

export async function generateQuestions({ provider, chaptersText, request }) {
  const prompt = buildPrompt({ ...request, chaptersText })
  let raw
  if (provider === 'openai') {
    raw = await callOpenAI({ apiKey: process.env.OPENAI_API_KEY, prompt })
  } else if (provider === 'groq') {
    raw = await callOpenAI({
      apiKey: process.env.GROQ_API_KEY,
      prompt,
      baseURL: 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    })
  } else if (provider === 'gemini') {
    raw = await callGemini({ apiKey: process.env.GEMINI_API_KEY, prompt })
  } else {
    throw new Error('Unknown AI provider')
  }
  // Parse + basic sanity
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Try to extract JSON block from markdown
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('AI returned non-JSON output')
    parsed = JSON.parse(m[0])
  }
  return parsed
}

export function activeProvider() {
  if (process.env.GROQ_API_KEY) return 'groq'
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  return null
}
