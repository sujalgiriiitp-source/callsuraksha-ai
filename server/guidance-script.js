/**
 * CallSuraksha AI — voice guidance script builder (Phase 7).
 *
 * Pure and deterministic. The spoken script is built ONLY from the real
 * Phase 5 risk analysis (band, detected categories, safe steps) — nothing
 * is invented. It never claims fraud: the wording is always "risk lag rahi
 * hai / signals mile hain", never "ye fraud hai / scam hai".
 *
 * Two voices, both verified working on Timbre v2.5:
 *   poorvi — Hinglish script (hi-en), Roman text
 *   nalini — Hindi script (hi-IN), Devanagari text
 *
 * The script is deliberately SHORT (opening + the two most important
 * precautions). Timbre v2.5 speaks slowly (~2 words/sec), so the full
 * three safe steps would make a ~40 s clip; the full steps are already
 * shown on the dashboard in the "Recommended safe actions" card.
 *
 * The Hindi safe steps are the same advice as the engine's Hinglish safe
 * steps, translated into Devanagari — not new claims.
 */

export const GUIDANCE_VOICES = {
  poorvi: { voice: 'Poorvi', model: 'timbre-v2.5', language: 'hi-en', label: 'Hinglish · Poorvi' },
  nalini: { voice: 'Nalini', model: 'timbre-v2.5', language: 'hi-IN', label: 'Hindi · Nalini' },
}

export const VALID_BANDS = ['Low', 'Medium', 'High', 'Unable to Assess']

// Phrases a guidance script must NEVER contain (fraud verdicts / guarantees).
export const FORBIDDEN_CLAIM_PHRASES = [
  'fraud hai',
  'scam hai',
  'dhokha hai',
  'dhokhadhadi hai',
  'confirmed',
  'pakka',
  'guaranteed',
  '100%',
  'fraud call hai',
  'scam call hai',
]

const CATEGORY_LABELS_HINGLISH = {
  OTP_DEMAND: 'OTP maanga gaya',
  ACCOUNT_BLOCK: 'account block karne ki dhamki',
  DIGITAL_ARREST: 'digital arrest ki dhamki',
  PAYMENT_PRESSURE: 'payment link ya UPI ka dabav',
  PERSONAL_DETAILS: 'personal details maangi gayi',
  IMPERSONATION: 'bank ya authority hone ka daava',
  MONEY_TRANSFER: 'paise bhejne ko kaha gaya',
  URGENCY: 'jaldi karne ka dabav',
}

const CATEGORY_LABELS_HINDI = {
  OTP_DEMAND: 'OTP माँगा गया',
  ACCOUNT_BLOCK: 'account block करने की धमकी',
  DIGITAL_ARREST: 'digital arrest की धमकी',
  PAYMENT_PRESSURE: 'payment link या UPI का दबाव',
  PERSONAL_DETAILS: 'व्यक्तिगत जानकारी माँगी गई',
  IMPERSONATION: 'bank या authority होने का दावा',
  MONEY_TRANSFER: 'पैसे भेजने को कहा गया',
  URGENCY: 'जल्दी करने का दबाव',
}

export const SAFE_STEPS_HINDI = [
  'OTP, PIN या CVV किसी को कभी न बताएं।',
  'शक हो तो 1930 पर report करें।',
]

// Short spoken precautions (the two most important safe steps, shortened
// for speech). The full safe steps stay visible on the dashboard.
const SPOKEN_STEPS_HINGLISH = 'OTP, PIN ya CVV kisi ko kabhi mat batayein. Shak ho to 1930 par report karein.'
const SPOKEN_STEPS_HINDI = 'OTP, PIN या CVV किसी को कभी न बताएं। शक हो तो 1930 पर report करें।'

function topCategories(analysis, labels) {
  const seen = []
  for (const h of analysis.highlights ?? []) {
    const label = labels[h.category] ?? h.category
    if (!seen.includes(label)) seen.push(label)
  }
  return seen.slice(0, 2)
}

function joinLabels(labels, connector = 'aur') {
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels[0]} ${connector} ${labels[1]}`
}

/**
 * Build the spoken guidance script from a real risk analysis.
 * Returns { script, voice, model, language, label }.
 * Throws on an invalid analysis so the endpoint can answer 400.
 */
export function buildGuidanceScript(analysis, voiceKey = 'poorvi') {
  const voiceConfig = GUIDANCE_VOICES[voiceKey]
  if (!voiceConfig) throw new Error(`Unknown voice: ${voiceKey}`)
  if (!analysis || typeof analysis !== 'object') throw new Error('Analysis missing')
  if (!VALID_BANDS.includes(analysis.riskBand)) throw new Error('Invalid risk band')
  if (!Array.isArray(analysis.highlights)) throw new Error('Highlights missing')
  const safeSteps = Array.isArray(analysis.safeSteps) ? analysis.safeSteps : []
  if (safeSteps.length === 0) throw new Error('Safe steps missing')

  const band = analysis.riskBand
  if (voiceKey === 'nalini') {
    const labels = topCategories(analysis, CATEGORY_LABELS_HINDI)
    const steps = SPOKEN_STEPS_HINDI
    let opening
    if (band === 'High') {
      opening = `सावधान! यह कॉल high risk लग रही है।${labels.length ? ` इसमें ${joinLabels(labels, 'और')} जैसे संकेत मिले हैं।` : ''}`
    } else if (band === 'Medium') {
      opening = `ध्यान दें! यह कॉल medium risk लग रही है।${labels.length ? ` इसमें ${joinLabels(labels, 'और')} मिले हैं।` : ''}`
    } else if (band === 'Low') {
      opening = 'इस कॉल में कोई clear risk pattern नहीं मिला। लेकिन इसका मतलब यह guarantee नहीं है कि call safe है।'
    } else {
      opening = 'इस कॉल का risk judge नहीं कर पाए, क्योंकि evidence कम था। इसका मतलब यह नहीं है कि call safe थी।'
    }
    return { script: `${opening} ${steps}`, ...voiceConfig }
  }

  // Hinglish (Poorvi, hi-en) — default.
  const labels = topCategories(analysis, CATEGORY_LABELS_HINGLISH)
  const steps = SPOKEN_STEPS_HINGLISH
  let opening
  if (band === 'High') {
    opening = `Savdhaan! Ye call high risk lag rahi hai.${labels.length ? ` Isme ${joinLabels(labels)} jaise signals mile hain.` : ''}`
  } else if (band === 'Medium') {
    opening = `Dhyaan dein! Ye call medium risk lag rahi hai.${labels.length ? ` Isme ${joinLabels(labels)} mile hain.` : ''}`
  } else if (band === 'Low') {
    opening = 'Is call me koi clear risk pattern nahi mila. Lekin iska matlab ye guarantee nahi hai ki call safe hai.'
  } else {
    opening = 'Is call ka risk judge nahi kar paye, kyunki evidence kam tha. Iska matlab ye nahi hai ki call safe thi.'
  }
  return { script: `${opening} ${steps}`, ...voiceConfig }
}
