import { chromium } from 'playwright-core'
const APP = 'http://127.0.0.1:3001'
const OUT = '/home/hatch/workspace/gnani-ai-challenge/ui-verification/phaseC'
const EXE = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'
const b = await chromium.launch({ executablePath: EXE })
for (const [label, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } })
  const page = await ctx.newPage()
  const shots = [
    ['home', '/'], ['analyze', '/analyze'], ['results-empty', '/results'],
    ['demo', '/demo'], ['compare', '/compare'],
    ['how-it-works', '/how-it-works'], ['about', '/about'], ['guidance', '/guidance'],
  ]
  for (const [name, path] of shots) {
    await page.goto(APP + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/${name}-${label}.png`, fullPage: true })
    console.log('saved', `${name}-${label}.png`)
  }
  // Results with a real analysis (via Demo sample)
  await page.goto(APP + '/demo', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Bank OTP Request', { timeout: 15000 })
  await page.getByTestId('analyze-sample-bank-otp').click()
  await page.waitForURL('**/results', { timeout: 60000 })
  await page.waitForTimeout(9000) // let guidance generate
  await page.screenshot({ path: `${OUT}/results-${label}.png`, fullPage: true })
  console.log('saved', `results-${label}.png`)
  await ctx.close()
}
await b.close()
console.log('done')
