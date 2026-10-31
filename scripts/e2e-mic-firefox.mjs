/**
 * CallSuraksha AI — Firefox mic flow (Phase 3, autonomous testing).
 *
 * Same desktop fake-mic flow as scripts/e2e-mic.mjs, but on Firefox
 * (playwright firefox-1555) with the fake media device enabled via
 * Firefox prefs (media.navigator.streams.fake + permission disabled).
 * Firefox's fake device produces a TONE, not speech — so the fake-mic
 * flow honestly expects Unable to Assess / Low Risk, exactly like the
 * Chromium run. Real-speech WebM conversion is tested the same way as
 * in e2e-mic.mjs (in-browser decode + resample, then real Prisma).
 *
 * Usage (dev servers must be running first):
 *   AI_ENABLED=true npm run server &
 *   npm run dev -- --port 5173 --host 127.0.0.1 &
 *   node scripts/e2e-mic-firefox.mjs
 * Real Gnani usage: 2 Prisma + 1 Timbre (desktop flow + webm test).
 * Exit code 0 = all checks pass, 1 = any failure.
 */
import { firefox } from 'playwright-core'
import fs from 'node:fs'

const APP = 'http://127.0.0.1:5173'
const API = 'http://127.0.0.1:3001'
const WEBM = '/home/hatch/workspace/gnani-ai-challenge/api-tests/bank-otp-speech.webm'
const SHOTS = '/home/hatch/workspace/gnani-ai-challenge/ui-verification/phase11-mic-firefox'

