/**
 * CallSuraksha AI — risk engine tests (Phase 5).
 *
 * Plain Node, no framework: `node server/test-risk-engine.js`
 * (or `npm run test:risk` from the app root). Each case feeds a synthetic
 * transcript to analyzeTranscript() and checks the expected risk band.
 * A mismatch is a failure — and is classified as a false positive
 * (expected Low/Unable, got Medium/High) or a false negative
 * (expected High/Medium, got Low/Unable), so both error directions are
 * visible. Exit code 0 = all pass, 1 = any failure.
 *
 * The transcripts here are synthetic test data only — no real calls.
 */

import { analyzeTranscript } from './risk-engine.js'

const CASES = [
  // --- Fraud-like conversations -------------------------------------------
  {
    name: '01 clean high-risk OTP (Poorvi transcript, real Prisma output)',
    transcript:
      'नमस्ते, मैं आपके bank से बोल रहा हूँ। आपका account block हो गया है। कृपया अपना OTP बताइये।',
    expected: 'High',
    mustContainCategory: 'OTP_DEMAND',
  },
  {
    name: '02 clean digital arrest',
    transcript:
      'मैं cyber crime branch से बोल रहा हूँ। आपके खिलाफ FIR दर्ज हुई है। Digital arrest से बचना है तो तुरंत पैसे transfer कीजिए।',
    expected: 'High',
    mustContainCategory: 'DIGITAL_ARREST',
  },
  {
    name: '03 noisy high-risk, partial transcript',
    transcript: 'आपका account... OTP bataiye... block ho jayega',
    expected: 'High',
    mustContainCategory: 'OTP_DEMAND',
  },
  {
    name: '04 Hinglish code-mix high-risk (KYC link + OTP share)',
    transcript:
      'Hello sir, your KYC expired hai, link par click karke update karo, OTP share karo',
    expected: 'High',
    mustContainCategory: 'PAYMENT_PRESSURE',
  },
  {
    name: '05 English-only high-risk',
    transcript:
      'Your bank account will be blocked today. Please share your OTP and CVV to verify.',
    expected: 'High',
    mustContainCategory: 'OTP_DEMAND',
  },
  {
    name: '06 UPI payment request',
    transcript:
      'Is UPI ID par 2000 bhej dijiye, link par click karke pay karein, turant kijiye',
    expected: 'High',
    mustContainCategory: 'PAYMENT_PRESSURE',
  },
  {
    name: '07 fast speech, garbled but risky',
    transcript: 'aapka account block OTP batao turant warna band',
    expected: 'High',
    mustContainCategory: 'OTP_DEMAND',
  },
  {
    name: '08 low-volume / overlapping, partial OTP demand',
    transcript: 'hello... aapka... OTP... bataiye...',
    expected: 'High',
    mustContainCategory: 'OTP_DEMAND',
  },
  {
    name: '09 noisy transcription errors (fragmented words)',
    transcript: 'aapka acco... OTP... bata... block...',
    expected: 'High',
    mustContainCategory: 'OTP_DEMAND',
  },
  {
    name: '10 personal details demand (Aadhaar + PAN)',
    transcript:
      'Verification ke liye apna Aadhaar number aur PAN card number bata dijiye, turant',
    expected: 'High',
    mustContainCategory: 'PERSONAL_DETAILS',
  },
  {
    name: '11 Hindi-only medium (KYC pending + urgency, no demand)',
    transcript:
      'Sir, aapka KYC pending hai, aaj hi branch jakar form bhar dein, turant karein',
    expected: 'Medium',
    mustContainCategory: 'URGENCY',
  },
  {
    name: '12 family emergency money request (ambiguous)',
    transcript: 'Beta main hospital mein hoon, turant 5000 bhej do',
    expected: 'Medium',
    mustContainCategory: 'MONEY_TRANSFER',
  },
  {
    name: '13 bank impersonation claim alone (no demand)',
    transcript:
      'Main SBI bank se bol raha hoon, aapka account verify karna hai',
    expected: 'Medium',
    mustContainCategory: 'IMPERSONATION',
  },

  // --- Genuine / safe conversations (false-positive traps) -----------------
  {
    name: '14 legitimate bank advisory — OTP safety warning (negation)',
    transcript: 'OTP kisi ko mat batana. Bank kabhi OTP nahi mangta.',
    expected: 'Low',
    mustContainCategory: null,
  },
  {
    name: '14b legitimate bank advisory — OTP safety warning in Devanagari (Phase 8)',
    transcript: 'यह एक safety message है। अपना OTP किसी को मत बताना। बैंक कभी phone पर OTP नहीं मांगता।',
    expected: 'Low',
    mustContainCategory: null,
    mustContainAdvisory: 'अपना OTP किसी को मत बताना',
  },
  {
    name: '15 legitimate delivery OTP',
    transcript: 'Aapka delivery OTP 4821 hai, delivery boy ko batayein',
    expected: 'Low',
    mustContainCategory: null,
  },
  {
    name: '16 legitimate branch visit',
    transcript:
      'Aap apne nearest branch mein jakar KYC update karwa sakte hain, koi charge nahi hai',
    expected: 'Low',
    mustContainCategory: null,
  },
  {
    name: '17 telemarketing, non-fraud offer',
    transcript:
      'Sir hum aapko credit card offer de rahe hain, 0% interest, aaj apply karein',
    expected: 'Low',
    mustContainCategory: null,
  },
  {
    name: '18 genuine bank information (balance credit)',
    transcript:
      'Aapke account me 5000 rupaye jama hue hain, balance 25000 hai',
    expected: 'Low',
    mustContainCategory: null,
  },
  {
    name: '19 OTP sent notification (ambiguous, passive)',
    transcript: 'Aapka OTP aapke registered mobile par bheja gaya hai',
    expected: 'Low',
    mustContainCategory: null,
  },
  {
    name: '20 negation in English',
    transcript: 'Never share your OTP with anyone. The bank will never ask for it.',
    expected: 'Low',
    mustContainCategory: null,
  },
  {
    name: '21 quoted / reported scam (speaker refused)',
    transcript:
      'Mujhe ek call aaya tha, usne bola OTP batao, maine mana kar diya',
    expected: 'Low',
    mustContainCategory: null,
  },
  {
    name: '22 Nalini clip transcript (safety warning, real Prisma output)',
    transcript: 'यह call एक संभावित bank fraud का उदाहरण है। OTP kisi ko mat batana.',
    expected: 'Low',
    mustContainCategory: null,
  },

  // --- Unable to Assess ----------------------------------------------------
  {
    name: '23 very noisy / unintelligible',
    transcript: 'mmm... aaa... [unclear]',
    expected: 'Unable to Assess',
    mustContainCategory: null,
  },
  {
    name: '24 short clip under 5 seconds',
    transcript: 'Hello?',
    expected: 'Unable to Assess',
    mustContainCategory: null,
  },
  {
    name: '25 incomplete transcript, only fragments',
    transcript: 'kuch samajh nahi aaya, awaz kat rahi hai',
    expected: 'Unable to Assess',
    mustContainCategory: null,
  },
]

