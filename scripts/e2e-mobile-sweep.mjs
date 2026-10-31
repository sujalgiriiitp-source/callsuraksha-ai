/**
 * CallSuraksha AI — Phase 2 mobile responsiveness sweep (autonomous testing).
 *
 * Viewport sweep 320/375/390/430/768/1024/1440 against the LOCAL production
 * server (http://localhost:3001, NODE_ENV=production) — byte-identical code
 * to the live deployment (live JS index-BLJlIK62.js matches local dist).
 * Emulated testing only: no real Android / real device is available here.
 *
 * ONE browser context + ONE page for the whole run: the analysis result
 * lives in the SPA's in-memory store, so viewports are changed with
 * page.setViewportSize (no reload) and pages are reached by in-app SPA
 * navigation (nav-link clicks). The demo-sample analysis runs ONCE
 * (1 Prisma + 1 Timbre = 2 limiter hits); Results is checked at every
 * viewport by resizing while staying on /results. No per-viewport
 * re-analysis. The Compare page is checked WITHOUT running a comparison
 * (that would cost 2 more Prisma calls).
 *
 * Usage (fresh production server must be running first):
 *   NODE_ENV=production AI_ENABLED=true npm start &
 *   node scripts/e2e-mobile-sweep.mjs
 * Screenshots land in
 * ~/workspace/gnani-ai-challenge/ui-verification/phase11-mobile/.
 * Exit code 0 = all checks pass, 1 = any failure.
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const APP = process.env.PROD_URL || 'http://localhost:3001'
const SHOTS = '/home/hatch/workspace/gnani-ai-challenge/ui-verification/phase11-mobile'
const EXECUTABLE =
  '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'
const VIEWPORTS = [1440, 1024, 768, 430, 390, 375, 320]
const PAGES = [
  { name: 'Home', nav: 'Home', path: '/' },
  { name: 'Analyze', nav: 'Analyze', path: '/analyze' },
  { name: 'Demo', nav: 'Demo', path: '/demo' },
  { name: 'How It Works', nav: 'How It Works', path: '/how-it-works' },
  { name: 'About', nav: 'About', path: '/about' },
  // Compare has NO nav link (top nav + bottom nav both skip it) — the only
  // in-app route is About -> "Compare dekho". Navigating there by direct
  // URL would reload the document and wipe the in-memory analysis store,
  // so Compare is reached via that link (see gotoPage).
  { name: 'Compare', nav: null, path: '/compare' },
  // Guidance has no nav link either — reached from Home -> "Get Guidance".
  // Guidance is visited LAST so the loop can return to /results via its
  // "Full Results dekho" link (deterministic SPA navigation, no history
  // counting).
  { name: 'Guidance', nav: null, path: '/guidance' },
]

const checks = []
function check(name, ok, extra = '') {
  checks.push({ name, ok, extra })
  console.log(`${ok ? '  PASS' : '  FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function overflowCheck(page, tag) {
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
  check(`${tag}: no horizontal overflow`, m.scrollWidth <= m.innerWidth + 1, `scrollWidth=${m.scrollWidth} innerWidth=${m.innerWidth}`)
  return m
}

async function textReadable(page, tag) {
  // No element may stick out past the right edge of the viewport — EXCEPT
  // decorative elements intentionally clipped by an overflow-hidden
  // ancestor (e.g. the Home hero glow div: `absolute -inset-8` inside an
  // overflow-hidden wrapper — getBoundingClientRect still reports the full
  // rect, but nothing is visible past the edge; scrollWidth proves it).
  const bad = await page.evaluate(() => {
    const vw = window.innerWidth
    const clippedByAncestor = (el) => {
      let a = el.parentElement
      while (a) {
        const ox = getComputedStyle(a).overflowX
        if (ox === 'hidden' || ox === 'clip') return true
        a = a.parentElement
      }
      return false
    }
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.right > vw + 1 && r.left < vw && !clippedByAncestor(el)) {
        const cls = (el.className && el.className.toString().slice(0, 40)) || el.tagName
        out.push(`${el.tagName}.${cls} right=${Math.round(r.right)}`)
        if (out.length >= 5) break
      }
    }
    return out
  })
  check(`${tag}: no element sticks out past the right edge`, bad.length === 0, bad.join(' | '))
}

async function navCheck(page, tag, isMobile) {
  if (isMobile) {
    const bottom = await page.getByRole('navigation', { name: 'Mobile' }).count()
    check(`${tag}: mobile bottom nav present`, bottom > 0)
    if (bottom > 0) {
      check(`${tag}: mobile bottom nav visible`, await page.getByRole('navigation', { name: 'Mobile' }).isVisible())
    }
  } else {
    const top = await page.locator('header nav, nav').first().count()
    check(`${tag}: top nav present`, top > 0)
  }
}

async function gotoPage(page, p, tag) {
  // SPA navigation ONLY — a direct page.goto reloads the document and
  // wipes the in-memory analysis store (by design), so a missing nav link
  // is reported as a failure instead of silently reloading.
  if (p.name === 'Compare') {
    // No nav link exists for Compare — the only in-app route is
    // About -> "Compare dekho".
    const aboutLink = page.getByRole('link', { name: 'About', exact: true }).first()
    if ((await aboutLink.count()) === 0) {
      check(`${tag}: Compare reachable via About`, false, 'no About nav link')
      return
    }
    await aboutLink.click()
    await page.waitForURL('**/about', { timeout: 15000 })
    await page.waitForTimeout(400)
    const cmpLink = page.getByRole('link', { name: /Compare dekho/ }).first()
    if ((await cmpLink.count()) === 0) {
      check(`${tag}: Compare reachable via About`, false, 'no "Compare dekho" link on About')
      return
    }
    await cmpLink.click()
    await page.waitForURL('**/compare', { timeout: 15000 })
    await page.waitForTimeout(600)
    check(`${tag}: Compare page reached (via About)`, page.url().endsWith('/compare'), page.url())
    return
  }
  if (p.name === 'Guidance') {
    // No nav link exists for Guidance — reached from Home -> "Get Guidance".
    const homeLink = page.getByRole('link', { name: 'Home', exact: true }).first()
    if ((await homeLink.count()) === 0) {
      check(`${tag}: Guidance reachable via Home`, false, 'no Home nav link')
      return
    }
    await homeLink.click()
    await page.waitForURL('**/', { timeout: 15000 })
    await page.waitForTimeout(400)
    const gLink = page.getByRole('link', { name: 'Get Guidance' }).first()
    if ((await gLink.count()) === 0) {
      check(`${tag}: Guidance reachable via Home`, false, 'no "Get Guidance" link on Home')
      return
    }
    await gLink.click()
    await page.waitForURL('**/guidance', { timeout: 15000 })
    await page.waitForTimeout(600)
    check(`${tag}: Guidance page reached (via Home)`, page.url().endsWith('/guidance'), page.url())
    return
  }
  const link = page.getByRole('link', { name: p.nav, exact: true }).first()
  if ((await link.count()) === 0) {
    check(`${tag}: ${p.name} reachable from nav`, false, 'no nav link')
    return
  }
  await link.click()
  await page.waitForURL(`**${p.path === '/' ? '' : p.path}`, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
  const url = page.url()
  check(`${tag}: ${p.name} page reached`, url.endsWith(p.path) || (p.path === '/' && /\/$/.test(url)), url)
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ executablePath: EXECUTABLE })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const consoleErrors = []
  const failedRequests = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200))
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`))
  page.on('requestfailed', (r) => failedRequests.push(`${r.url().slice(0, 100)} :: ${(r.failure()?.errorText || '')}`))

  // ---- 1440px: full flow once (analysis happens here) ----
  console.log('\n== 1440px: Home + Analyze + Demo analysis ==')
  await page.goto(`${APP}/`, { waitUntil: 'networkidle', timeout: 120000 })
  await overflowCheck(page, '1440 Home')
  await textReadable(page, '1440 Home')
  await navCheck(page, '1440 Home', false)
  const homeText = await page.evaluate(() => document.body.innerText)
  check('1440 Home: hero present', /Call Suno, Risk Samjho/.test(homeText))
  check('1440 Home: REAL status (Gnani connected)', /Server online · Gnani connected/.test(homeText))
  check('1440 Home: no fake scores', !/\b\d{2}\/100\b/.test(homeText))
  await page.screenshot({ path: `${SHOTS}/home-1440.png`, fullPage: true })

  await gotoPage(page, PAGES[1], '1440')
  await overflowCheck(page, '1440 Analyze')
  await textReadable(page, '1440 Analyze')
  const analyzeBtn = page.getByRole('button', { name: /Analyze with AI/ })
  check('1440 Analyze: Analyze button present + disabled with no file', (await analyzeBtn.count()) > 0 && (await analyzeBtn.isDisabled()))
  const langSelect = page.locator('#analyze-language')
  check('1440 Analyze: language select usable', (await langSelect.count()) > 0 && (await langSelect.isEnabled()))
  await langSelect.selectOption('hi-IN,en-IN')
  check('1440 Analyze: language select changes value', (await langSelect.inputValue()) === 'hi-IN,en-IN')
  const consent = page.getByRole('checkbox', { name: /Main confirm karta/ })
  check('1440 Analyze: consent checkbox usable', (await consent.count()) > 0 && (await consent.isEnabled()))
  await page.screenshot({ path: `${SHOTS}/analyze-1440.png`, fullPage: true })

  // Demo: play a sample player (currentTime must advance), then ONE analysis.
  await gotoPage(page, PAGES[2], '1440')
  await overflowCheck(page, '1440 Demo')
  await textReadable(page, '1440 Demo')
  const demoText = await page.evaluate(() => document.body.innerText)
  check('1440 Demo: 6 samples listed', (demoText.match(/Analyze Sample/g) || []).length >= 6)
  const sampleAudio = page.locator('audio').first()
  check('1440 Demo: sample audio players present', (await page.locator('audio').count()) >= 6)
  await sampleAudio.evaluate((a) => a.play()).catch(() => {})
  await sleep(2000)
  const t1 = await sampleAudio.evaluate((a) => a.currentTime).catch(() => -1)
  check('1440 Demo: sample audio actually plays (currentTime advances)', t1 > 0.3, `currentTime=${t1.toFixed(2)}`)
  await sampleAudio.evaluate((a) => a.pause()).catch(() => {})
  await page.screenshot({ path: `${SHOTS}/demo-1440.png`, fullPage: true })

  console.log('\n== 1440px: ONE demo analysis (1 Prisma + 1 Timbre) ==')
  await page.getByTestId('analyze-sample-bank-otp').click()
  await page.waitForURL('**/results', { timeout: 60000 })
  await page.waitForFunction(() => /Analyzed on/.test(document.body.innerText), { timeout: 15000 })
  const resText = await page.evaluate(() => document.body.innerText)
  check('1440 Results: real High Risk band', /High Risk/.test(resText))
  check('1440 Results: real transcript visible', /नमस्ते, मैं आपके bank से बोल रहा हूँ/.test(resText))
  check('1440 Results: indicator cards present', /OTP \/ PIN maanga gaya/.test(resText))
  await page.waitForSelector('[data-testid="guidance-status"]', { timeout: 30000 })
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="guidance-status"]')
      return el !== null && !/ban rahi hai/.test(el.innerText)
    },
    { timeout: 30000 },
  )
  const gText = (await page.getByTestId('guidance-status').innerText()).trim()
  check('1440 Results: Timbre guidance ready', /Guidance taiyaar hai/.test(gText), gText.slice(0, 60))
  await overflowCheck(page, '1440 Results')
  await textReadable(page, '1440 Results')
  await page.screenshot({ path: `${SHOTS}/results-1440.png`, fullPage: true })

  // ---- Resize sweep: Results first (store stays alive), then other pages ----
  for (const w of VIEWPORTS.slice(1)) {
    const isMobile = w <= 430
    console.log(`\n== ${w}px ==`)
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(800)
    // Results (still on /results — no reload, store intact)
    await overflowCheck(page, `${w} Results`)
    await textReadable(page, `${w} Results`)
    await navCheck(page, `${w} Results`, isMobile)
    const rt = await page.evaluate(() => document.body.innerText)
    check(`${w} Results: band + transcript still readable`, /High Risk/.test(rt) && /नमस्ते/.test(rt))
    const guidanceAudio = page.locator('[data-testid="guidance-status"]').first()
    check(`${w} Results: guidance card present`, (await guidanceAudio.count()) > 0)
    await page.screenshot({ path: `${SHOTS}/results-${w}.png`, fullPage: true })

    // Other pages via SPA nav (store preserved)
    for (const p of PAGES) {
      await gotoPage(page, p, `${w}`)
      await overflowCheck(page, `${w} ${p.name}`)
      await textReadable(page, `${w} ${p.name}`)
      await navCheck(page, `${w} ${p.name}`, isMobile)
      // Spot-check a key button per page
      if (p.name === 'Analyze') {
        const b = page.getByRole('button', { name: /Analyze with AI/ })
        check(`${w} Analyze: CTA visible + clickable state honest`, (await b.count()) > 0 && (await b.isVisible()))
      }
      if (p.name === 'Demo') {
        const b = page.getByTestId('analyze-sample-bank-otp')
        check(`${w} Demo: Analyze Sample button visible`, (await b.count()) > 0 && (await b.isVisible()))
      }
      if (p.name === 'Compare') {
        const b = page.getByTestId('run-comparison')
        check(`${w} Compare: run button visible (not clicked — no extra AI call)`, (await b.count()) > 0 && (await b.isVisible()))
      }
      if (p.name === 'Guidance') {
        const g = page.locator('[data-testid="guidance-status"]').first()
        check(`${w} Guidance: guidance card present (real analysis in store)`, (await g.count()) > 0)
      }
      if (p.name === 'Home') {
        await page.screenshot({ path: `${SHOTS}/home-${w}.png`, fullPage: false }).catch(() => {})
      }
    }
    // Back to Results via the Guidance page's "Full Results dekho" link
    // (deterministic SPA navigation — Guidance is visited last).
    // Fallback: history back-steps.
    const fullResults = page.getByRole('link', { name: /Full Results dekho/ }).first()
    if ((await fullResults.count()) > 0) {
      await fullResults.click()
      await page.waitForURL('**/results', { timeout: 15000 })
      await page.waitForTimeout(600)
    } else {
      for (let i = 0; i < 9 && !page.url().endsWith('/results'); i++) {
        await page.goBack()
        await page.waitForTimeout(400)
      }
    }
    check(`${w}: back on /results after page checks`, page.url().endsWith('/results'), page.url())
  }

  // ---- Mobile bottom nav works (390px): tap Demo, land on /demo ----
  console.log('\n== 390px: mobile bottom nav tap ==')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(800)
  // Ensure we are on a page where the bottom nav shows (Results has it too).
  await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Demo' }).click()
  await page.waitForURL('**/demo', { timeout: 15000 })
  check('390px: bottom nav Demo tap navigates to /demo', page.url().endsWith('/demo'))
  await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Analyze' }).click()
  await page.waitForURL('**/analyze', { timeout: 15000 })
  check('390px: bottom nav Analyze tap navigates to /analyze', page.url().endsWith('/analyze'))

  // ---- Console / network hygiene ----
  // Environmental noise is separated, not hidden: the headless shell on
  // this VM cannot reach the public internet, so the Google Fonts request
  // (fonts.googleapis.com) always fails here with ERR_TUNNEL_CONNECTION_FAILED
  // and the app falls back to system fonts — a same-origin request can
  // never fail that way (localhost is in NO_PROXY), so a tunnel error is
  // always the external fonts request. ERR_ABORTED on .wav fetches and on
  // blob: guidance-audio URLs is the browser aborting in-flight media
  // requests when a page unmounts or a blob URL is revoked — benign.
  // Anything else still fails the suite.
  console.log('\n== console + network ==')
  const isEnvNoise = (s) =>
    /fonts\.(googleapis|gstatic)\.com/.test(s) ||
    /ERR_TUNNEL_CONNECTION_FAILED/.test(s) ||
    (/ERR_ABORTED/.test(s) && (/blob:/.test(s) || /\.(wav|mp3|ogg|m4a)\b/.test(s)))
  const realConsoleErrors = consoleErrors.filter((s) => !isEnvNoise(s))
  const realFailed = failedRequests.filter((s) => !isEnvNoise(s))
  const envNoise = [...consoleErrors, ...failedRequests].filter(isEnvNoise)
  check('no console errors during the whole sweep (excluding env noise)', realConsoleErrors.length === 0, realConsoleErrors.slice(0, 3).join(' | '))
  check('no failed network requests during the whole sweep (excluding env noise)', realFailed.length === 0, realFailed.slice(0, 3).join(' | '))
  console.log(`  INFO environmental noise (not app bugs): ${envNoise.length} occurrences — ${[...new Set(envNoise.map((s) => s.slice(0, 80)))].join(' | ')}`)

  await browser.close()
  const passed = checks.filter((c) => c.ok).length
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n==== Mobile sweep: ${passed} passed, ${failed.length} failed ====`)
  if (failed.length) console.log('Failures:', failed.map((f) => f.name).join(' | '))
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('Mobile sweep crashed:', e.message)
  process.exit(2)
})
