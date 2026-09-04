// Centralized subject list — used across teacher + admin forms
export const SUBJECTS = [
  // Core
  'Mathematics', 'English', 'Hindi',
  // Sciences
  'Science', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Information Technology', 'IP', 'Physical Education',
  // Commerce
  'Accountancy', 'Business Studies', 'Economics', 'Commerce', 'Entrepreneurship', 'Banking', 'Taxation', 'Marketing',
  // Humanities
  'History', 'Geography', 'Political Science', 'Sociology', 'Psychology', 'Philosophy', 'Civics',
  // Languages
  'Sanskrit', 'Urdu', 'Punjabi', 'French', 'German', 'Spanish',
  // Arts / Vocational
  'EVS', 'Art & Craft', 'Music', 'Dance', 'Home Science', 'Agriculture', 'Environmental Studies',
  // Generic fallback
  'Social Science', 'General Knowledge', 'Moral Science',
]

export const CLASSES = ['1','2','3','4','5','6','7','8','9','10','11','12']

// Subject-key normalization (so 'English Core' / 'english' / 'ENGLISH' all map to 'english')
export function subjectKey(name) {
  if (!name) return ''
  return String(name).toLowerCase().trim().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z]/g, '')
}

// Section content types
export const CONTENT_TYPES = [
  { value: 'mcq',        label: 'MCQ' },
  { value: 'mcq_ar',     label: 'MCQ + Assertion-Reason' },
  { value: 'passage',    label: 'Passage / Reading Comprehension' },
  { value: 'grammar',    label: 'Grammar (mixed)' },
  { value: 'writing',    label: 'Writing (Letter/Article/Report)' },
  { value: 'case_study', label: 'Case Study / Source-based' },
  { value: 'map_work',   label: 'Map Work' },
  { value: 'vshort',     label: 'Very Short Answer' },
  { value: 'short',      label: 'Short Answer' },
  { value: 'long',       label: 'Long Answer' },
]