let passed = 0
let falsePositives = 0
let falseNegatives = 0

for (const testCase of CASES) {
  const result = analyzeTranscript(testCase.transcript)
  const bandOk = result.riskBand === testCase.expected
  const categoryOk =
    testCase.mustContainCategory === null ||
    result.highlights.some((h) => h.category === testCase.mustContainCategory)
  // A required advisory sentence must appear in the advisories list.
  const advisoryOk =
    !testCase.mustContainAdvisory ||
    result.advisories.some((a) => a.includes(testCase.mustContainAdvisory))
  // Every highlight must carry all five required fields.
  const shapeOk = result.highlights.every(
    (h) => h.sentence && h.category && h.severity && h.reason && h.precaution,
  )
  const ok = bandOk && categoryOk && advisoryOk && shapeOk
  if (ok) {
    passed += 1
    console.log(`PASS ${testCase.name} -> ${result.riskBand}`)
  } else {
    const isFP =
      (testCase.expected === 'Low' || testCase.expected === 'Unable to Assess') &&
      (result.riskBand === 'Medium' || result.riskBand === 'High')
    const isFN =
      (testCase.expected === 'High' || testCase.expected === 'Medium') &&
      (result.riskBand === 'Low' || result.riskBand === 'Unable to Assess')
    if (isFP) falsePositives += 1
    if (isFN) falseNegatives += 1
    console.log(
      `FAIL ${testCase.name}\n  expected: ${testCase.expected}` +
        (testCase.mustContainCategory ? ` + ${testCase.mustContainCategory}` : '') +
        `\n  got: ${result.riskBand} [${result.highlights.map((h) => h.category).join(', ') || 'none'}]` +
        `\n  bandOk=${bandOk} categoryOk=${categoryOk} shapeOk=${shapeOk}` +
        `\n  reason: ${result.reason}`,
    )
  }
}

console.log(
  `\n${passed}/${CASES.length} passed | false positives: ${falsePositives} | false negatives: ${falseNegatives}`,
)
process.exit(passed === CASES.length ? 0 : 1)
