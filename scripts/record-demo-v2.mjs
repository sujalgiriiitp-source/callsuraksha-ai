/** Phase 11 demo — recording TAKE 2 (slower, demo-paced).
 * v1 proved the pipeline (real footage + real AI) but moved too fast for the
 * ~72s voiceover. v2 holds each beat longer so footage maps ~1:1 to the VO:
 * Home ~18s, Demo+click ~13s, Results ~19s, guidance play 9s, Compare ~8s,
 * How It Works ~8s. Fresh production server on :3001 first.
 * `node scripts/record-demo-v2.mjs` — output: demo/raw/take2.webm + guidance
 * blob + recording-log-v2.json
 */
import { chromium } from 'playwright-core'
import { writeFileSync, mkdirSync } from 'node:fs'

const EXE = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'
const APP = 'http://localhost:3001'
const OUT = '/home/hatch/workspace/gnani-ai-challenge/demo/raw'
mkdirSync(OUT, { recursive: true })

const log = []
const t0 = Date.now()
const stamp = (action) => {
  const s = ((Date.now() - t0) / 1000).toFixed(1)
  log.push({ t: Number(s), action })
  console.log(`[${s}s] ${action}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function slowScroll(page, dy, steps = 16, stepMs = 150) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps)
    await sleep(stepMs)
  }
}

const browser = await chromium.launch({ executablePath: EXE })
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
})
const page = await ctx.newPage()

// --- Home (~18s) ---
await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(5000)
stamp('home hero visible')
await slowScroll(page, 700)
stamp('home scrolled to feature cards')
await page.waitForTimeout(5000)
await slowScroll(page, -700)
await page.waitForTimeout(2500)
stamp('home back to top')

// --- Demo page + sample (~8s before click) ---
await page.getByRole('link', { name: 'Demo', exact: true }).first().click()
await page.waitForURL('**/demo', { timeout: 15000 })
await page.waitForTimeout(2500)
stamp('demo page, 6 samples visible')
await page.getByTestId('analyze-sample-bank-otp').scrollIntoViewIfNeeded()
await page.waitForTimeout(2000)
stamp('bank OTP sample in view')
await page.getByTestId('analyze-sample-bank-otp').click()
stamp('CLICKED analyze-sample-bank-otp (real Prisma call starts)')
await page.waitForURL('**/results', { timeout: 60000 })
stamp('navigated to /results')
await page.waitForSelector('text=High Risk', { timeout: 30000 })
stamp('High Risk band visible (real analysis)')
await page.waitForTimeout(4000)
stamp('transcript visible, hold')

// --- Results: indicators + safe steps (~15s) ---
await slowScroll(page, 600)
stamp('scrolled to indicator cards')
await page.waitForTimeout(4000)
await slowScroll(page, 500)
stamp('scrolled to safe steps + why-risky cards')
await page.waitForTimeout(4000)
await slowScroll(page, -1100)
await page.waitForTimeout(1500)

// --- Guidance: wait ready, play 9s ---
await page.waitForSelector('text=Guidance taiyaar hai', { timeout: 60000 })
stamp('guidance READY (real Timbre)')
await page.getByTestId('guidance-play').scrollIntoViewIfNeeded()
await page.waitForTimeout(1000)
await page.getByTestId('guidance-play').click()
stamp('CLICKED guidance play (real Timbre audio playing)')
await page.waitForTimeout(9000)
stamp('guidance played ~9s, progress advanced')

// --- Save the guidance audio blob (no extra API call) ---
const b64 = await page.evaluate(async () => {
  const audio = document.querySelector('audio[data-testid="guidance-audio"]')
  if (!audio || !audio.src) return null
  const buf = await fetch(audio.src).then((r) => r.arrayBuffer())
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
})
if (b64) {
  writeFileSync(`${OUT}/guidance-clip-full-v2.wav`, Buffer.from(b64, 'base64'))
  stamp('guidance audio blob saved (guidance-clip-full-v2.wav)')
} else {
  stamp('WARNING: guidance audio blob NOT saved')
}

// --- Compare (~8s) ---
await page.goto(`${APP}/compare`, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
stamp('compare page, SNR badge visible')
await slowScroll(page, 400)
await page.waitForTimeout(3000)
stamp('compare panels in view')

// --- How It Works (~8s) ---
await page.getByRole('link', { name: 'How It Works', exact: true }).first().click()
await page.waitForURL('**/how-it-works', { timeout: 15000 })
await page.waitForTimeout(3000)
stamp('how-it-works page, 5 steps visible')
await slowScroll(page, 600)
await page.waitForTimeout(3000)
stamp('how-it-works scrolled')

await page.waitForTimeout(1000)
stamp('recording done — closing context (video saves now)')
await ctx.close()
await browser.close()

writeFileSync(`${OUT}/recording-log-v2.json`, JSON.stringify(log, null, 2))
console.log('LOG WRITTEN:', `${OUT}/recording-log-v2.json`)