// Subject-aware allowed content types — restricts what the dropdown shows.
// Verified against CBSE NEP 2024-25 + HBSE pattern:
//   - Assertion-Reason: only Sciences, Maths, Commerce (NOT languages)
//   - Case Study: Sciences, Maths, Commerce, Humanities (NOT languages)
//   - Passage/Grammar/Writing: ONLY language subjects
//   - Map Work: ONLY Geography (and SST)
export const SUBJECT_CONTENT_TYPE_WHITELIST = {
  // Language subjects — Passage/Grammar/Writing only (NO A&R, NO Case Study)
  english:        ['mcq', 'passage', 'grammar', 'writing', 'vshort', 'short', 'long'],
  hindi:          ['mcq', 'passage', 'grammar', 'writing', 'vshort', 'short', 'long'],
  sanskrit:       ['mcq', 'passage', 'grammar', 'writing', 'vshort', 'short', 'long'],
  urdu:           ['mcq', 'passage', 'grammar', 'writing', 'vshort', 'short', 'long'],
  punjabi:        ['mcq', 'passage', 'grammar', 'writing', 'vshort', 'short', 'long'],
  french:         ['mcq', 'passage', 'grammar', 'writing', 'vshort', 'short', 'long'],
  german:         ['mcq', 'passage', 'grammar', 'writing', 'vshort', 'short', 'long'],
  spanish:        ['mcq', 'passage', 'grammar', 'writing', 'vshort', 'short', 'long'],
  // Sciences — A&R (CBSE mandate) + Case Study (CBSE mandate) + theory
  physics:        ['mcq', 'mcq_ar', 'vshort', 'short', 'case_study', 'long'],
  chemistry:      ['mcq', 'mcq_ar', 'vshort', 'short', 'case_study', 'long'],
  biology:        ['mcq', 'mcq_ar', 'vshort', 'short', 'case_study', 'long'],
  science:        ['mcq', 'mcq_ar', 'vshort', 'short', 'case_study', 'long'],
  // Mathematics — A&R (2 Qs CBSE mandate) + Case Study (3 Qs Section E CBSE mandate)
  mathematics:    ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  // Commerce — A&R + Case Study (business scenarios are common)
  accountancy:    ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  businessstudies:['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  economics:      ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  commerce:       ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  banking:        ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  taxation:       ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  marketing:      ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  entrepreneurship:['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  // Humanities — A&R + Case Study (source-based) + Map Work (only geo)
  socialscience:  ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study', 'map_work'],
  history:        ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  politicalscience:['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  sociology:      ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  psychology:     ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  philosophy:     ['mcq', 'mcq_ar', 'vshort', 'short', 'long'],
  civics:         ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  geography:      ['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study', 'map_work'],
  // Vocational / Misc
  computerscience:['mcq', 'mcq_ar', 'vshort', 'short', 'long', 'case_study'],
  physicaleducation:['mcq', 'vshort', 'short', 'long'],
}

// Returns the content-type list relevant for a given subject (whitelist-aware).
export function getAllowedContentTypes(subject) {
  const key = subjectKey(subject)
  const allow = SUBJECT_CONTENT_TYPE_WHITELIST[key]
  if (!allow) return CONTENT_TYPES // generic — show all
  return CONTENT_TYPES.filter((c) => allow.includes(c.value))
}

// Section type (UI grouping)
export const SECTION_TYPES = [
  { value: 'mcq',     label: 'MCQ' },
  { value: 'vshort',  label: 'Very Short Answer' },
  { value: 'short',   label: 'Short Answer' },
  { value: 'long',    label: 'Long Answer' },
  { value: 'fill',    label: 'Fill in the Blanks' },
  { value: 'truefalse', label: 'True / False' },
  { value: 'reading', label: 'Reading' },
  { value: 'writing', label: 'Writing' },
  { value: 'grammar', label: 'Grammar' },
]

// Subject-wise default section structures (verified against HBSE/CBSE board patterns).
// Teacher/Admin can apply this in one click, then freely edit count / marks / contentType.
export const SUBJECT_SECTION_PRESETS = {
  physics: {
    totalMarks: 70,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 16, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort',     question_count: 4,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',      question_count: 7,  marks_per_question: 3 },
      { name: 'D', type: 'short',  contentType: 'case_study', question_count: 2,  marks_per_question: 4 },
      { name: 'E', type: 'long',   contentType: 'long',       question_count: 3,  marks_per_question: 5 },
    ],
  },
  chemistry: {
    totalMarks: 70,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 16, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort',     question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',      question_count: 7,  marks_per_question: 3 },
      { name: 'D', type: 'short',  contentType: 'case_study', question_count: 2,  marks_per_question: 4 },
      { name: 'E', type: 'long',   contentType: 'long',       question_count: 3,  marks_per_question: 5 },
    ],
  },
  biology: {
    totalMarks: 60,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 18, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort',     question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',      question_count: 7,  marks_per_question: 3 },
      { name: 'D', type: 'short',  contentType: 'case_study', question_count: 2,  marks_per_question: 4 },
    ],
  },
  mathematics: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq',    question_count: 20, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort', question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',  question_count: 6,  marks_per_question: 3 },
      { name: 'D', type: 'long',   contentType: 'long',   question_count: 6,  marks_per_question: 5 },
    ],
  },
  science: {
    totalMarks: 60,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 16, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort',     question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',      question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'short',  contentType: 'case_study', question_count: 2,  marks_per_question: 4 },
      { name: 'E', type: 'long',   contentType: 'long',       question_count: 3,  marks_per_question: 5 },
    ],
  },
  accountancy: {
    totalMarks: 60,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq',    question_count: 10, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort', question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',  question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'long',   contentType: 'long',   question_count: 3,  marks_per_question: 5 },
    ],
  },
  businessstudies: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 10, marks_per_question: 1 },
      { name: 'B', type: 'short',  contentType: 'short',      question_count: 2,  marks_per_question: 3 },
      { name: 'C', type: 'short',  contentType: 'case_study', question_count: 3,  marks_per_question: 4 },
      { name: 'D', type: 'long',   contentType: 'long',       question_count: 2,  marks_per_question: 6 },
    ],
  },
  economics: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 16, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort',     question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',      question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'short',  contentType: 'case_study', question_count: 2,  marks_per_question: 4 },
      { name: 'E', type: 'long',   contentType: 'long',       question_count: 2,  marks_per_question: 5 },
    ],
  },
  commerce: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 16, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort',     question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',      question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'short',  contentType: 'case_study', question_count: 2,  marks_per_question: 4 },
      { name: 'E', type: 'long',   contentType: 'long',       question_count: 2,  marks_per_question: 5 },
    ],
  },
  english: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'reading', contentType: 'passage', question_count: 2,  marks_per_question: 5 },
      { name: 'B', type: 'writing', contentType: 'writing', question_count: 3,  marks_per_question: 5 },
      { name: 'C', type: 'grammar', contentType: 'grammar', question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'long',    contentType: 'long',    question_count: 4,  marks_per_question: 5 },
    ],
  },
  hindi: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'reading', contentType: 'passage', question_count: 2,  marks_per_question: 5 },
      { name: 'B', type: 'writing', contentType: 'writing', question_count: 2,  marks_per_question: 5 },
      { name: 'C', type: 'grammar', contentType: 'grammar', question_count: 5,  marks_per_question: 2 },
      { name: 'D', type: 'long',    contentType: 'long',    question_count: 3,  marks_per_question: 5 },
    ],
  },
  sanskrit: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'reading', contentType: 'passage', question_count: 2,  marks_per_question: 5 },
      { name: 'B', type: 'grammar', contentType: 'grammar', question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',   contentType: 'short',   question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'long',    contentType: 'long',    question_count: 3,  marks_per_question: 5 },
    ],
  },
  socialscience: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 20, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort',     question_count: 6,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'case_study', question_count: 4,  marks_per_question: 3 },
      { name: 'D', type: 'long',   contentType: 'long',       question_count: 3,  marks_per_question: 5 },
    ],
  },
  history: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 16, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort',     question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'case_study', question_count: 3,  marks_per_question: 3 },
      { name: 'D', type: 'long',   contentType: 'long',       question_count: 3,  marks_per_question: 5 },
    ],
  },
  geography: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 16, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort',     question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',      question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'short',  contentType: 'map_work',   question_count: 2,  marks_per_question: 4 },
      { name: 'E', type: 'long',   contentType: 'long',       question_count: 3,  marks_per_question: 5 },
    ],
  },
  politicalscience: {
    totalMarks: 80,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq_ar',     question_count: 16, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort',     question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'case_study', question_count: 3,  marks_per_question: 3 },
      { name: 'D', type: 'long',   contentType: 'long',       question_count: 3,  marks_per_question: 5 },
    ],
  },
  computerscience: {
    totalMarks: 70,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq',    question_count: 16, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort', question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',  question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'long',   contentType: 'long',   question_count: 3,  marks_per_question: 5 },
    ],
  },
  physicaleducation: {
    totalMarks: 70,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq',    question_count: 20, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort', question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',  question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'long',   contentType: 'long',   question_count: 3,  marks_per_question: 5 },
    ],
  },
}

