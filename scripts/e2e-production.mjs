/**
 * CallSuraksha AI — Production QA E2E (Phase 10, Task F).
 *
 * Runs against the PRODUCTION server: `NODE_ENV=production npm start`
 * (single-service mode — Express serves dist/ + /api from one origin).
 * Start the server first on http://localhost:3001, then run:
 *   node scripts/e2e-production.mjs
 * The script does NOT start or stop the server.
 *
 * Covers the 12 production QA areas with REAL Gnani calls (minimal:
 * 3 Prisma + 1 Timbre in the desktop flow, 1 Prisma in the mobile flow):
 *   1 Home Dashboard, 2 Audio Upload, 3 Microphone Recording,
 *   4 Prisma Transcription, 5 Risk Engine, 6 Analysis Results,
 *   7 Timbre Voice Guidance, 8 Demo Samples, 9 Clean vs Noisy,
 *   10 How It Works, 11 About, 12 Mobile Navigation.
 * Plus production-specific checks: SPA fallback on direct loads,
 * static WAV serving, security headers, rate-limit headers.
 */
import { chromium } from 'playwright-core'

const APP = process.env.PROD_URL || 'http://localhost:3001'
const EXE =
  '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'

let passed = 0
let failed = 0
const failures = []
function check(name, ok, extra = '') {
  if (ok) {
    passed++
    console.log(`  PASS ${name}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  FAIL ${name} ${extra}`)
  }
}

const browser = await chromium.launch({ executablePath: EXE })

