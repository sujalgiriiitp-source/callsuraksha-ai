/**
 * CallSuraksha AI — Phase A security tests.
 *
 * Run: `npm run test:security` (or `npm test`).
 * Plain Node, no test runner. Exit 0 = all pass, 1 = any fail.
 *
 * Two parts:
 *   A. Unit tests (no server, no Gnani calls): WAV duration parsing,
 *      the Gnani concurrency semaphore, the analysis receipt store.
 *   B. Live server tests (real server on 127.0.0.1:3111, real Vault
 *      credential, REAL Gnani calls kept to a minimum — 3 Prisma +
 *      2 Timbre in total): the AI_ENABLED gate, the combined 10/15min
 *      per-IP limit, the server-side WAV duration check, the guidance
 *      receipt binding, the 2-call concurrency cap, the emergency
 *      switch. Every other check uses requests that fail validation
 *      BEFORE any Gnani call (400s), so they cost zero credits.
 *
 * Each live group starts a FRESH server process: the rate limiter and
 * the receipt store are in-memory, so a fresh process means fresh
 * counters — exactly like a Render restart.
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAX_AUDIO_DURATION_SECONDS, wavDurationSeconds } from './wav-duration.js'
import {
  activeGnaniCalls,
  MAX_CONCURRENT_GNANI,
  releaseGnaniSlot,
  tryAcquireGnaniSlot,
} from './gnani-slots.js'
import {
  clearAnalysisReceipts,
  getAnalysisReceipt,
  MAX_RECEIPTS,
  receiptCount,
  RECEIPT_TTL_MS,
  storeAnalysisReceipt,
} from './analysis-receipts.js'
import { pcmToWav } from './wav.js'

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_PORT = 3111
const SAMPLE_WAV = path.join(APP_ROOT, 'public/samples/bank-otp.wav')

let passed = 0
let failed = 0
const failures = []
function check(name, cond, detail = '') {
  if (cond) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    failures.push(name)
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Build a silent WAV of `seconds` at 16 kHz mono 16-bit (valid RIFF). */
function makeSilentWav(seconds, sampleRate = 16000) {
  const pcm = Buffer.alloc(Math.round(seconds * sampleRate) * 2)
  return pcmToWav(pcm, { sampleRate, channels: 1, bitsPerSample: 16 })
}

// ---------------------------------------------------------------- A. Unit
console.log('== A. Unit: WAV duration ==')
{
  const wav5 = makeSilentWav(5)
  check('5 s WAV -> 5.0 s', Math.abs((wavDurationSeconds(wav5) ?? -1) - 5) < 0.01)
  const wav30 = makeSilentWav(30)
  check('30 s WAV -> 30.0 s (limit par allowed)', Math.abs((wavDurationSeconds(wav30) ?? -1) - 30) < 0.01)
  const wav305 = makeSilentWav(30.5)
  check('30.5 s WAV -> 30.5 s (limit se upar)', Math.abs((wavDurationSeconds(wav305) ?? -1) - 30.5) < 0.01)
  const wav31 = makeSilentWav(31)
  check('31 s WAV -> 31.0 s', Math.abs((wavDurationSeconds(wav31) ?? -1) - 31) < 0.01)
  check('random bytes -> null', wavDurationSeconds(Buffer.from('hello world, not a wav')) === null)
  check('truncated WAV (<44 bytes) -> null', wavDurationSeconds(Buffer.alloc(20)) === null)
  check(
    '8-bit 8 kHz 10 s WAV -> 10.0 s',
    Math.abs((wavDurationSeconds(pcmToWav(Buffer.alloc(10 * 8000), { sampleRate: 8000, channels: 1, bitsPerSample: 8 })) ?? -1) - 10) < 0.01,
  )
  // WAV with an extra LIST chunk before 'data' — the walker must skip it.
  const base = makeSilentWav(5)
  const listChunk = Buffer.concat([
    Buffer.from('LIST', 'ascii'),
    Buffer.from([4, 0, 0, 0]),
    Buffer.from('INFO', 'ascii'),
  ])
  const withList = Buffer.concat([base.subarray(0, 36), listChunk, base.subarray(36)])
  withList.writeUInt32LE(withList.readUInt32LE(4) + listChunk.length, 4)
  check('extra LIST chunk ke saath bhi duration sahi', Math.abs((wavDurationSeconds(withList) ?? -1) - 5) < 0.01)
  check('MAX_AUDIO_DURATION_SECONDS is 30', MAX_AUDIO_DURATION_SECONDS === 30)
}