const checks = []
function check(name, ok, extra = '') {
  checks.push({ name, ok, extra })
  console.log(`${ok ? '  PASS' : '  FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await firefox.launch({
    firefoxUserPrefs: {
      'media.navigator.streams.fake': true,
      'media.navigator.permission.disabled': true,
    },
  })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  console.log('\n== Firefox desktop: fake-mic full flow ==')
  await page.goto(`${APP}/analyze`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.getByRole('tab', { name: 'Record Audio' }).click()
  await page.getByRole('button', { name: /start recording/i }).click()
  await page.waitForSelector('text=Recording…', { timeout: 15000 })
  await sleep(4000)
  await page.getByRole('button', { name: 'Recording roko' }).click()
  await page.waitForSelector('[data-testid="recording-convert-note"]', { timeout: 30000 })
  const note = (await page.getByTestId('recording-convert-note').innerText()).trim()
  check('Firefox: conversion note shows 16 kHz mono WAV', /16 kHz mono WAV/.test(note), note)
  const card = await page.evaluate(() => document.body.innerText)
  check('Firefox: selected format is WAV', /Format\s+WAV/.test(card))
  check(
    'Firefox: converted-WAV preview player exists',
    (await page.locator('audio[aria-label="Recording preview"]').count()) > 0,
  )
  await page.screenshot({ path: `${SHOTS}/mic-analyze-desktop.png`, fullPage: true })
  await page.selectOption('#analyze-language', 'hi-IN,en-IN')
  await page.getByRole('checkbox', { name: /Main confirm karta/ }).check()
  await page.getByRole('button', { name: /Analyze with AI/ }).click()
  await page.waitForURL('**/results', { timeout: 60000 })
  await page.waitForFunction(() => /Analyzed on/.test(document.body.innerText), { timeout: 15000 })
  const resText = await page.evaluate(() => document.body.innerText)
  check('Firefox: Results loads with real data', /Analyzed on/.test(resText))
  check(
    'Firefox: a real risk band is shown (no fake score)',
    /High Risk|Medium Risk|Low Risk|Unable to Assess/.test(resText),
  )
  check(
    'Firefox: tone audio honestly yields Unable to Assess (not a fake verdict)',
    /Unable to Assess/.test(resText) || /Low Risk/.test(resText),
  )
  await page.waitForSelector('[data-testid="guidance-status"]', { timeout: 30000 })
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="guidance-status"]')
      return el !== null && !/ban rahi hai/.test(el.innerText)
    },
    { timeout: 30000 },
  )
  const gText = (await page.getByTestId('guidance-status').innerText()).trim()
  check(
    'Firefox: Timbre guidance ready, or honest text fallback with safe steps',
    /Guidance taiyaar hai/.test(gText) || /1930/.test(gText),
    gText.slice(0, 80),
  )
  await page.screenshot({ path: `${SHOTS}/mic-results-desktop.png`, fullPage: true })
  await ctx.close()

  // ---- Real-speech WebM conversion (in the browser) + real Prisma ----
  console.log('\n== Firefox: real-speech WebM -> 16 kHz WAV (browser) + real Prisma ==')
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page2 = await ctx2.newPage()
  await page2.goto(`${APP}/analyze`, { waitUntil: 'networkidle', timeout: 120000 })
  const webmB64 = fs.readFileSync(WEBM).toString('base64')
  const converted = await page2.evaluate(async (b64) => {
    const { convertRecordingToWav } = await import('/src/lib/audio-convert.ts')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes.buffer], { type: 'audio/webm' })
    const out = await convertRecordingToWav(blob)
    const wavBytes = new Uint8Array(await out.wavBlob.arrayBuffer())
    let b = ''
    for (let i = 0; i < wavBytes.length; i += 8192) {
      b += String.fromCharCode.apply(null, wavBytes.subarray(i, i + 8192))
    }
    return {
      durationSeconds: out.durationSeconds,
      sampleRate: out.sampleRate,
      channels: out.channels,
      size: out.wavBlob.size,
      wavBase64: btoa(b),
    }
  }, webmB64)
  check('Firefox speech webm: converted sample rate is 16000', converted.sampleRate === 16000, `got ${converted.sampleRate}`)
  check('Firefox speech webm: converted channels is 1 (mono)', converted.channels === 1, `got ${converted.channels}`)
  check(
    'Firefox speech webm: duration ~15.69 s (same speech, resampled)',
    Math.abs(converted.durationSeconds - 15.69) < 1.0,
    `got ${converted.durationSeconds.toFixed(2)} s`,
  )
  const wavBuf = Buffer.from(converted.wavBase64, 'base64')
  check('Firefox converted WAV: RIFF/WAVE header', wavBuf.toString('ascii', 0, 4) === 'RIFF' && wavBuf.toString('ascii', 8, 12) === 'WAVE')
  check('Firefox converted WAV: 16-bit PCM, mono, 16000 Hz', wavBuf.readUInt16LE(20) === 1 && wavBuf.readUInt16LE(22) === 1 && wavBuf.readUInt32LE(24) === 16000 && wavBuf.readUInt16LE(34) === 16)
  const form = new FormData()
  form.append('audio_file', new Blob([wavBuf], { type: 'audio/wav' }), 'recording.wav')
  form.append('language_code', 'hi-IN,en-IN')
  form.append('model', 'prisma-v3.0')
  const res = await fetch(`${API}/api/transcribe`, { method: 'POST', body: form })
  const data = await res.json().catch(() => null)
  check('Firefox converted WAV: Prisma accepts it (HTTP 200)', res.status === 200, `got ${res.status}`)
  check(
    'Firefox converted WAV: transcript has the OTP speech (same as clean WAV)',
    typeof data?.transcript === 'string' && /OTP/i.test(data.transcript),
    `transcript: ${(data?.transcript ?? '').slice(0, 80)}`,
  )
  check(
    'Firefox converted WAV: risk engine says High (same as clean WAV)',
    data?.analysis?.riskBand === 'High',
    `got ${data?.analysis?.riskBand ?? 'none'}`,
  )
  await ctx2.close()
  await browser.close()

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n==== Firefox Mic E2E: ${passed} passed, ${failed.length} failed ====`)
  if (failed.length) console.log('Failures:', failed.map((f) => f.name).join(' | '))
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('Firefox Mic E2E crashed:', e.message)
  process.exit(2)
})
