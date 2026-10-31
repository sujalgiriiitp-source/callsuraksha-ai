/**
 * CallSuraksha AI — Phase 8 end-to-end test (Playwright, headless shell).
 *
 * Real browser flow against the dev server:
 *   /demo    -> 6 samples visible, audio plays, Analyze Sample (bank-otp)
 *               -> real Prisma + risk engine -> /results (High band).
 *   /compare -> both players, "Compare karo" -> two independent real
 *               Prisma calls -> transcripts + real WER/CER metrics.
 *
 * Usage (servers must be running first):
 *   npm run server &  npm run dev -- --port 5173 --host 127.0.0.1 &
 *   node scripts/e2e-phase8.mjs
 *
 * Screenshots land in ~/workspace/gnani-ai-challenge/ui-verification/
 * as phase8-demo-<label>.png / phase8-compare-<label>.png.
 * Exit code 0 = all checks pass, 1 = any failure.
 */

import { chromium } from 'playwright-core'
import path from 'node:path'

const APP = 'http://127.0.0.1:5173'
const SHOTS = '/home/hatch/workspace/gnani-ai-challenge/ui-verification'
const EXECUTABLE =
  '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'

const checks = []
function check(name, ok, extra = '') {
  checks.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}

async function noHorizontalOverflow(page, label, pageName) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check(`${label}: ${pageName} has no horizontal overflow`, !overflow)
}

async function runFlow(browser, viewport, label) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log(`  [pageerror ${label}]`, String(err).slice(0, 200)))

  // --- Demo page -----------------------------------------------------------
  await page.goto(`${APP}/demo`, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Bank OTP Request', { timeout: 15000 })
  const demoText = await page.textContent('body')
  for (const title of [
    'Bank OTP Request',
    'Suspicious UPI Payment Request',
    'KYC Update Pressure',
    'Customer Care Impersonation',
    'OTP Safety Advisory',
    'Normal Informational Call',
  ]) {
    check(`${label}: demo sample "${title}" visible`, demoText.includes(title))
  }
  const audioCount = await page.locator('audio[data-testid^="sample-audio-"]').count()
  check(`${label}: 6 sample audio players present`, audioCount === 6, `got ${audioCount}`)
  check(`${label}: no fake score on demo page`, !/\b9[0-9]\/100\b/.test(demoText))
  await noHorizontalOverflow(page, label, '/demo')

  // Sample playback works in the browser.
  await page.getByTestId('sample-audio-bank-otp').evaluate((el) => el.play().catch(() => {}))
  await page.waitForTimeout(800)
  const samplePlaying = await page
    .getByTestId('sample-audio-bank-otp')
    .evaluate((el) => !el.paused && el.currentTime > 0)
  check(`${label}: sample audio actually plays`, samplePlaying)
  await page.getByTestId('sample-audio-bank-otp').evaluate((el) => el.pause())

  // Analyze Sample -> real pipeline -> /results.
  await page.getByTestId('analyze-sample-bank-otp').click()
  await page.waitForURL('**/results', { timeout: 60000 })
  await page.waitForSelector('text=Overall Risk Level', { timeout: 15000 })
  const resultsText = await page.textContent('body')
  check(`${label}: sample analysis navigates to /results with High Risk band`, resultsText.includes('High Risk'))
  check(`${label}: sample analysis shows real transcript`, resultsText.includes('कृपया अपना OTP बताइये'))
  check(`${label}: sample analysis shows OTP indicator`, resultsText.includes('OTP / PIN maanga gaya'))
  await page.screenshot({ path: path.join(SHOTS, `phase8-demo-${label}.png`), fullPage: true })
  console.log(`  screenshot: phase8-demo-${label}.png`)

  // --- Compare page --------------------------------------------------------
  await page.goto(`${APP}/compare`, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Clean vs Noisy Audio Comparison', { timeout: 15000 })
  const compareText = await page.textContent('body')
  check(`${label}: compare page shows measured SNR`, /12\.0\d dB/.test(compareText))
  check(`${label}: compare page shows no fake accuracy`, !compareText.includes('Accuracy') || compareText.includes('accuracy ka proof mat samjho'))
  await noHorizontalOverflow(page, label, '/compare')

  const cleanPlaying = await page
    .getByTestId('compare-audio-clean')
    .evaluate((el) => el.play().then(() => true).catch(() => false))
  await page.waitForTimeout(800)
  const cleanTime = await page.getByTestId('compare-audio-clean').evaluate((el) => el.currentTime)
  check(`${label}: clean compare audio plays`, cleanPlaying && cleanTime > 0)
  await page.getByTestId('compare-audio-clean').evaluate((el) => el.pause())

  // Run the comparison: two independent real Prisma calls.
  await page.getByTestId('run-comparison').click()
  await page.waitForSelector('[data-testid="comparison-results"]', { timeout: 120000 })
  const afterText = await page.textContent('body')
  check(`${label}: comparison results shown`, afterText.includes('Measured Evaluation Metrics'))
  check(`${label}: clean transcript shown`, afterText.includes('कृपया अपना OTP बताइये'))
  check(`${label}: noisy transcript shown`, afterText.includes('कृपया अपना OTP बताइये'))
  check(`${label}: real WER shown`, /Word Error Rate/.test(afterText) && /4\.3%/.test(afterText))
  check(`${label}: real CER shown`, /Character Error Rate/.test(afterText))
  check(`${label}: phrase recall shown`, /Important Phrase Recall/.test(afterText))
  check(`${label}: honest consistency note shown`, /ek jaise/.test(afterText))
  check(`${label}: no fake confidence claim`, !/confidence (score|percentage)/i.test(afterText))
  await noHorizontalOverflow(page, label, '/compare after results')
  await page.screenshot({ path: path.join(SHOTS, `phase8-compare-${label}.png`), fullPage: true })
  console.log(`  screenshot: phase8-compare-${label}.png`)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOTS, `phase8-compare-${label}-top.png`) })
  console.log(`  screenshot: phase8-compare-${label}-top.png`)

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
