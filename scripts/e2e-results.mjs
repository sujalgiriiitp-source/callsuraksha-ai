/**
 * CallSuraksha AI — Phase 6 end-to-end test (Playwright, headless shell).
 *
 * Runs the REAL user flow in a real browser against the dev server:
 *   /analyze -> upload a synthetic WAV -> language + consent ->
 *   Analyze with AI -> auto-navigate to /results -> verify real data.
 *
 * Usage (servers must be running first):
 *   npm run server &  npm run dev -- --port 5173 --host 127.0.0.1 &
 *   node scripts/e2e-results.mjs
 *
 * Screenshots land in ~/workspace/gnani-ai-challenge/ui-verification/
 * as phase6-results-desktop.png / phase6-results-mobile.png.
 * Exit code 0 = all checks pass, 1 = any failure.
 */

import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const APP = 'http://127.0.0.1:5173'
const AUDIO = '/home/hatch/workspace/gnani-ai-challenge/api-tests/timbre-poorvi-hi-en-24k.wav'
const SHOTS = '/home/hatch/workspace/gnani-ai-challenge/ui-verification'
const EXECUTABLE =
  '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'

const checks = []
function check(name, ok, extra = '') {
  checks.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}

async function runFlow(browser, viewport, label) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log(`  [pageerror ${label}]`, String(err).slice(0, 200)))

  await page.goto(`${APP}/analyze`, { waitUntil: 'networkidle' })
  // Upload the synthetic WAV through the hidden file input.
  await page.setInputFiles('input[type="file"]', AUDIO)
  await page.waitForSelector('text=Selected audio', { timeout: 15000 })
  check(`${label}: file selected`, true)
  // Language: Hinglish (Prisma v3.0).
  await page.selectOption('#analyze-language', 'hi-IN,en-IN')
  // Consent checkbox (label text is unique on the page).
  await page.getByLabel(/Main confirm karta/).check()
  // Analyze button becomes enabled.
  const btn = page.getByRole('button', { name: /Analyze with AI/ })
  await btn.waitFor({ state: 'visible', timeout: 5000 })
  const disabled = await btn.isDisabled()
  check(`${label}: Analyze button enabled after file+language+consent`, !disabled)
  await btn.click()
  // Real backend analysis -> auto-navigate to /results.
  await page.waitForURL('**/results', { timeout: 30000 })
  // Wait for a Results-only heading (not "High Risk", which also appears
  // as a sample badge on /analyze) so later reads happen after navigation.
  await page.waitForSelector('text=Overall Risk Level', { timeout: 15000 })
  const bandText = await page.textContent('body')
  check(`${label}: navigated to /results with real High Risk band`, bandText.includes('High Risk'))

  // Real data checks.
  const bodyText = await page.textContent('body')
  check(`${label}: real transcript visible`, bodyText.includes('कृपया अपना OTP बताइये'))
  check(`${label}: OTP_DEMAND indicator visible`, bodyText.includes('OTP / PIN maanga gaya'))
  check(`${label}: ACCOUNT_BLOCK indicator visible`, bodyText.includes('Account block ki dhamki'))
  check(`${label}: no fake score shown`, !/\b9[0-9]\/100\b/.test(bodyText) && !bodyText.includes('92/100'))
  check(`${label}: no Report Call button`, !bodyText.includes('Report Call'))
  check(`${label}: disclaimer visible`, bodyText.includes('risk flag'))
  check(`${label}: Phase 7 voice guidance marked coming soon`, bodyText.includes('Phase 7'))

  // Audio playback element present with a blob URL.
  const audioSrc = await page.$eval('audio', (el) => el.getAttribute('src') || '')
  check(`${label}: audio element with blob URL`, audioSrc.startsWith('blob:'))
  // Play/pause works (headless shell decodes the WAV).
  await page.$eval('audio', (el) => el.play().catch(() => {}))
  await page.waitForTimeout(800)
  const playing = await page.$eval('audio', (el) => !el.paused && el.currentTime > 0)
  check(`${label}: audio actually plays`, playing)
  await page.$eval('audio', (el) => el.pause())

  // Screenshot the full results page while the Transcript tab (default)
  // is active, so the highlighted transcript is visible.
  await page.screenshot({
    path: path.join(SHOTS, `phase6-results-${label}.png`),
    fullPage: true,
  })
  console.log(`  screenshot: phase6-results-${label}.png`)
  // Clean viewport shot of the top (no sticky-header stitch artefact).
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOTS, `phase6-results-${label}-top.png`) })
  console.log(`  screenshot: phase6-results-${label}-top.png`)

  // Interactive: click a highlighted transcript sentence -> indicator card activates.
  const sentenceBtn = page.locator('button:has-text("कृपया अपना OTP बताइये")').first()
  await sentenceBtn.scrollIntoViewIfNeeded()
  await sentenceBtn.click()
  await page.waitForTimeout(600)
  const indicatorActive = await page.evaluate(() => {
    const el = document.getElementById('indicator-2')
    return !!el && el.className.includes('border-[#FF6A2C]/70')
  })
  check(`${label}: clicking transcript highlight activates indicator card`, indicatorActive)

  // Interactive: AI Insights tab switches content.
  await page.getByRole('tab', { name: 'AI Insights' }).click()
  await page.waitForSelector('text=Signals mile', { timeout: 5000 })
  check(`${label}: AI Insights tab works`, true)

  await context.close()
}

const browser = await chromium.launch({ executablePath: EXECUTABLE })
try {
  await runFlow(browser, { width: 1440, height: 900 }, 'desktop')
  await runFlow(browser, { width: 390, height: 844 }, 'mobile')
} finally {
  await browser.close()
}

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
