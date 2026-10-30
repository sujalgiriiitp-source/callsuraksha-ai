/**
 * CallSuraksha AI — risk engine (Phase 5).
 *
 * Pure, rule-based, transparent. No ML model, no invented scores, no
 * percentages. Input is the real Prisma transcript (Devanagari, Roman,
 * or code-mixed Hinglish). Output is a risk BAND — a flag only, never a
 * fraud verdict — plus the exact sentences that triggered it and why.
 *
 * Order of checks (this order is the whole point):
 *   1. Negation first, per sentence. A safety warning ("OTP kisi ko mat
 *      batana") must NEVER be labelled a scam. A sentence that pairs a
 *      risky phrase with a negation/warning marker is an ADVISORY, not a
 *      risk. Legitimate contexts (e.g. a delivery OTP) and reported /
 *      quoted speech ("usne bola OTP batao") are also excluded.
 *   2. Then risk patterns, per sentence, in Devanagari + Roman forms —
 *      including bank/authority impersonation claims.
 *   3. Then the band: High = any high-severity hit; Medium = medium
 *      hits only; Low = nothing risky found (never a guarantee of
 *      safety); Unable to Assess = the transcript is too short, too
 *      fragmented, or too garbled to judge honestly.
 *
 * Every highlight carries: category, severity, the exact sentence as
 * evidence, a plain-language explanation, and a recommended precaution.
 *
 * No timestamps or word-level confidence exist in the Prisma REST
 * response, so highlights are text-matched on the transcript only.
 */

export const RISK_BANDS = ['Low', 'Medium', 'High', 'Unable to Assess']

export const SAFE_STEPS = [
  'OTP, PIN ya CVV kisi ko kabhi mat batayein — bank ye kabhi phone par nahi mangta.',
  'Bank ko khud uske official number par call karke verify karein — caller ke diye number par nahi.',
  'Shak ho to 1930 par report karein.',
]

export const DISCLAIMER =
  'Ye sirf ek risk flag hai — fraud hone ya na hone ka faisla nahi. Faisla hamesha khud verify karke lein.'