async function main() {
  // ---- Production-specific: direct loads (SPA fallback, no Vite) ----
  console.log('\n== production: direct loads + static assets ==')
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  for (const route of ['/', '/demo', '/analyze', '/results', '/how-it-works', '/about', '/guidance', '/compare']) {
    const res = await page.goto(APP + route, { waitUntil: 'domcontentloaded' })
    check(`direct load ${route} -> ${res.status()}`, res.status() === 200)
  }
  const wav = await page.request.get(APP + '/samples/bank-otp.wav')
  check('static WAV served (bank-otp.wav)', wav.status() === 200 && (wav.headers()['content-type'] || '').includes('audio'))
  const manifest = await page.request.get(APP + '/samples/manifest.json')
  check('static manifest served', manifest.status() === 200)
  const health = await page.request.get(APP + '/api/health')
  const healthJson = await health.json()
  check('health ok + key configured', health.status() === 200 && healthJson.gnaniKeyConfigured === true, JSON.stringify(healthJson))
  const h = await page.request.get(APP + '/')
  check('security headers (nosniff + DENY)', (h.headers()['x-content-type-options'] || '') === 'nosniff' && (h.headers()['x-frame-options'] || '') === 'DENY')
  check('no CORS header by default (same-origin)', !('access-control-allow-origin' in h.headers()))
  check('no X-Powered-By header', !('x-powered-by' in h.headers()))
  const api404 = await page.request.get(APP + '/api/nope')
  check('unknown /api route -> JSON 404', api404.status() === 404 && (await api404.json()).error === 'NOT_FOUND')

  // ---- 1. Home Dashboard ----
  console.log('\n== 1. Home Dashboard ==')
  await page.goto(APP + '/', { waitUntil: 'networkidle' })
  const homeText = await page.evaluate(() => document.body.innerText)
  check('Home: hero present', /Call Suno, Risk Samjho/.test(homeText))
  check('Home: REAL status (Gnani connected)', /Server online · Gnani connected/.test(homeText))
  check('Home: no fake scores', !/\b\d{2}\/100\b/.test(homeText))

  // ---- 2. Audio Upload (validation only — the real transcribe runs in §4/§8) ----
  console.log('\n== 2. Audio Upload ==')
  await page.goto(APP + '/analyze', { waitUntil: 'networkidle' })
  const analyzeBtn = page.getByRole('button', { name: /Analyze with AI/ })
  check('Analyze disabled with no file', (await analyzeBtn.isEnabled()) === false)
  await page.setInputFiles('input[type="file"]', '/home/hatch/workspace/gnani-ai-challenge/api-tests/timbre-poorvi-hi-en-24k.wav')
  await page.waitForTimeout(1200)
  const upText = await page.evaluate(() => document.body.innerText)
  check('upload shows real duration', /0:1[12]/.test(upText))

  // ---- 3. Microphone Recording (fake device) ----
  console.log('\n== 3. Microphone Recording ==')
  // Full fake-device recording was verified in the Phase 9 dev E2E;
  // here we verify the Record tab + start button render in production.
  await page.getByRole('tab', { name: 'Record Audio' }).click()
  const micBtn = page.getByRole('button', { name: /start recording/i })
  check('Record tab has a start button', (await micBtn.count()) > 0)

  // ---- 4–7. Demo sample -> real Prisma -> Results -> real Timbre ----
  console.log('\n== 4-7. Demo -> Prisma -> Results -> Timbre ==')
  await page.goto(APP + '/demo', { waitUntil: 'networkidle' })
  const demoText = await page.evaluate(() => document.body.innerText)
  check('8. Demo Samples: 6 samples listed', (demoText.match(/Analyze Sample/g) || []).length >= 6)
  await page.getByTestId('analyze-sample-bank-otp').click()
  await page.waitForURL('**/results', { timeout: 60000 })
  await page.waitForTimeout(2000)
  const resText = await page.evaluate(() => document.body.innerText)
  check('4. Prisma: real transcript visible', /नमस्ते, मैं आपके bank से बोल रहा हूँ/.test(resText))
  check('5. Risk engine: High Risk band', /High Risk/.test(resText))
  check('5. Risk engine: OTP indicator present', /OTP \/ PIN maanga gaya/.test(resText))
  check('6. Results: no fake scores', !/\b\d{2}\/100\b/.test(resText) && !/accuracy/i.test(resText.replace(/accuracy ka proof/i, '')))
  check('6. Results: audio player present', (await page.locator('audio').count()) > 0)
  // Guidance (Poorvi) — wait for the real Timbre call.
  await page.waitForSelector('text=Guidance taiyaar hai', { timeout: 60000 })
  check('7. Timbre: Poorvi guidance ready', true)
  const rl = await page.request.post(APP + '/api/transcribe', { multipart: { audio_file: { name: 'x.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(10) } } })
  // express-rate-limit v8 uses draft-7 headers: `ratelimit` (limit,
  // remaining, reset) + `ratelimit-policy` — not the older
  // `ratelimit-limit` / `ratelimit-remaining` names.
  check('rate-limit headers present on /api/transcribe', !!rl.headers()['ratelimit'], JSON.stringify(Object.keys(rl.headers()).filter((k) => k.startsWith('ratelimit'))))

  // ---- 9. Clean vs Noisy ----
  console.log('\n== 9. Clean vs Noisy Comparison ==')
  await page.goto(APP + '/compare', { waitUntil: 'networkidle' })
  await page.getByTestId('run-comparison').click()
  await page.waitForSelector('[data-testid="comparison-results"]', { timeout: 90000 })
  const cmpText = await page.evaluate(() => document.body.innerText)
  check('Compare: both transcripts shown', /Clean Transcript/.test(cmpText) && /Noisy Transcript/.test(cmpText))
  check('Compare: real metrics (WER/CER)', /Word Error Rate/.test(cmpText) && /Character Error Rate/.test(cmpText))
  check('Compare: measured SNR badge', /12\.01 dB/.test(cmpText))

  // ---- 10. How It Works ----
  console.log('\n== 10. How It Works ==')
  await page.goto(APP + '/how-it-works', { waitUntil: 'networkidle' })
  const hiw = await page.evaluate(() => document.body.innerText)
  check('How It Works: 5 steps present', /Upload or Record/.test(hiw) && /Voice Guidance/.test(hiw) && /Speech to Text/.test(hiw))
  check('How It Works: honest limitations section', /Technical limitations/.test(hiw))

  // ---- 11. About ----
  console.log('\n== 11. About ==')
  await page.goto(APP + '/about', { waitUntil: 'networkidle' })
  const about = await page.evaluate(() => document.body.innerText)
  check('About: architecture + privacy + limitations', /architecture/i.test(about) && /Privacy safeguards/.test(about))

  // ---- 12. Mobile Navigation ----
  console.log('\n== 12. Mobile Navigation ==')
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mpage = await mctx.newPage()
  await mpage.goto(APP + '/', { waitUntil: 'networkidle' })
  const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  check('mobile Home: no horizontal overflow', overflow)
  const navVisible = await mpage.getByRole('navigation', { name: 'Mobile' }).isVisible()
  check('mobile bottom nav visible', navVisible)
  await mpage.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Demo' }).click()
  await mpage.waitForURL('**/demo')
  await mpage.getByTestId('analyze-sample-bank-otp').click()
  await mpage.waitForURL('**/results', { timeout: 60000 })
  await mpage.waitForTimeout(2000)
  const mRes = await mpage.evaluate(() => document.body.innerText)
  check('mobile: Results loads with real data', /High Risk/.test(mRes))
  await mpage.waitForSelector('text=Guidance taiyaar hai', { timeout: 60000 })
  check('mobile: guidance ready', true)
  await mctx.close()
  await ctx.close()

  console.log(`\n==== Production E2E: ${passed} passed, ${failed} failed ====`)
  if (failures.length) console.log('Failures:', failures.join(' | '))
  await browser.close()
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error('Production E2E crashed:', e.message)
  process.exit(2)
})
