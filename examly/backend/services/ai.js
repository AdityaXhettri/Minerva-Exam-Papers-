// Pluggable AI provider for question generation
// Supports OpenAI (gpt-4o-mini) and Google Gemini (gemini-1.5-flash)

const SYSTEM_PROMPT = `You are an expert exam paper setter for Indian schools (CBSE/State board).
You generate exam questions strictly based on the chapter content provided.
You ALWAYS return valid JSON matching the schema requested. No prose, no markdown.`

function buildPrompt({ subject, classLevel, totalMarks, sections, difficulty, instructions, chaptersText }) {
  const sectionPlan = sections.map((s) =>
    `Section ${s.name}: ${s.question_count} questions of type "${s.type}", each worth ${s.marks_per_question} marks`
  ).join('\n')

  const diffPlan = `Difficulty mix — Easy: ${difficulty.easy}%, Medium: ${difficulty.medium}%, Hard: ${difficulty.hard}%`

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
- "correct" must match one of the options exactly
- Distribute difficulty across the requested mix (Easy/Medium/Hard percentages)
- Question text should reference the chapter content; do not invent facts outside the chapter
- Numbers MUST be sequential within each section: A.1, A.2, ... B.1, B.2, ...
- Total marks across all questions MUST equal ${totalMarks}`
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
