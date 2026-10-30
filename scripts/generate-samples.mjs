/**
 * CallSuraksha AI — demo sample generator (Phase 8).
 *
 * Generates the 6 synthetic demo samples with real Gnani Timbre TTS
 * (v2.5, Poorvi hi-en / Nalini hi-IN) and writes them as WAV files under
 * public/samples/. Every sample is a short, ethically generated synthetic
 * scenario — never a real phone call, never presented as a real customer
 * recording.
 *
 * How it works:
 *   1. Calls the Gnani connector helper (Vault credential, no key in
 *      this script) for each sample text -> raw s16le PCM (24 kHz mono).
 *   2. Wraps the PCM as WAV with the same server/wav.js used by the app.
 *   3. Writes public/samples/manifest.json (id, title, language, voice,
 *      model, script, duration, bytes, sha256) — the Demo page reads it.
 *
 * Usage:
 *   node scripts/generate-samples.mjs            # generate missing only
 *   node scripts/generate-samples.mjs --force    # regenerate everything
 *
 * The noisy comparison file is made separately by scripts/add-noise.mjs
 * from the bank-otp clean sample, so the compare pair shares one source.
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { pcmToWav } from '../server/wav.js'

const execFileAsync = promisify(execFile)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'samples')
const GNANI_HELPER = '/home/hatch/workspace/custom-connectors/custom.gnani/bin/gnani.py'
const FORCE = process.argv.includes('--force')

export const SAMPLES = [
  {
    id: 'bank-otp',
    title: 'Bank OTP Request',
    description:
      'Caller bank se bolne ka daava karta hai, account block ki dhamki deta hai aur turant OTP maangta hai.',
    category: 'OTP / Account threat',
    language: 'hi-IN',
    languageLabel: 'Hindi',
    voice: 'Nalini',
    model: 'timbre-v2.5',
    script:
      'नमस्ते, मैं आपके बैंक से बोल रहा हूँ। आपका account block हो गया है। कृपया अपना OTP बताइये, वरना आपका पैसा कट जाएगा।',
  },
  {
    id: 'upi-payment',
    title: 'Suspicious UPI Payment Request',
    description:
      'Caller ek UPI payment link bhejta hai aur turant paise bhejne ka dabav banata hai.',
    category: 'Payment pressure',
    language: 'hi-IN,en-IN',
    languageLabel: 'Hinglish',
    voice: 'Poorvi',
    model: 'timbre-v2.5',
    script:
      'Aapko ek UPI payment link bhej raha hoon. Turant 5,000 rupay bhej dijiye. Link par click karke payment karo, varna aapka account band ho jayega.',
  },
  {
    id: 'kyc-pressure',
    title: 'KYC Update Pressure',
    description:
      'Caller KYC update ke naam par Aadhaar number maangta hai aur account band karne ki dhamki deta hai.',
    category: 'Personal details',
    language: 'hi-IN,en-IN',
    languageLabel: 'Hinglish',
    voice: 'Poorvi',
    model: 'timbre-v2.5',
    script:
      'Namaste, main aapke bank se bol raha hoon. Aapka KYC update pending hai. Aaj hi apne Aadhaar number bhej dijiye, varna account band ho jayega.',
  },
  {
    id: 'customer-care',
    title: 'Customer Care Impersonation',
    description:
      'Caller telecom customer care hone ka daava karta hai aur verification ke naam par customer ID maangta hai.',
    category: 'Impersonation',
    language: 'hi-IN,en-IN',
    languageLabel: 'Hinglish',
    voice: 'Poorvi',
    model: 'timbre-v2.5',
    script:
      'Hello sir, main aapke telecom customer care se bol raha hoon. Aapke number ki verification pending hai. Apna customer ID share kijiye.',
  },
  {
    id: 'otp-advisory',
    title: 'OTP Safety Advisory',
    description:
      'Ek genuine safety message — OTP share na karne ki salah. Risk engine ko isey scam nahi bolna chahiye (negation test).',
    category: 'Safety advisory',
    language: 'hi-IN,en-IN',
    languageLabel: 'Hinglish',
    voice: 'Poorvi',
    model: 'timbre-v2.5',
    script:
      'Ye ek safety message hai. Apna OTP kisi ko mat batana. Bank kabhi phone par OTP nahi mangta. Shak ho to 1930 par report karo.',
  },
  {
    id: 'normal-info',
    title: 'Normal Informational Call',
    description:
      'Bank ki taraf se ek saadharan information call — naya debit card dispatch ki khabar, koi action nahi maanga gaya.',
    category: 'Informational',
    language: 'hi-IN',
    languageLabel: 'Hindi',
    voice: 'Nalini',
    model: 'timbre-v2.5',
    script:
      'नमस्ते, ये आपके बैंक की तरफ से एक information call है। आपका नया debit card आपके address पर भेज दिया गया है। कोई action की ज़रूरत नहीं है।',
  },
]

async function generateOne(sample) {
  const outPath = join(OUT_DIR, `${sample.id}.wav`)
  if (existsSync(outPath) && !FORCE) {
    console.log(`skip ${sample.id} (exists, use --force to regenerate)`)
    return null
  }
  const rawPath = `/tmp/callsuraksha-sample-${sample.id}.pcm`
  const { stdout } = await execFileAsync('python3', [
    GNANI_HELPER,
    'timbre',
    '--text',
    sample.script,
    '--voice',
    sample.voice,
    '--language',
    sample.language === 'hi-IN,en-IN' ? 'hi-en' : 'hi-IN',
    '--model',
    sample.model,
    '--out',
    rawPath,
  ])
  const info = JSON.parse(stdout)
  const pcm = readFileSync(rawPath)
  const wav = pcmToWav(pcm)
  writeFileSync(outPath, wav)
  const durationSeconds = Math.round((pcm.length / 2 / 24000) * 100) / 100
  const sha256 = createHash('sha256').update(wav).digest('hex')
  console.log(
    `generated ${sample.id}: ${info.bytes} PCM bytes -> ${wav.length} WAV bytes, ${durationSeconds}s, sha256 ${sha256.slice(0, 12)}…`,
  )
  return {
    ...sample,
    file: `samples/${sample.id}.wav`,
    durationSeconds,
    bytes: wav.length,
    sha256,
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const manifest = []
  for (const sample of SAMPLES) {
    const entry = await generateOne(sample)
    if (entry) {
      manifest.push(entry)
    } else {
      // Existing file: read its metadata for the manifest.
      const wav = readFileSync(join(OUT_DIR, `${sample.id}.wav`))
      const pcmBytes = wav.length - 44
      manifest.push({
        ...sample,
        file: `samples/${sample.id}.wav`,
        durationSeconds: Math.round((pcmBytes / 2 / 24000) * 100) / 100,
        bytes: wav.length,
        sha256: createHash('sha256').update(wav).digest('hex'),
      })
    }
  }
  // Safety: every sample must fit the Prisma / app limits.
  for (const entry of manifest) {
    if (entry.durationSeconds > 30) throw new Error(`${entry.id}: ${entry.durationSeconds}s exceeds the 30s limit`)
    if (entry.bytes > 5 * 1024 * 1024) throw new Error(`${entry.id}: exceeds the 5 MB limit`)
  }
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify({ samples: manifest }, null, 2) + '\n')
  console.log(`manifest written: ${manifest.length} samples`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('FAILED:', err.message)
    process.exit(1)
  })
}
