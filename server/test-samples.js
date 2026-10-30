/**
 * CallSuraksha AI — demo sample + comparison asset tests (Phase 8).
 *
 * Plain Node, no framework: `node server/test-samples.js`
 * (or `npm run test:samples` from the app root).
 * Verifies the generated assets, not the frontend:
 *   - samples manifest: 6 samples, every WAV exists, duration <= 30 s,
 *     size <= 5 MB, sha256 matches the file on disk.
 *   - compare manifest: clean + noisy files exist, same duration,
 *     measured SNR is a real number in a sane range.
 *   - each sample SCRIPT, run through the real risk engine, yields the
 *     intended band (a sanity check that the scenarios are what they
 *     claim — the live Prisma transcript is verified separately by the
 *     E2E test and the Phase 8 report).
 * Exit code 0 = all pass, 1 = any failure.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeTranscript } from './risk-engine.js'

const ROOT = new URL('..', import.meta.url).pathname
const SAMPLES_DIR = join(ROOT, 'public', 'samples')
const COMPARE_DIR = join(ROOT, 'public', 'compare')

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

// Expected bands for each sample script (from the Phase 8 design).
const EXPECTED_BANDS = {
  'bank-otp': 'High',
  'upi-payment': 'High',
  'kyc-pressure': 'High',
  'customer-care': 'Medium',
  'otp-advisory': 'Low',
  'normal-info': 'Low',
}

const manifest = JSON.parse(readFileSync(join(SAMPLES_DIR, 'manifest.json'), 'utf8'))
check('samples manifest: 6 samples', Array.isArray(manifest.samples) && manifest.samples.length === 6, `got ${manifest.samples?.length}`)
for (const sample of manifest.samples ?? []) {
  const path = join(SAMPLES_DIR, `${sample.id}.wav`)
  check(`sample ${sample.id}: WAV exists`, existsSync(path))
  if (!existsSync(path)) continue
  const stat = statSync(path)
  check(`sample ${sample.id}: size <= 5 MB`, stat.size <= 5 * 1024 * 1024, `${stat.size} bytes`)
  check(`sample ${sample.id}: manifest bytes match file`, sample.bytes === stat.size)
  check(
    `sample ${sample.id}: sha256 matches file`,
    createHash('sha256').update(readFileSync(path)).digest('hex') === sample.sha256,
  )
  check(`sample ${sample.id}: duration <= 30 s`, sample.durationSeconds <= 30, `${sample.durationSeconds}s`)
  check(`sample ${sample.id}: duration > 5 s (real audio)`, sample.durationSeconds > 5, `${sample.durationSeconds}s`)
  // Script -> real risk engine -> intended band.
  const result = analyzeTranscript(sample.script)
  check(
    `sample ${sample.id}: script yields ${EXPECTED_BANDS[sample.id]} band`,
    result.riskBand === EXPECTED_BANDS[sample.id],
    `got ${result.riskBand} [${result.highlights.map((h) => h.category).join(',') || 'none'}]`,
  )
  // The advisory sample must record the safety warning as an advisory.
  if (sample.id === 'otp-advisory') {
    check(
      'sample otp-advisory: safety warning recorded as advisory (Devanagari negation)',
      result.advisories.length > 0,
      `advisories=${JSON.stringify(result.advisories)}`,
    )
  }
}

const compare = JSON.parse(readFileSync(join(COMPARE_DIR, 'manifest.json'), 'utf8'))
const cleanPath = join(ROOT, 'public', compare.clean.file)
const noisyPath = join(ROOT, 'public', compare.noisy.file)
check('compare: clean file exists', existsSync(cleanPath))
check('compare: noisy file exists', existsSync(noisyPath))
check(
  'compare: clean and noisy have the same duration',
  compare.clean.durationSeconds === compare.noisy.durationSeconds,
  `${compare.clean.durationSeconds}s vs ${compare.noisy.durationSeconds}s`,
)
check(
  'compare: measured SNR is a real number between 5 and 30 dB',
  typeof compare.noise.measuredSnrDb === 'number' &&
    compare.noise.measuredSnrDb >= 5 &&
    compare.noise.measuredSnrDb <= 30,
  `SNR=${compare.noise.measuredSnrDb}`,
)
check(
  'compare: reference transcript is non-empty',
  typeof compare.referenceTranscript === 'string' && compare.referenceTranscript.length > 20,
)
check(
  'compare: important phrases listed',
  Array.isArray(compare.importantPhrases) && compare.importantPhrases.length >= 2,
)
check(
  'compare: noisy sha256 matches file',
  existsSync(noisyPath) &&
    createHash('sha256').update(readFileSync(noisyPath)).digest('hex') === compare.noisy.sha256,
)

console.log(`\n${passed}/${passed + failed} passed`)
process.exit(failed === 0 ? 0 : 1)
