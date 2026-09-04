// Quick sanity test for manualWrap — verify it actually wraps long lines.
import { jsPDF } from 'jspdf'
import { manualWrap } from './utils/haryana.js'

const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
doc.setFont('helvetica', 'normal')
doc.setFontSize(11)
const maxW = doc.internal.pageSize.getWidth() - 20 * 2 // ~170mm

const a3 = 'A.3 (b) (rationale: In the absence of a partnership deed, profits are shared equally among all partners.)'
const wrapped = manualWrap(a3, maxW, (s) => doc.getTextWidth(s))
console.log(JSON.stringify(wrapped, null, 2))
console.log('LINES:', wrapped.length)
for (const ln of wrapped) {
  console.log('  W=' + doc.getTextWidth(ln).toFixed(1) + '  [' + ln + ']')
}
