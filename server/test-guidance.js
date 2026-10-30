/**
 * CallSuraksha AI — voice guidance tests (Phase 7).
 *
 * Plain Node, no framework: `node server/test-guidance.js`
 * (or `npm run test:guidance` from the app root). Two suites:
 *   1. Guidance scripts — all 4 risk bands x both voices. Each script
 *      must be non-empty, short, mention the band, carry the safe steps,
 *      and contain NO forbidden fraud-verdict phrase.
 *   2. PCM -> WAV — header fields (RIFF/WAVE, 24 kHz, mono, 16-bit),
 *      data size, duration maths, odd-byte trimming.
 * Exit code 0 = all pass, 1 = any failure.
 */

import { buildGuidanceScript, FORBIDDEN_CLAIM_PHRASES, GUIDANCE_VOICES, SAFE_STEPS_HINDI } from './guidance-script.js'
import { pcmDurationSeconds, pcmToWav } from './wav.js'

let passed = 0
let failed = 0
function check(name, ok, extra = '') {
  if (ok) {
    passed += 1
    console.log(`PASS ${name}`)
  } else {
    failed += 1
    console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`)
  }
}

const SAFE_STEPS = [
  'OTP, PIN ya CVV kisi ko kabhi mat batayein — bank ye kabhi phone par nahi mangta.',
  'Bank ko khud uske official number par call karke verify karein — caller ke diye number par nahi.',
  'Shak ho to 1930 par report karein.',
]

function analysisFor(band, highlights = []) {
  return {
    riskBand: band,
    highlights,
    advisories: [],
    safeSteps: SAFE_STEPS,
    disclaimer: 'Ye sirf ek risk flag hai.',
    reason: 'test',
  }
}

const HIGH_ANALYSIS = analysisFor('High', [
  { sentence: 'Apna OTP batao', category: 'OTP_DEMAND', severity: 'high', reason: 'r', precaution: 'p' },
  { sentence: 'Account block ho jayega', category: 'ACCOUNT_BLOCK', severity: 'high', reason: 'r', precaution: 'p' },
])

// --- 1. Guidance scripts ---------------------------------------------------
for (const band of ['High', 'Medium', 'Low', 'Unable to Assess']) {
  for (const voiceKey of ['poorvi', 'nalini']) {
    const analysis = band === 'High' ? HIGH_ANALYSIS : analysisFor(band)
    const out = buildGuidanceScript(analysis, voiceKey)
    const lower = out.script.toLowerCase()
    check(
      `script ${band} x ${voiceKey}: non-empty, short, has safe steps`,
      typeof out.script === 'string' &&
        out.script.length > 40 &&
        out.script.length <= 300 &&
        (voiceKey === 'poorvi'
          ? out.script.includes('OTP, PIN ya CVV kisi ko kabhi mat batayein') &&
            out.script.includes('1930')
          : SAFE_STEPS_HINDI.every((s) => out.script.includes(s))),
      `len=${out.script.length}`,
    )
    check(
      `script ${band} x ${voiceKey}: mentions the band`,
      lower.includes(band.toLowerCase()) ||
        (band === 'Low' && (lower.includes('koi clear risk pattern nahi mila') || out.script.includes('कोई clear risk pattern नहीं मिला'))) ||
        (band === 'Unable to Assess' && (lower.includes('judge nahi kar paye') || out.script.includes('judge नहीं कर पाए'))),
      out.script.slice(0, 120),
    )
    check(
      `script ${band} x ${voiceKey}: no forbidden fraud claim`,
      !FORBIDDEN_CLAIM_PHRASES.some((phrase) => lower.includes(phrase)),
    )
    check(
      `script ${band} x ${voiceKey}: locked model/voice/language`,
      out.model === 'timbre-v2.5' &&
        out.voice === GUIDANCE_VOICES[voiceKey].voice &&
        out.language === GUIDANCE_VOICES[voiceKey].language,
    )
  }
}

// High script must name the detected categories.
const highPoorvi = buildGuidanceScript(HIGH_ANALYSIS, 'poorvi')
check(
  'script High x poorvi: names detected categories',
  highPoorvi.script.includes('OTP') && highPoorvi.script.includes('account block'),
  highPoorvi.script,
)
const highNalini = buildGuidanceScript(HIGH_ANALYSIS, 'nalini')
check(
  'script High x nalini: Devanagari script',
  /[\u0900-\u097F]/.test(highNalini.script),
  highNalini.script.slice(0, 80),
)

// Invalid inputs throw (endpoint answers 400).
for (const [name, bad] of [
  ['missing analysis', null],
  ['bad band', analysisFor('Certain')],
  ['missing highlights', { riskBand: 'High', safeSteps: SAFE_STEPS }],
  ['missing safe steps', { riskBand: 'High', highlights: [] }],
  ['unknown voice', HIGH_ANALYSIS],
]) {
  let threw = false
  try {
    buildGuidanceScript(bad, name === 'unknown voice' ? 'robot' : 'poorvi')
  } catch {
    threw = true
  }
  check(`script validation throws: ${name}`, threw)
}

// --- 2. PCM -> WAV ----------------------------------------------------------
const pcm = Buffer.alloc(48000) // 1 second of 24 kHz 16-bit mono silence
for (let i = 0; i < pcm.length; i += 2) pcm.writeInt16LE(i % 1000, i)
const wav = pcmToWav(pcm)
check('wav: RIFF/WAVE magic', wav.toString('ascii', 0, 4) === 'RIFF' && wav.toString('ascii', 8, 12) === 'WAVE')
check('wav: fmt chunk is PCM 16-bit mono 24 kHz',
  wav.readUInt16LE(20) === 1 &&
    wav.readUInt16LE(22) === 1 &&
    wav.readUInt32LE(24) === 24000 &&
    wav.readUInt16LE(34) === 16)
check('wav: total size = 44 + pcm', wav.length === 44 + pcm.length)
check('wav: data chunk size matches', wav.readUInt32LE(40) === pcm.length)
check('wav: duration 48000 bytes = 1.0 s', pcmDurationSeconds(48000) === 1.0)
check('wav: duration 24000 bytes = 0.5 s', pcmDurationSeconds(24000) === 0.5)
const odd = pcmToWav(Buffer.alloc(48001))
check('wav: odd trailing byte trimmed', odd.length === 44 + 48000)

console.log(`\n${passed}/${passed + failed} passed`)
process.exit(failed === 0 ? 0 : 1)