// Get preset for a given subject name (returns default if no specific preset).
export function getSubjectPreset(subject) {
  const key = subjectKey(subject)
  if (SUBJECT_SECTION_PRESETS[key]) return SUBJECT_SECTION_PRESETS[key]
  // Generic fallback for any subject
  return {
    totalMarks: 50,
    sections: [
      { name: 'A', type: 'mcq',    contentType: 'mcq',    question_count: 15, marks_per_question: 1 },
      { name: 'B', type: 'vshort', contentType: 'vshort', question_count: 5,  marks_per_question: 2 },
      { name: 'C', type: 'short',  contentType: 'short',  question_count: 5,  marks_per_question: 3 },
      { name: 'D', type: 'long',   contentType: 'long',   question_count: 3,  marks_per_question: 5 },
    ],
  }
}

// Per-section difficulty multipliers — boost how hard/easy a section should lean
// Used by AI prompt. easy/medium/hard percentages can sum to 100 (default).
export const DIFFICULTY_LEVELS = [
  { value: 'easy',   label: 'Easy',   hint: 'Direct recall, simple calculations' },
  { value: 'medium', label: 'Medium', hint: 'Application, standard problems' },
  { value: 'hard',   label: 'Hard',   hint: 'Analytical, multi-step, conceptual' },
]
