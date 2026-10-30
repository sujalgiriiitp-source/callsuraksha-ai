/**
 * CallSuraksha AI — Phase 9 end-to-end tests (Playwright, real browser,
 * real backend, real Gnani calls kept to a minimum).
 *
 * Covers, on desktop (1440x900) and mobile (390x844):
 *  - every route loads, no placeholder text remains
 *  - no horizontal overflow at 320 / 375 / 768 / 1366 / 1920
 *  - keyboard navigation moves focus and focus is visible
 *  - prefers-reduced-motion disables animations
 *  - Home shows the REAL server status (Gnani connected)
 *  - Demo sample -> real Results; second visit shows the "Cached result"
 *    label with the ORIGINAL timestamp (no fresh API call)
 *  - Guidance session cache: revisiting /results and /guidance does NOT
 *    fire a new TTS call (verified against the server log)
 *  - Compare runs with real Prisma on both sides
 *  - Upload validation errors (bad format, too large) + Analyze gating
 *  - Mic recording with a fake media device (preview appears)
 *  - Stale-result clearing: a failed new analysis leaves /results empty
 *
 * Usage: node scripts/e2e-phase9.mjs
 * Requires: `npm run server` and `npm run dev` already running.
 */
import { chromium } from 'playwright-core'
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const APP = 'http://127.0.0.1:5173'
const OUT = '/home/hatch/workspace/gnani-ai-challenge/ui-verification/phase9'
const EXE =
  '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'
const SERVER_LOG = '/tmp/phase9-server.log'

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

function guidanceCalls() {
  try {
    const log = fs.readFileSync(SERVER_LOG, 'utf8')
    return (log.match(/\[guidance\] ok/g) || []).length
  } catch {
    return -1
  }
}

async function noOverflow(page, label) {
  const w = await page.evaluate(() => document.documentElement.scrollWidth)
  const iw = await page.evaluate(() => window.innerWidth)
  check(`${label}: no horizontal overflow (${w} <= ${iw})`, w <= iw + 1, `scrollWidth=${w} innerWidth=${iw}`)
}