// ---------------------------------------------------------------------------
// Sentence splitting: Devanagari danda, full stop, !, ?, newlines.
// ---------------------------------------------------------------------------
export function splitSentences(transcript) {
  // Ellipsis ("...") is hesitation / a noisy-transcription artefact, not
  // a sentence boundary — collapse it so "OTP... bata" stays one sentence.
  const normalised = String(transcript ?? '')
    .replace(/\.{2,}/g, ' ')
    .replace(/…/g, ' ')
  return normalised
    .split(/[।.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Negation / advisory markers (sentence-level, checked FIRST).
// A sentence matching one of these is a safety warning, not a threat.
// ---------------------------------------------------------------------------
const NEGATION_MARKERS = [
  /mat\s+batana/i,
  /mat\s+batao/i,
  /mat\s+bataye/i,
  /mat\s+batayein/i,
  /mat\s+dijiye/i,
  /mat\s+dena/i,
  /na\s+bataye/i,
  /nahi\s+batana/i,
  /nahin\s+batana/i,
  /kisi\s+ko\s+mat/i,
  /kisi\s+se\s+share\s+mat/i,
  /share\s+mat\s+karo/i,
  /share\s+mat\s+karein/i,
  /never\s+share/i,
  /do\s+not\s+share/i,
  /don'?t\s+share/i,
  /kabhi\s+mat/i,
  /kabhi\s+nahi/i,
  /savdhaan/i,
  /beware/i,
  /fraud\s+se\s+bach/i,
  /scam\s+se\s+bach/i,
  // Devanagari forms — Prisma returns Hindi warnings in Devanagari, so
  // the Roman-only markers above miss them (found by the Phase 8 OTP
  // advisory sample: "अपना OTP किसी को मत बताना" was not an advisory).
  /किसी\s+को\s+मत/,
  /मत\s+बताना/,
  /मत\s+बताओ/,
  /मत\s+बताइये/,
  /मत\s+बताइए/,
  /कभी\s+मत/,
  /कभी\s+नहीं/,
  /नहीं\s+बताना/,
  /शेयर\s+मत\s+करो/,
  /सावधान/,
]

// Legitimate contexts that neutralise an otherwise risky phrase.
// E.g. "Aapka delivery OTP 4821 hai" is the user being told their own
// delivery code — not a demand to hand it to a stranger. Likewise an
// OTP that was *sent* to the user ("OTP bheja gaya hai") is a
// notification, not a demand.
const LEGIT_CONTEXTS = [
  /delivery/i,
  /aapka\s+otp\s+hai/i,
  /otp\s+hai\s+\d/i,
  /otp\s+\w*\s*gaya\s+hai/i,
  /otp\s+bhej\w*\s+gaya/i,
  /otp\s+send\s+kiya\s+gaya/i,
]

// Reported / quoted speech: the speaker is *reporting* what someone else
// said ("usne bola OTP batao, maine mana kar diya"), not demanding it
// themselves. Reported demands are context, not a live risk signal.
const REPORTED_SPEECH_MARKERS = [
  /usne\s+(kaha|bola)/i,
  /usne\s+phone\s+par\s+kaha/i,
  /he\s+said/i,
  /she\s+said/i,
  /they\s+said/i,
  /mana\s+kar\s+diya/i,
  /maine\s+refuse/i,
]

function isAdvisory(sentence) {
  return NEGATION_MARKERS.some((re) => re.test(sentence))
}

function isLegitContext(sentence) {
  return LEGIT_CONTEXTS.some((re) => re.test(sentence))
}

function isReportedSpeech(sentence) {
  return REPORTED_SPEECH_MARKERS.some((re) => re.test(sentence))
}

// Marks a transcript too garbled to judge: explicit unintelligibility
// markers with no usable risk signal.
const UNINTELLIGIBLE_MARKERS = [
  /\[unclear\]/i,
  /inaudible/i,
  /samajh\s+(nahi|nahin)\s+aaya/i,
  /samajh\s+mein\s+nahi/i,
  /awaz\s+kat/i,
  /awaz\s+nahi\s+aa\s+rahi/i,
]

// ---------------------------------------------------------------------------
// Risk patterns. Each entry: category, severity, reason (Hinglish, shown
// to the user), and regexes over the lowercased sentence. Devanagari and
// Roman forms are both covered because Prisma returns either depending
// on the speaker's language mix.
// ---------------------------------------------------------------------------
const PATTERNS = [
  {
    category: 'OTP_DEMAND',
    severity: 'high',
    reason: 'Caller OTP / PIN maang raha hai — bank ye phone par kabhi nahi mangta.',
    precaution: 'OTP, PIN ya CVV kabhi share na karein. Call kaatkar bank ko khud official number par call karein.',
    tests: [
      /otp\s+(bata|batao|bataye|batayein|batayie|bataiye|batayen|share|bhej\s+do|bhej\s+dijiye|bhejiye|bhejo|dijiye|bol|boliye|confirm|de\s+dijiye)/i,
      /(bata|batao|bataye|batayein|batayie|bataiye|batayen)\s+(apna\s+)?otp/i,
      // Cross-script code-mix: Roman "OTP" + Devanagari verb, or vice versa.
      /otp\s+(बता|बताओ|बताइये|बताइए|शेयर|भेज)/i,
      /ओटीपी\s*(bata|batao|bataye|share|bhej|tell|give|send)/i,
      // English verb-before-object: "share your OTP", "tell me your PIN".
      /(share|send|give|tell|provide)\s+(me\s+)?(your\s+)?(apna\s+)?(otp|pin|cvv|password)/i,
      /ओटीपी\s*(बता|बताओ|बताइये|बताइए|शेयर|भेज)/i,
      /(अपना\s+)?ओटीपी\s*(बता|बताओ|बताइये|बताइए)/i,
      /pin\s+(bata|batao|bataye|share|bhej|bol)/i,
      /पिन\s*(बता|बताओ|बताइये)/i,
      /cvv\s+(bata|batao|bataye|share|bhej|bol)/i,
      /password\s+(bata|batao|bataye|share|bhej|bol)/i,
      /पासवर्ड\s*(बता|बताओ|बताइये)/i,
    ],
  },
  {
    category: 'ACCOUNT_BLOCK',
    severity: 'high',
    reason: 'Account block / band hone ki dhamki — dabav banane ka tareeka hai.',
    precaution: 'Dhamki par turant action na lein. Bank app ya official number se account status khud check karein.',
    tests: [
      /account\s+(block|band|freeze|froze|suspend|close)/i,
      /account\s+block\s+ho/i,
      /account\s+(will\s+be\s+)?blocked/i,
      /(account|kyc).{0,25}(blocked|block|freeze|frozen|suspend)/i,
      /खाता\s*(बंद|ब्लॉक|फ्रीज)/i,
      /account\s+band\s+(ho|हो)\s+(jayega|जाएगा)/i,
      /kyc\s+(block|band|expire|expired)/i,
      /केवाईसी\s*(बंद|ब्लॉक)/i,
    ],
  },
  {
    category: 'DIGITAL_ARREST',
    severity: 'high',
    reason: 'Police / arrest / case ki dhamki — digital arrest ka dabav hai.',
    precaution: 'Police kabhi phone par arrest ya payment nahi karti. Call kaat dein aur 1930 par report karein.',
    tests: [
      /digital\s+arrest/i,
      /cyber\s+crime/i,
      /\bfir\b/i,
      /police/i,
      /पुलिस/i,
      /arrest/i,
      /गिरफ्तार/i,
      /court\s+case/i,
      /case\s+darj/i,
      /jail/i,
      /जेल/i,
      /cbi/i,
    ],
  },
  {
    category: 'IMPERSONATION',
    severity: 'medium',
    reason: 'Caller khud ko bank / authority bata raha hai — pehchan verify karna zaroori hai.',
    precaution: 'Caller ki pehchan par bharosa na karein. Bank ko khud official number par call karke verify karein.',
    tests: [
      /(main|mein|मैं)\s+.*(bank|बैंक)\s+(se|से)\s+(bol|बोल)/i,
      /(bank|बैंक)\s+(se|से)\s+(bol|बोल)\s+(raha|रहा)/i,
      /\brbi\b\s+(se|से)/i,
      /customer\s+care\s+(se|से)/i,
      /cyber\s+cell\s+(se|से)/i,
      /head\s+office\s+(se|से)/i,
    ],
  },
  {
    category: 'PAYMENT_PRESSURE',
    severity: 'high',
    reason: 'Link / QR / UPI par turant payment ka dabav hai.',
    precaution: 'Anjaan link par click na karein aur QR scan karke payment na karein. Pehle official tareeke se verify karein.',
    tests: [
      /link\s+par\s+click/i,
      /लिंक\s*पर\s*क्लिक/i,
      /payment\s+link/i,
      /qr\s*(code)?\s*scan/i,
      /upi\s*(id|par|pe)?\s*(bhej|pay|payment|transfer)/i,
      /(paise|paisa|payment|amount)\s+(bhej|bhejo|transfer|pay)\s+.*(link|qr|upi)/i,
      /(link|qr|upi)\s+.*(paise|paisa|payment|bhej|transfer)/i,
    ],
  },
  {
    category: 'PERSONAL_DETAILS',
    severity: 'high',
    reason: 'Aadhaar / PAN / card details maange ja rahe hain.',
    precaution: 'Aadhaar, PAN ya card details phone par kabhi share na karein.',
    tests: [
      /aadhaar/i,
      /आधार/i,
      /pan\s*(card|number)?\s*(bata|share|number|de)/i,
      /पैन\s*(कार्ड|नंबर)?\s*(बता|बताओ)/i,
      /card\s+number/i,
      /account\s+number\s*(bata|share|de|bol)/i,
      /खाता\s*संख्या/i,
    ],
  },
  {
    category: 'MONEY_TRANSFER',
    severity: 'medium',
    reason: 'Paise bhejne ko kaha ja raha hai — pehle verify karein.',
    precaution: 'Paise bhejne se pehle receiver ko kisi dusre tareeke se verify karein (dobara call karke ya milkar).',
    tests: [
      /paise\s+(bhej|bhejo|transfer|bhej\s+do)/i,
      /paisa\s+(bhej|bhejo|transfer)/i,
      /पैसे\s*(भेज|भेजो|ट्रांसफर)/i,
      /money\s+(send|transfer)/i,
      // Amount + send verb: "5000 bhej do", "2000 transfer karo".
      /\d[\d,]*\s*(bhej|bhejo|transfer|send|pay\s+kar)/i,
    ],
  },
  {
    category: 'URGENCY',
    severity: 'medium',
    reason: 'Turant / abhi ka dabav — sochne ka time nahi diya ja raha.',
    precaution: 'Jaldi me faisla na lein. Call kaatkar shaanti se verify karein.',
    tests: [
      /turant/i,
      /तुरंत/i,
      /abhi\s+ke\s+abhi/i,
      /aaj\s+hi/i,
      /last\s+chance/i,
      /2\s+minute/i,
      /immediately/i,
      /warna/i,
      /वरना/i,
    ],
  },
]

// ---------------------------------------------------------------------------
// Main entry: analyse one transcript.
// ---------------------------------------------------------------------------
export function analyzeTranscript(transcript) {
  const text = String(transcript ?? '').trim()
  const sentences = splitSentences(text)

  // Too short / garbled to judge honestly — never guess a band.
  const meaningfulWords = text.split(/\s+/).filter((w) => w.length > 1)
  if (!text || sentences.length === 0 || meaningfulWords.length < 3) {
    return {
      riskBand: 'Unable to Assess',
      highlights: [],
      advisories: [],
      safeSteps: SAFE_STEPS,
      disclaimer: DISCLAIMER,
      reason: 'Transcript bahut chhota ya samajh me nahi aaya — risk judge nahi kar sakte.',
    }
  }

  const highlights = []
  const advisories = []

  for (const sentence of sentences) {
    // 1. Negation first: a safety warning is an advisory, never a risk.
    if (isAdvisory(sentence)) {
      advisories.push(sentence)
      continue
    }
    // 2. Legitimate context (e.g. delivery OTP) neutralises the phrase.
    if (isLegitContext(sentence)) {
      advisories.push(sentence)
      continue
    }
    // 3. Reported / quoted speech is context, not a live demand.
    if (isReportedSpeech(sentence)) {
      advisories.push(sentence)
      continue
    }
    // 4. Risk patterns. One sentence can carry several signals (e.g. an
    //    OTP demand AND a payment link) — keep every matching category as
    //    its own indicator, so nothing the transcript actually says is
    //    hidden. Each indicator carries its own reason + precaution.
    for (const pattern of PATTERNS) {
      if (pattern.tests.some((re) => re.test(sentence))) {
        highlights.push({
          sentence,
          category: pattern.category,
          severity: pattern.severity,
          reason: pattern.reason,
          precaution: pattern.precaution,
        })
      }
    }
  }

  // Unable to Assess: every sentence is a fragment, or the transcript
  // says it is unintelligible and no risk signal survived.
  const allFragments = sentences.every((s) => s.split(/\s+/).filter(Boolean).length < 3)
  const unintelligible =
    highlights.length === 0 &&
    UNINTELLIGIBLE_MARKERS.some((re) => re.test(text))
  if (allFragments || unintelligible) {
    return {
      riskBand: 'Unable to Assess',
      highlights,
      advisories,
      safeSteps: SAFE_STEPS,
      disclaimer: DISCLAIMER,
      reason:
        'Transcript adhura ya samajh me nahi aaya — is par risk judge nahi kar sakte. Dobara record karke ya saaf audio se try karein.',
    }
  }

  let riskBand = 'Low'
  let reason =
    'Transcript me koi risky pattern nahi mila — lekin iska matlab ye guarantee nahi hai ki call safe hai. Hamesha verify karein.'
  if (highlights.some((h) => h.severity === 'high')) {
    riskBand = 'High'
    reason = 'High-risk pattern mila — caller ne OTP, account block, ya payment ka dabav banaya.'
  } else if (highlights.length > 0) {
    riskBand = 'Medium'
    reason = 'Kuch risky signals mile — paise ya urgency ka dabav hai, verify karke hi aage badhein.'
  } else if (advisories.length > 0) {
    reason =
      'Koi risk nahi mila — transcript me safety advisory (jaise OTP share na karne ki salah) hai. Phir bhi ye guarantee nahi hai ki call safe hai.'
  }

  return {
    riskBand,
    highlights,
    advisories,
    safeSteps: SAFE_STEPS,
    disclaimer: DISCLAIMER,
    reason,
  }
}
