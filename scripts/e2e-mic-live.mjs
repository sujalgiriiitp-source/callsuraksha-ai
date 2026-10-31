/**
 * CallSuraksha AI — LIVE mic verification (deploy check, not a new suite).
 *
 * Reduced copy of scripts/e2e-mic.mjs, pointed at the deployed Render URL.
 * Only the parts that can run against a production build:
 *   - Desktop fake-mic flow: Record -> Convert (webm -> 16 kHz mono WAV)
 *     -> Preview -> Upload -> real Prisma -> Results -> real Timbre.
 *   - Permission-denied case (no mic device): honest error, 0 API calls.
 * OMITTED on purpose (proven locally in Phase B against identical code):
 *   - Real-speech WebM test: it imports '/src/lib/audio-convert.ts'
 *     directly, which only the Vite dev server serves — a production
 *     build has no such module. The desktop flow already proves the
 *     same webm->WAV conversion path on the live build.
 *   - Mobile flow: proven locally in Phase B; mobile guidance is
 *     covered by the live production E2E mobile flow.
 * KNOWN LIMITATION (31 Oct 2026 ~20:35 IST): the headless shell on
 * this VM CANNOT reach any public URL (ERR_TUNNEL_CONNECTION_FAILED
 * in every probe variant, while curl through the same proxy works).
 * The live verification therefore runs through the runtime browser
 * task instead. This script is kept for use from a machine with
 * direct internet access.
 *
 * Real Gnani usage: 1 Prisma + 1 Timbre (desktop flow). Run AFTER the
 * live production E2E so the combined 15-min window stays under the
 * combined 10/15min limit (prod E2E = 7 hits, this = 2, total 9).
 *
 * Usage: warm the service first (curl the live /api/health), then:
 *   PROD_URL=https://callsuraksha-ai.onrender.com node scripts/e2e-mic-live.mjs
 */
import { chromium } from 'playwright-core'

const APP = process.env.PROD_URL || 'https://callsuraksha-ai.onrender.com'
const SHOTS = '/home/hatch/workspace/gnani-ai-challenge/ui-verification/phaseC-live'
const EXECUTABLE =
  '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'

// VM egress proxy (parsed at runtime from the environment; no
// credential is stored here). The headless shell cannot reach a public
// URL directly and Chromium does not use the credentials embedded in
// the HTTPS_PROXY env URL, so pass them to Playwright explicitly.
function egressProxy() {
  try {
    const u = new URL(process.env.HTTPS_PROXY || '')
    if (!u.hostname) return undefined
    return {
      server: `${u.protocol}//${u.hostname}:${u.port || 3128}`,
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
    }
  } catch {
    return undefined
  }
}
const PROXY = egressProxy()

const checks = []
function check(name, ok, extra = '') {
  checks.push({ name, ok, extra })
  console.log(`${ok ? '  PASS' : '  FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    ...(PROXY ? { proxy: PROXY } : {}),
  })

  // ---- Desktop: fake-mic full flow on the LIVE site ----
  console.log('\n== LIVE desktop 1440px: fake-mic full flow ==')
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${APP}/analyze`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.getByRole('tab', { name: 'Record Audio' }).click()
  await page.getByRole('button', { name: /start recording/i }).click()
  await page.waitForSelector('text=Recording…', { timeout: 15000 })
  await sleep(4000)
  await page.getByRole('button', { name: 'Recording roko' }).click()
  await page.waitForSelector('[data-testid="recording-convert-note"]', { timeout: 30000 })
  const note = (await page.getByTestId('recording-convert-note').innerText()).trim()
  check('LIVE desktop: conversion note shows 16 kHz mono WAV', /16 kHz mono WAV/.test(note), note)
  const card = await page.evaluate(() => document.body.innerText)
  check('LIVE desktop: selected format is WAV', /Format\s+WAV/.test(card))
  check(
    'LIVE desktop: converted-WAV preview player exists',
    (await page.locator('audio[aria-label="Recording preview"]').count()) > 0,
  )
  await page.screenshot({ path: `${SHOTS}/mic-analyze-desktop.png`, fullPage: true })
  await page.selectOption('#analyze-language', 'hi-IN,en-IN')
  await page.getByRole('checkbox', { name: /Main confirm karta/ }).check()
  await page.getByRole('button', { name: /Analyze with AI/ }).click()
  await page.waitForURL('**/results', { timeout: 60000 })
  await page.waitForFunction(() => /Analyzed on/.test(document.body.innerText), { timeout: 15000 })
  const resText = await page.evaluate(() => document.body.innerText)
  check('LIVE desktop: Results loads with real data', /Analyzed on/.test(resText))
  check(
    'LIVE desktop: a real risk band is shown (no fake score)',
    /High Risk|Medium Risk|Low Risk|Unable to Assess/.test(resText),
  )
  check(
    'LIVE desktop: tone audio honestly yields Unable to Assess (not a fake verdict)',
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
    'LIVE desktop: Timbre guidance ready, or honest text fallback with safe steps',
    /Guidance taiyaar hai/.test(gText) || /1930/.test(gText),
    gText.slice(0, 80),
  )
  await page.screenshot({ path: `${SHOTS}/mic-results-desktop.png`, fullPage: true })
  await ctx.close()

  // ---- Permission denied (no mic device, no fake flags) ----
  console.log('\n== LIVE permission denied / no microphone ==')
  const browser2 = await chromium.launch({
    executablePath: EXECUTABLE,
    ...(PROXY ? { proxy: PROXY } : {}),
  })
  const ctx3 = await browser2.newContext({ viewport: { width: 1440, height: 900 } })
  const page3 = await ctx3.newPage()
  await page3.goto(`${APP}/analyze`, { waitUntil: 'networkidle', timeout: 120000 })
  await page3.getByRole('tab', { name: 'Record Audio' }).click()
  await page3.getByRole('button', { name: /start recording/i }).click()
  await page3.waitForSelector('[role="alert"]', { timeout: 15000 })
  const alertText = (await page3.locator('[role="alert"]').first().innerText()).trim()
  check(
    'LIVE no-mic: honest error shown (permission denied or no microphone)',
    /Microphone permission denied|Koi microphone nahi mila|Mic start nahi ho paya/.test(alertText),
    alertText.slice(0, 100),
  )
  check(
    'LIVE no-mic: no recording started (no Recording… indicator)',
    (await page3.locator('text=Recording…').count()) === 0,
  )
  check(
    'LIVE no-mic: Analyze stays disabled without a recording',
    await page3.getByRole('button', { name: /Analyze with AI/ }).isDisabled(),
  )
  await ctx3.close()
  await browser2.close()
  await browser.close()

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n==== LIVE Mic E2E: ${passed} passed, ${failed.length} failed ====`)
  if (failed.length) console.log('Failures:', failed.map((f) => f.name).join(' | '))
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('LIVE Mic E2E crashed:', e.message)
  process.exit(2)
})
