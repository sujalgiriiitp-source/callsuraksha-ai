/**
 * CallSuraksha AI — noisy version generator (Phase 8).
 *
 * Makes the noisy half of the Clean vs Noisy comparison from the clean
 * bank-otp sample: the SAME audio with controlled white noise added.
 * The spoken script is never altered — only background noise is mixed in.
 *
 * Method (all genuinely measured, nothing invented):
 * - Reads the clean WAV (16-bit mono 24 kHz), computes its RMS level.
 * - Generates white noise with a seeded PRNG (mulberry32, fixed seed —
 *   reproducible) scaled so the mix hits the target SNR.
 * - Mixes sample-by-sample, clamps to 16-bit range, writes the WAV.
 * - Prints the measured RMS levels and the computed SNR, and writes
 *   public/compare/manifest.json with those numbers.
 *
 * Usage:
 *   node scripts/add-noise.mjs [--snr 12] [--force]
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pcmToWav } from '../server/wav.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLEAN = join(ROOT, 'public', 'samples', 'bank-otp.wav')
const OUT_DIR = join(ROOT, 'public', 'compare')
const OUT = join(OUT_DIR, 'bank-otp-noisy.wav')
const SEED = 20261031

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rms(samples) {
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

function main() {
  const targetSnrDb = Number(process.argv.find((a) => a.startsWith('--snr='))?.split('=')[1] ?? 12)
  const force = process.argv.includes('--force')
  if (existsSync(OUT) && !force) {
    console.log('noisy file exists (use --force to regenerate)')
    return
  }
  const wav = readFileSync(CLEAN)
  if (wav.toString('ascii', 0, 4) !== 'RIFF') throw new Error('clean file is not a WAV')
  const data = wav.subarray(44)
  const n = data.length / 2
  const clean = new Int16Array(n)
  for (let i = 0; i < n; i++) clean[i] = data.readInt16LE(i * 2)
  const signalRms = rms(clean)
  // Noise RMS for the target SNR: SNR = 20*log10(signalRms / noiseRms).
  const noiseRms = signalRms / Math.pow(10, targetSnrDb / 20)
  const rand = mulberry32(SEED)
  const noisy = new Int16Array(n)
  let noiseSum = 0
  for (let i = 0; i < n; i++) {
    // White noise, uniform in [-1, 1] (RMS 1/sqrt(3)); scale to noiseRms.
    const noise = (rand() * 2 - 1) * noiseRms * Math.sqrt(3)
    noiseSum += noise * noise
    let v = clean[i] + noise
    if (v > 32767) v = 32767
    if (v < -32768) v = -32768
    noisy[i] = Math.round(v)
  }
  const measuredNoiseRms = Math.sqrt(noiseSum / n)
  const measuredSnrDb = 20 * Math.log10(signalRms / measuredNoiseRms)
  const pcm = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) pcm.writeInt16LE(noisy[i], i * 2)
  const out = pcmToWav(pcm)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT, out)
  const durationSeconds = Math.round((n / 24000) * 100) / 100
  const manifest = {
    sourceSample: 'bank-otp',
    referenceTranscript:
      'नमस्ते, मैं आपके बैंक से बोल रहा हूँ। आपका account block हो गया है। कृपया अपना OTP बताइये, वरना आपका पैसा कट जाएगा।',
    importantPhrases: ['OTP', 'account block', 'बैंक'],
    noise: {
      type: 'white noise (seeded PRNG, seed 20261031)',
      targetSnrDb,
      measuredSnrDb: Math.round(measuredSnrDb * 100) / 100,
      signalRms: Math.round(signalRms * 100) / 100,
      noiseRms: Math.round(measuredNoiseRms * 100) / 100,
      method: 'SNR computed from the actual clean-signal and added-noise RMS levels (20*log10(signal/noise)).',
    },
    clean: { file: 'samples/bank-otp.wav', durationSeconds, bytes: wav.length },
    noisy: {
      file: 'compare/bank-otp-noisy.wav',
      durationSeconds,
      bytes: out.length,
      sha256: createHash('sha256').update(out).digest('hex'),
    },
  }
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`noisy written: ${out.length} bytes, ${durationSeconds}s`)
  console.log(`signal RMS ${manifest.noise.signalRms}, noise RMS ${manifest.noise.noiseRms}, measured SNR ${manifest.noise.measuredSnrDb} dB`)
}

main()
