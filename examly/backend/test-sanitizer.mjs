// Quick self-test for sanitizer + prompt — runs locally, no DB, no API calls required.
import { sanitizeText, getSanitizerStats } from './services/ai.js'

const fixtures = [
  'Existing partners share profit in the ratio 2:1. A new partner is admitted for a one third share.',
  'E x i s t i n g   p a r t n e r s   s h a r e   p r o f i t   i n   t h e   r a t i o   2 : 1 .',
  'Profit of Rs.1,20,000 shared in 3:2. What is A share?',
  'R s . 1 , 2 0 , 0 0 0 shared in 3 : 2 . What is A share?',
  'Interest at 12% p.a. on Rs. 5 , 00 , 000 is?',
  'I am a student of class 12 and partnership is a legal relation.',
  'Profit for the year ending 31st March 2024 to be shared.',
]

for (const fx of fixtures) {
  const out = sanitizeText(fx)
  const changed = out !== fx
  console.log(JSON.stringify({ changed, in: fx, out }))
}
console.log('STATS', getSanitizerStats())

const safeText = 'I am going to the market to buy a book.'
const safeOut = sanitizeText(safeText)
console.log(JSON.stringify({ changed: safeOut !== safeText, in: safeText, out: safeOut }))
