// Quick test of PDF generation
import { buildPaperPdf } from './utils/haryana.js'
import fs from 'fs'

const paper = {
  title: 'Accountancy — Class 12',
  subtitle: 'Examination Paper',
  totalMarks: '60',
  examDate: '__________',
  instructions: 'All questions are compulsory.',
  sections: [
    {
      name: 'A',
      type: 'mcq',
      type_label: 'Multiple Choice Questions',
      marks_per_question: 1,
      questions: [
        { text: 'According to Section 4 of the Indian Partnership Act 1932, a partnership is the relation between persons who have agreed to share the profits of a business carried on by all or any of them acting for all. What is the primary basis of this definition?', options: ['Joint ownership of assets', 'Agreement to share profits', 'Legal entity status', 'Minimum two partners'] },
        { text: 'X and Y are partners in a firm sharing profits in the ratio 3:2. If the net profit for the year is ₹1,00,000, what is X\'s share of the profit?', options: ['₹20,000', '₹25,000', '₹30,000', '₹35,000'] },
        { text: 'If a partner\'s capital balance is ₹5,00,000 and interest on capital is allowed at 10% p.a., the amount of interest on capital is:', options: ['₹5,000', '₹10,000', '₹50,000', '₹1,00,000'] },
        { text: 'In the absence of a specific agreement, the Indian Partnership Act 1932 prescribes that profits and losses are shared among partners in the ratio of:', options: ['Capital contributed', '1:1', '2:1', '3:2'] },
        { text: 'Partners X and Y have capitals of ₹1,00,000 and ₹2,00,000 respectively. If interest on capital is allowed at 10% p.a., what is the total interest on capital?', options: ['₹10,000', '₹15,000', '₹20,000', '₹30,000'] },
        { text: 'A partnership firm has no separate legal entity apart from the partners constituting it. This feature is known as:', options: ['Mutual Agency', 'Joint and Several Liability', 'Unlimited Liability', 'No Separate Legal Entity'] },
        { text: 'The name under which the partnership business is carried is called:', options: ['Trade Name', 'Firm\'s Name', 'Business Name', 'Legal Name'] },
        { text: 'If a partner draws ₹10,000 at the beginning of the year and interest on drawings is charged at 10% p.a., what is the interest on drawings for that year?', options: ['₹1,000', '₹500', '₹1,500', '₹2,000'] },
      ],
    },
    {
      name: 'B',
      type: 'vshort',
      type_label: 'Very Short Answer',
      marks_per_question: 2,
      questions: [
        { text: 'Define Partners according to the Indian Partnership Act 1932.' },
        { text: 'What is the Firm\'s Name in a partnership?' },
        { text: 'Does a partnership firm have a separate legal entity?' },
        { text: 'Name the Act that applies when there is no specific agreement on profit distribution.' },
        { text: 'Calculate the interest on capital for a partner with capital of ₹2,00,000 if rate is 10% p.a.' },
      ],
    },
    {
      name: 'C',
      type: 'short',
      type_label: 'Short Answer',
      marks_per_question: 3,
      questions: [
        { text: 'Explain the nature of partnership as defined in Section 4 of the Indian Partnership Act 1932.' },
        { text: 'A and B are partners sharing profits in 3:2. A\'s capital is ₹5,00,000 and B\'s is ₹3,00,000. Calculate interest on capital at 10% p.a.' },
        { text: 'Differentiate between Partners and Firm.' },
      ],
    },
    {
      name: 'D',
      type: 'long',
      type_label: 'Long Answer',
      marks_per_question: 5,
      questions: [
        { text: 'A, B, and C are partners sharing profits in 3:2:1. A\'s capital is ₹5,00,000, B\'s is ₹3,00,000, and C\'s is ₹2,00,000. Interest on capital is allowed at 10% p.a. Prepare the Profit and Loss Appropriation Account.' },
        { text: 'Explain the nature of a Partnership Firm in detail, highlighting the legal status of the firm and the partners.' },
      ],
    },
  ],
}

const pdfBuffer = buildPaperPdf(paper)
fs.writeFileSync('test-paper.pdf', pdfBuffer)
console.log(`PDF generated: ${pdfBuffer.length} bytes, saved to test-paper.pdf`)