console.log('== A. Unit: concurrency semaphore ==')
{
  check('MAX_CONCURRENT_GNANI is 2', MAX_CONCURRENT_GNANI === 2)
  check('slot 1 acquire -> true', tryAcquireGnaniSlot() === true)
  check('slot 2 acquire -> true', tryAcquireGnaniSlot() === true)
  check('slot 3 acquire -> false (cap)', tryAcquireGnaniSlot() === false)
  check('active count is 2', activeGnaniCalls() === 2)
  releaseGnaniSlot()
  check('release ke baad active 1', activeGnaniCalls() === 1)
  check('release ke baad acquire -> true', tryAcquireGnaniSlot() === true)
  releaseGnaniSlot()
  releaseGnaniSlot()
  releaseGnaniSlot()
  check('release kabhi 0 se neeche nahi jata', activeGnaniCalls() === 0)
}

console.log('== A. Unit: analysis receipts ==')
{
  clearAnalysisReceipts()
  const fake = { riskBand: 'High', highlights: [], safeSteps: ['step'] }
  storeAnalysisReceipt('req-1', fake)
  check('stored receipt milta hai', getAnalysisReceipt('req-1') === fake)
  check('unknown id -> null', getAnalysisReceipt('nope') === null)
  check('null id -> null', getAnalysisReceipt(null) === null)
  check('number id -> null', getAnalysisReceipt(123) === null)
  storeAnalysisReceipt('req-expire', fake, 50)
  await sleep(90)
  check('expired receipt -> null', getAnalysisReceipt('req-expire') === null)
  clearAnalysisReceipts()
  for (let i = 0; i < MAX_RECEIPTS + 1; i += 1) storeAnalysisReceipt(`req-${i}`, fake)
  check(`cap par count ${MAX_RECEIPTS} hi rehta hai`, receiptCount() === MAX_RECEIPTS)
  check('cap par sabse purana evict hota hai', getAnalysisReceipt('req-0') === null)
  check('cap par naya wala milta hai', getAnalysisReceipt(`req-${MAX_RECEIPTS}`) === fake)
  check('RECEIPT_TTL_MS is 10 min', RECEIPT_TTL_MS === 10 * 60 * 1000)
  clearAnalysisReceipts()
}

// ------------------------------------------------------- B. Live server
let currentChild = null

async function startServer(aiEnabledValue) {
  const env = { ...process.env, PORT: String(TEST_PORT) }
  if (aiEnabledValue === undefined) delete env.AI_ENABLED
  else env.AI_ENABLED = aiEnabledValue
  const child = spawn('node', ['server/index.js'], {
    cwd: APP_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  currentChild = child
  let output = ''
  child.stdout.on('data', (d) => {
    output += d.toString()
  })
  child.stderr.on('data', (d) => {
    output += d.toString()
  })
  const base = `http://127.0.0.1:${TEST_PORT}`
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return { child, base, getLog: () => output }
    } catch {
      // not up yet
    }
    await sleep(300)
  }
  throw new Error(`server did not start on port ${TEST_PORT}. Log:\n${output}`)
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(5000).then(() => {
      child.kill('SIGKILL')
    }),
  ])
  if (currentChild === child) currentChild = null
}

async function postTranscribe(base, { fileBuffer, fileName, language = 'hi-IN' } = {}) {
  const form = new FormData()
  if (fileBuffer) {
    form.append('audio_file', new Blob([fileBuffer], { type: 'audio/wav' }), fileName)
  }
  form.append('language_code', language)
  form.append('model', 'prisma-v3.0')
  const res = await fetch(`${base}/api/transcribe`, { method: 'POST', body: form })
  const data = await res.json().catch(() => null)
  return { status: res.status, data, headers: res.headers }
}