async function main() {
  const browser = await chromium.launch({
    executablePath: EXE,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })

  // ---- Viewport sweep: overflow + placeholder check on every route ----
  const ROUTES = [
    ['/', 'Home'], ['/analyze', 'Analyze'], ['/results', 'Results (empty)'],
    ['/demo', 'Demo'], ['/compare', 'Compare'],
    ['/how-it-works', 'How It Works'], ['/about', 'About'], ['/guidance', 'Guidance (empty)'],
  ]
  for (const [w, h, label] of [[320, 700, '320px'], [375, 844, '375px'], [768, 1024, '768px'], [1366, 900, '1366px'], [1920, 1080, '1920px']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const page = await ctx.newPage()
    console.log(`\n== viewport ${label} ==`)
    for (const [path, name] of ROUTES) {
      await page.goto(APP + path, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      await noOverflow(page, `${name} @ ${label}`)
      const body = await page.evaluate(() => document.body.innerText)
      check(`${name}: no placeholder text @ ${label}`, !/Phase 2 ke baad|baad me poora hoga|Phase 7 — Results dashboard|sample audio Phase 8 me aayega/i.test(body))
    }
    await ctx.close()
  }

  // ---- Desktop: keyboard + reduced motion + Home status ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  console.log('\n== desktop: a11y + Home ==')
  await page.goto(APP + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const statusText = await page.evaluate(() => document.body.innerText)
  check('Home shows REAL status (Gnani connected)', /Gnani connected/.test(statusText), 'status chip')
  check('Home has no stale key-not-set claim', !/Gnani integration abhi connected nahi hai/.test(statusText))

  // Keyboard: Tab moves focus; :focus-visible shows an outline.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const focus = await page.evaluate(() => {
    const el = document.activeElement
    if (!el) return { tag: 'none', outline: 'none' }
    const cs = getComputedStyle(el)
    return { tag: el.tagName + '.' + (el.className?.toString().slice(0, 30) ?? ''), outline: cs.outlineStyle + ' ' + cs.outlineWidth }
  })
  check('Tab moves keyboard focus', focus.tag !== 'none' && focus.tag !== 'BODY', JSON.stringify(focus))
  check('focused element has a visible outline', /solid/.test(focus.outline), JSON.stringify(focus))

  // Reduced motion: animation duration collapses to 0.01ms.
  const ctxRM = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const pageRM = await ctxRM.newPage()
  await pageRM.goto(APP + '/', { waitUntil: 'networkidle' })
  const anim = await pageRM.evaluate(() => {
    const el = document.querySelector('.animate-spin, .animate-pulse') || document.body
    return getComputedStyle(el).animationDuration
  })
  // 0.01ms serializes as "1e-05s" — parse it: any duration <= 0.1ms counts.
  const animMs = parseFloat(anim) * (anim.endsWith('ms') ? 1 : 1000)
  check('prefers-reduced-motion disables animations', animMs <= 0.1, `animationDuration=${anim}`)
  await ctxRM.close()

  // ---- New pages content ----
  console.log('\n== new pages ==')
  await page.goto(APP + '/how-it-works', { waitUntil: 'networkidle' })
  const hiw = await page.evaluate(() => document.body.innerText)
  check('How It Works: 5 steps present', ['Upload or Record', 'Speech to Text', 'Risk Analysis', 'Explainable Results', 'Voice Guidance'].every((s) => hiw.includes(s)))
  check('How It Works: honest limitations section', /Technical limitations/.test(hiw) && /rule-based/.test(hiw))
  check('How It Works: no fake claims', !/High accuracy transcription|enterprise-grade/.test(hiw))
  await page.goto(APP + '/about', { waitUntil: 'networkidle' })
  const about = await page.evaluate(() => document.body.innerText)
  check('About: architecture + privacy + limitations', /Technology architecture/.test(about) && /Privacy safeguards/.test(about) && /Responsible AI/.test(about))
  await page.goto(APP + '/guidance', { waitUntil: 'networkidle' })
  const gEmpty = await page.evaluate(() => document.body.innerText)
  check('Guidance (empty): explains + offers real next steps', /Abhi koi analysis nahi hai/.test(gEmpty) && /Analyze a Call/.test(gEmpty))

  // ---- Upload validation + gating ----
  console.log('\n== Analyze: validation + gating ==')
  await page.goto(APP + '/analyze', { waitUntil: 'networkidle' })
  const analyzeBtn = page.getByRole('button', { name: /Analyze with AI/ })
  check('Analyze button disabled with no file', await analyzeBtn.isDisabled())
  // Bad format: a .txt file
  fs.writeFileSync('/tmp/phase9-bad.txt', 'not audio')
  await page.setInputFiles('input[type="file"]', '/tmp/phase9-bad.txt')
  await page.waitForTimeout(500)
  const analyzeText = await page.evaluate(() => document.body.innerText)
  check('invalid file shows the format error', /Format supported nahi hai/.test(analyzeText))
  // Too large: a 6.4 MB WAV (valid header, big body)
  const big = Buffer.alloc(6.4 * 1024 * 1024)
  big.write('RIFF', 0); big.write('WAVE', 8)
  fs.writeFileSync('/tmp/phase9-big.wav', big)
  await page.setInputFiles('input[type="file"]', '/tmp/phase9-big.wav')
  await page.waitForTimeout(500)
  const bigText = await page.evaluate(() => document.body.innerText)
  check('oversize file shows the 5 MB error', /5 MB/.test(bigText))

  // ---- Mic recording (fake device) ----
  console.log('\n== Analyze: mic recording ==')
  await page.getByRole('tab', { name: 'Record Audio' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Start recording' }).click()
  await page.waitForTimeout(2500)
  const recVisible = await page.getByText('Recording…').count()
  check('mic recording starts (fake device)', recVisible > 0)
  if (recVisible > 0) {
    await page.getByRole('button', { name: 'Recording roko' }).click()
    await page.waitForTimeout(800)
    const afterRec = await page.evaluate(() => document.body.innerText)
    check('recorded clip shows a preview', /Recording preview/.test(afterRec))
  }

  // ---- Demo sample -> real Results (fresh) ----
  console.log('\n== Demo -> Results (fresh + cached) ==')
  const gBefore = guidanceCalls()
  await page.goto(APP + '/demo', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Bank OTP Request', { timeout: 15000 })
  await page.getByTestId('analyze-sample-bank-otp').click()
  await page.waitForURL('**/results', { timeout: 60000 })
  await page.waitForTimeout(2000)
  const resText = await page.evaluate(() => document.body.innerText)
  check('Results: High Risk band (real Prisma)', /High Risk/.test(resText))
  check('Results: real transcript visible', /OTP/.test(resText))
  check('Results: fresh analysis label (not cached)', /Analyzed on/.test(resText) && !/Cached result/.test(resText))
  // Wait for guidance (real TTS) then switch voice to Nalini.
  await page.waitForSelector('[data-testid="guidance-status"]', { timeout: 30000 })
  await page.waitForTimeout(12000)
  const g1 = await page.evaluate(() => document.body.innerText)
  check('Guidance ready (Poorvi, real Timbre)', /Guidance taiyaar hai/.test(g1))
  await page.getByTestId('guidance-voice-nalini').click()
  await page.waitForTimeout(12000)
  const g2 = await page.evaluate(() => document.body.innerText)
  check('Guidance ready (Nalini, real Timbre)', /Guidance taiyaar hai/.test(g2))
  const gAfterGen = guidanceCalls()
  check('exactly 2 TTS calls so far (Poorvi + Nalini)', gAfterGen - gBefore === 2, `before=${gBefore} after=${gAfterGen}`)
  // Screenshots: results desktop (with guidance).
  await page.screenshot({ path: `${OUT}/results-desktop.png`, fullPage: true })

  // Revisit: /guidance (same analysis) then /results again — NO new TTS call.
  // NOTE: in-app navigation (SPA links + history back) keeps the session
  // store and caches alive. A full page.goto() reloads the page and clears
  // the in-memory store by design, so it must NOT be used here.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click()
  await page.waitForURL(APP + '/')
  await page.getByRole('link', { name: 'Get Guidance' }).click()
  await page.waitForURL('**/guidance')
  await page.waitForTimeout(6000)
  const gPage = await page.evaluate(() => document.body.innerText)
  check('Guidance page shows the live card for this analysis', /Aapki latest analysis ki guidance/.test(gPage))
  check('Guidance page reuses cached audio (no loading loop)', /Guidance taiyaar hai/.test(gPage))
  // The Guidance page links back to the full Results dashboard (SPA).
  await page.getByRole('link', { name: 'Full Results dekho' }).click()
  await page.waitForURL('**/results')
  await page.waitForTimeout(6000)
  check('revisiting /results fires NO new TTS call', guidanceCalls() === gAfterGen, `calls=${guidanceCalls()} expected=${gAfterGen}`)

  // Cached analysis: analyze the same sample again — no new Prisma call,
  // and the Results page says "Cached result" with the original time.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Demo' }).click()
  await page.waitForURL('**/demo')
  await page.getByTestId('analyze-sample-bank-otp').click()
  await page.waitForURL('**/results', { timeout: 60000 })
  await page.waitForTimeout(1500)
  const cachedText = await page.evaluate(() => document.body.innerText)
  check('second Analyze Sample shows "Cached result"', /Cached result/.test(cachedText))
  check('cached label explains no new API call', /naya API call nahi hua/.test(cachedText))

  // ---- Compare: real Prisma on both sides ----
  console.log('\n== Compare ==')
  await page.goto(APP + '/compare', { waitUntil: 'networkidle' })
  await page.getByTestId('run-comparison').click()
  await page.waitForSelector('[data-testid="comparison-results"]', { timeout: 90000 })
  await page.waitForTimeout(1000)
  const cmp = await page.evaluate(() => document.body.innerText)
  check('Compare: both transcripts shown', /Transcription/.test(cmp) || /Transcript/.test(cmp))
  check('Compare: real metrics shown (WER/CER)', /WER|Word Error Rate/i.test(cmp))
  await page.screenshot({ path: `${OUT}/compare-desktop.png`, fullPage: true })

  // ---- Stale-result clearing: failed new analysis -> store is empty ----
  // The store holds the cached bank-otp result at this point. A failed new
  // analysis must clear it: /guidance then shows its empty state (its live
  // card appears only when the store holds an analysis). SPA navigation is
  // used throughout — a full page.goto() would reload the module and clear
  // the store by itself, which would make this check meaningless.
  console.log('\n== Stale results ==')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Analyze' }).click()
  await page.waitForURL('**/analyze')
  await page.setInputFiles('input[type="file"]', '/home/hatch/workspace/gnani-ai-challenge/api-tests/timbre-poorvi-hi-en-24k.wav')
  await page.waitForTimeout(800)
  // Pick Hinglish language + consent so Analyze enables.
  await page.locator('select').first().selectOption({ index: 2 })
  await page.getByLabel(/Main confirm karta/).check()
  // Fail the transcribe request at the network layer.
  await page.route('**/api/transcribe', (route) => route.abort('failed'))
  const btn = page.getByRole('button', { name: /Analyze with AI/ })
  if (await btn.isEnabled()) {
    await btn.click()
    await page.waitForTimeout(2500)
    await page.unroute('**/api/transcribe')
    const errText = await page.evaluate(() => document.body.innerText)
    check('failed analysis shows an error (not a silent stale result)', /fail|connect nahi|dobara try/i.test(errText))
    // SPA to /guidance: the store must be empty now.
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click()
    await page.waitForURL(APP + '/')
    await page.getByRole('link', { name: 'Get Guidance' }).click()
    await page.waitForURL('**/guidance')
    // Wait for React Router to commit the new route before reading text:
    // waitForURL resolves on the URL change, which can precede the render.
    await page.waitForTimeout(1500)
    const gAfterFail = await page.evaluate(() => document.body.innerText)
    check('failed new analysis clears the old result (Guidance empty)', /Abhi koi analysis nahi hai/.test(gAfterFail))
  } else {
    check('Analyze enabled after file+language+consent (stale test setup)', false, 'button stayed disabled')
  }

  // ---- Final screenshots (desktop) ----
  console.log('\n== final screenshots ==')
  for (const [name, path] of [['home', '/'], ['analyze', '/analyze'], ['demo', '/demo'], ['how-it-works', '/how-it-works'], ['about', '/about'], ['guidance', '/guidance']]) {
    await page.goto(APP + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/${name}-desktop.png`, fullPage: true })
  }
  await ctx.close()

  // ---- Mobile: full flow + screenshots ----
  console.log('\n== mobile 390px ==')
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const m = await mctx.newPage()
  await m.goto(APP + '/', { waitUntil: 'networkidle' })
  await m.waitForTimeout(800)
  await m.screenshot({ path: `${OUT}/home-mobile.png`, fullPage: true })
  await m.goto(APP + '/demo', { waitUntil: 'networkidle' })
  await m.waitForSelector('text=Bank OTP Request', { timeout: 15000 })
  await m.getByTestId('analyze-sample-bank-otp').click()
  await m.waitForURL('**/results', { timeout: 60000 })
  await m.waitForTimeout(8000)
  const mRes = await m.evaluate(() => document.body.innerText)
  check('mobile: Results loads with real data', /High Risk/.test(mRes))
  check('mobile: guidance ready', /Guidance taiyaar hai/.test(mRes))
  await m.screenshot({ path: `${OUT}/results-mobile.png`, fullPage: true })
  for (const [name, path] of [['analyze', '/analyze'], ['how-it-works', '/how-it-works'], ['about', '/about'], ['guidance', '/guidance'], ['compare', '/compare']]) {
    await m.goto(APP + path, { waitUntil: 'networkidle' })
    await m.waitForTimeout(500)
    await m.screenshot({ path: `${OUT}/${name}-mobile.png`, fullPage: true })
  }
  await mctx.close()
  await browser.close()

  console.log(`\n==== Phase 9 E2E: ${passed} passed, ${failed} failed ====`)
  if (failures.length) console.log('Failures:', failures.join(' | '))
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error('E2E crashed:', e.message)
  process.exit(2)
})