async function postGuidance(base, body) {
  const res = await fetch(`${base}/api/guidance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data, headers: res.headers }
}

try {
  // ------------------------------------------------- B1. AI_ENABLED gate
  console.log('== B1. Live: AI_ENABLED gate (missing/invalid -> 503, true -> open) ==')
  for (const [label, value, expectStatus, expectError] of [
    ['missing', undefined, 503, 'AI_DISABLED'],
    ["'false'", 'false', 503, 'AI_DISABLED'],
    ["'TRUE' (uppercase)", 'TRUE', 503, 'AI_DISABLED'],
    ["'1'", '1', 503, 'AI_DISABLED'],
    ["'true'", 'true', 400, 'NO_FILE'],
  ]) {
    const { child, base } = await startServer(value)
    try {
      const r = await postTranscribe(base, {})
      check(
        `AI_ENABLED ${label} -> ${expectStatus} ${expectError}`,
        r.status === expectStatus && r.data?.error === expectError,
        `got ${r.status} ${r.data?.error ?? ''}`,
      )
      if (value === 'false') {
        const g = await postGuidance(base, {})
        check(
          "AI_ENABLED 'false' par guidance bhi 503 AI_DISABLED",
          g.status === 503 && g.data?.error === 'AI_DISABLED',
          `got ${g.status} ${g.data?.error ?? ''}`,
        )
        const h = await fetch(`${base}/api/health`)
        check('AI band hone par bhi /api/health 200 deta hai', h.status === 200)
      }
    } finally {
      await stopServer(child)
    }
  }

  // --------------------------------------- B2. Combined 10/15min limit
  console.log('== B2. Live: combined limit — transcribe + guidance ek hi bucket ==')
  {
    const { child, base } = await startServer('true')
    try {
      const results = []
      for (let i = 0; i < 6; i += 1) {
        const r = await postTranscribe(base, {})
        results.push(r.status)
      }
      for (let i = 0; i < 4; i += 1) {
        const r = await postGuidance(base, { request_id: 'does-not-exist' })
        results.push(r.status)
      }
      check(
        'pehle 10 requests (6 transcribe + 4 guidance) 400 hain, 429 nahi',
        results.every((s) => s === 400),
        `got [${results.join(', ')}]`,
      )
      const r11 = await postTranscribe(base, {})
      check(
        '11th request -> 429 RATE_LIMITED',
        r11.status === 429 && r11.data?.error === 'RATE_LIMITED',
        `got ${r11.status} ${r11.data?.error ?? ''}`,
      )
      check(
        '429 response me ratelimit header hai',
        typeof r11.headers.get('ratelimit') === 'string' && r11.headers.get('ratelimit').length > 0,
        `header: ${r11.headers.get('ratelimit')}`,
      )
      const r12 = await postGuidance(base, { request_id: 'does-not-exist' })
      check('12th request (dusre endpoint se) bhi 429 — bucket combined hai', r12.status === 429)
    } finally {
      await stopServer(child)
    }
  }

  // --------------------------- B3. WAV duration + guidance binding (1 server)
  console.log('== B3. Live: WAV duration check + guidance receipt binding ==')
  {
    const { child, base, getLog } = await startServer('true')
    try {
      const wav31 = makeSilentWav(31)
      const tooLong = await postTranscribe(base, { fileBuffer: wav31, fileName: 'long.wav' })
      check(
        '31 s WAV -> 400 AUDIO_TOO_LONG',
        tooLong.status === 400 && tooLong.data?.error === 'AUDIO_TOO_LONG',
        `got ${tooLong.status} ${tooLong.data?.error ?? ''}`,
      )
      check(
        '31 s WAV par Gnani ko koi call nahi gayi (log me no transcribe-ok)',
        !getLog().includes('[transcribe] ok'),
        'log me [transcribe] ok mila',
      )

      // Positive path: real transcribe of the demo sample (1 real Prisma call).
      const sample = fs.readFileSync(SAMPLE_WAV)
      const ok = await postTranscribe(base, { fileBuffer: sample, fileName: 'bank-otp.wav' })
      check(
        'bank-otp.wav (15.68 s) -> 200 real transcript',
        ok.status === 200 && typeof ok.data?.transcript === 'string' && ok.data.transcript.length > 0,
        `got ${ok.status}`,
      )
      const requestId = ok.data?.request_id
      check('transcribe response me real request_id hai', typeof requestId === 'string' && requestId.length > 0)

      const noId = await postGuidance(base, {})
      check(
        'guidance bina request_id -> 400 INVALID_REQUEST',
        noId.status === 400 && noId.data?.error === 'INVALID_REQUEST',
        `got ${noId.status} ${noId.data?.error ?? ''}`,
      )
      const forged = await postGuidance(base, { request_id: 'forged-id-12345', voice: 'poorvi' })
      check(
        'guidance forged request_id -> 400 INVALID_REQUEST',
        forged.status === 400 && forged.data?.error === 'INVALID_REQUEST',
        `got ${forged.status} ${forged.data?.error ?? ''}`,
      )
      const oldFormat = await postGuidance(base, {
        analysis: { riskBand: 'High', highlights: [{ category: 'OTP_DEMAND' }], safeSteps: ['x'] },
        voice: 'poorvi',
      })
      check(
        'guidance purana format (client analysis) -> 400, analysis ignore hoti hai',
        oldFormat.status === 400 && oldFormat.data?.error === 'INVALID_REQUEST',
        `got ${oldFormat.status} ${oldFormat.data?.error ?? ''}`,
      )

      // Real TTS via the receipt (1 real Timbre call), then voice switch
      // on the SAME receipt (2nd real Timbre call) — receipt multi-use hai.
      const g1 = await postGuidance(base, { request_id: requestId, voice: 'poorvi' })
      check(
        'guidance valid request_id (Poorvi) -> 200 real WAV audio',
        g1.status === 200 && typeof g1.data?.audioBase64 === 'string' && g1.data.audioBase64.length > 0,
        `got ${g1.status}`,
      )
      if (g1.status === 200 && g1.data?.audioBase64) {
        const wav = Buffer.from(g1.data.audioBase64, 'base64')
        check(
          'guidance audio asli WAV hai (RIFF/WAVE header)',
          wav.toString('ascii', 0, 4) === 'RIFF' && wav.toString('ascii', 8, 12) === 'WAVE',
        )
        check('guidance duration > 0 s', typeof g1.data.durationSeconds === 'number' && g1.data.durationSeconds > 0)
      }
      const g2 = await postGuidance(base, { request_id: requestId, voice: 'nalini' })
      check(
        'voice switch (Nalini) same request_id se -> 200 (receipt multi-use)',
        g2.status === 200 && typeof g2.data?.audioBase64 === 'string',
        `got ${g2.status} ${g2.data?.error ?? ''}`,
      )
    } finally {
      await stopServer(child)
    }
  }

  // ------------------------------------------- B4. Concurrency cap (live)
  // NOTE (verified 31 Oct 2026): Gnani's OWN unpublished rate limit can
  // 429 one of two concurrent calls (error `gnani_error`, NOT our
  // `RATE_LIMITED`) — the Phase 7 lesson, which is why /compare runs
  // sequentially. So this group asserts what OUR cap guarantees: exactly
  // one 503 SERVER_BUSY, at most two Gnani attempts, slots released
  // afterwards. It does NOT assume both slot-holders succeed at Gnani.
  console.log('== B4. Live: max 2 concurrent Gnani calls ==')
  {
    const { child, base, getLog } = await startServer('true')
    try {
      const sample = fs.readFileSync(SAMPLE_WAV)
      const three = await Promise.all([
        postTranscribe(base, { fileBuffer: sample, fileName: 'bank-otp.wav' }),
        postTranscribe(base, { fileBuffer: sample, fileName: 'bank-otp.wav' }),
        postTranscribe(base, { fileBuffer: sample, fileName: 'bank-otp.wav' }),
      ])
      const busy = three.filter((r) => r.status === 503)
      check(
        '3 parallel transcribes -> exactly 1x 503 SERVER_BUSY (slot cap)',
        busy.length === 1 && busy[0].data?.error === 'SERVER_BUSY',
        `got [${three.map((r) => `${r.status}:${r.data?.error ?? ''}`).join(', ')}]`,
      )
      const others = three.filter((r) => r.status !== 503)
      check(
        'baaki 2 requests Gnani tak pahunche (200 ya Gnani-side 429, hamara 429 nahi)',
        others.length === 2 &&
          others.every(
            (r) => r.status === 200 || (r.status === 429 && r.data?.error !== 'RATE_LIMITED'),
          ),
        `got [${others.map((r) => `${r.status}:${r.data?.error ?? ''}`).join(', ')}]`,
      )
      const log = getLog()
      const gnaniAttempts =
        (log.match(/\[transcribe\] ok/g) || []).length +
        (log.match(/\[transcribe\] fail status=429/g) || []).length
      check(
        'Gnani ko zyada se zyada 2 calls gayi (cap se zyada nahi)',
        gnaniAttempts <= 2,
        `log me ${gnaniAttempts} Gnani attempts`,
      )
      check(
        'log me exactly 1 server_busy line hai',
        (log.match(/\[transcribe\] fail status=503 server_busy/g) || []).length === 1,
      )
      // Slot release check: agla call slot paana chahiye (503 SERVER_BUSY
      // nahi aana chahiye) — Gnani 200 de ya apna 429, dono ka matlab hai
      // slot free tha aur request Gnani tak pahunchi.
      const after = await postTranscribe(base, { fileBuffer: sample, fileName: 'bank-otp.wav' })
      check(
        'slots free hone ke baad agla call SERVER_BUSY nahi deta',
        !(after.status === 503 && after.data?.error === 'SERVER_BUSY'),
        `got ${after.status} ${after.data?.error ?? ''}`,
      )
    } finally {
      await stopServer(child)
    }
  }
} catch (err) {
  failed += 1
  failures.push(`crashed: ${err.message}`)
  console.log(`  FAIL  test crashed — ${err.message}`)
  if (currentChild) await stopServer(currentChild)
}

console.log(`\n==== Security tests: ${passed} passed, ${failed} failed ====`)
if (failures.length) console.log('Failures:', failures.join(' | '))
console.log('Real Gnani usage in this run: ~3 Prisma + 2 Timbre calls (baaki sab 400/429/503, zero credit).')
process.exit(failed ? 1 : 0)
