/**
 * CallSuraksha AI — Phase B audio conversion unit tests.
 *
 * Run: `npm run test:audio-convert` (or `npm test`).
 * Plain Node, no test runner. Exit 0 = all pass, 1 = any fail.
 *
 * Tests the PURE parts of src/lib/audio-convert.ts (imported directly —
 * the file uses only erasable TypeScript, same as metrics.ts):
 * WAV header fields, byte counts, clipping, and the MIME-type mapping.
 * The browser-only resample (OfflineAudioContext) cannot run in Node —
 * it is verified in the browser E2E (scripts/e2e-mic.mjs), which checks
 * the real converted WAV's sample rate, channels and duration, and then
 * sends it to real Prisma.
 *
 * One cross-check ties the two sides together: the WAV bytes produced
 * by encodeWav are parsed back by the SERVER's own wav-duration module
 * (server/wav-duration.js) — the same parser that gates uploads.
 */

import {
  acceptedExtensionForMime,
  encodeWav,
  TARGET_CHANNELS,
  TARGET_SAMPLE_RATE,
} from '../src/lib/audio-convert.ts'
import { wavDurationSeconds } from './wav-duration.js'

let passed = 0
let failed = 0
const failures = []
function check(name, cond, detail = '') {
  if (cond) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    failures.push(name)
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function wavBytes(samples, sampleRate = TARGET_SAMPLE_RATE) {
  const blob = encodeWav(samples, sampleRate)
  return Buffer.from(await blob.arrayBuffer())
}

console.log('== encodeWav: header ==')
{
  const bytes = await wavBytes(new Float32Array([0, 0.5, -0.5]))
  check('RIFF tag', bytes.toString('ascii', 0, 4) === 'RIFF')
  check('WAVE tag', bytes.toString('ascii', 8, 12) === 'WAVE')
  check('fmt tag', bytes.toString('ascii', 12, 16) === 'fmt ')
  check('data tag', bytes.toString('ascii', 36, 40) === 'data')
  check('audio format is PCM (1)', bytes.readUInt16LE(20) === 1)
  check('channels is 1 (mono)', bytes.readUInt16LE(22) === TARGET_CHANNELS)
  check('sample rate is 16000', bytes.readUInt32LE(24) === 16000)
  check('byte rate is 32000 (16000 x 1 x 2)', bytes.readUInt32LE(28) === 32000)
  check('block align is 2', bytes.readUInt16LE(32) === 2)
  check('bits per sample is 16', bytes.readUInt16LE(34) === 16)
  check('data size is samples x 2', bytes.readUInt32LE(40) === 3 * 2)
  check('RIFF size is 36 + data size', bytes.readUInt32LE(4) === 36 + 3 * 2)
  check('total length is 44 + data size', bytes.length === 44 + 3 * 2)
}

console.log('== encodeWav: samples + clipping ==')
{
  const bytes = await wavBytes(new Float32Array([1.5, -1.5, 0.5, -0.5, 0, 1, -1]))
  check('1.5 clips to 32767', bytes.readInt16LE(44) === 32767)
  check('-1.5 clips to -32768', bytes.readInt16LE(46) === -32768)
  check('0.5 -> 16383', bytes.readInt16LE(48) === 16383)
  check('-0.5 -> -16384', bytes.readInt16LE(50) === -16384)
  check('0 -> 0', bytes.readInt16LE(52) === 0)
  check('1 -> 32767', bytes.readInt16LE(54) === 32767)
  check('-1 -> -32768', bytes.readInt16LE(56) === -32768)
  const empty = await wavBytes(new Float32Array(0))
  check('empty samples -> 44-byte header only', empty.length === 44)
  check('empty samples -> data size 0', empty.readUInt32LE(40) === 0)
}

console.log('== encodeWav: server parser cross-check ==')
{
  const fiveSec = await wavBytes(new Float32Array(5 * 16000))
  const d5 = wavDurationSeconds(fiveSec)
  check('5 s of silence parses as 5.0 s by the server parser', d5 !== null && Math.abs(d5 - 5) < 0.01, `got ${d5}`)
  const thirtySec = await wavBytes(new Float32Array(30 * 16000))
  const d30 = wavDurationSeconds(thirtySec)
  check('30 s parses as 30.0 s (limit par allowed)', d30 !== null && Math.abs(d30 - 30) < 0.01, `got ${d30}`)
  const blob = encodeWav(new Float32Array([0.1, -0.1]), 16000)
  check('encodeWav returns an audio/wav Blob', blob.type === 'audio/wav')
}

console.log('== acceptedExtensionForMime ==')
{
  const cases = [
    ['audio/webm;codecs=opus', null],
    ['audio/webm', null],
    ['audio/mp4', 'm4a'],
    ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
    ['audio/ogg;codecs=opus', 'ogg'],
    ['audio/ogg', 'ogg'],
    ['audio/wav', 'wav'],
    ['audio/x-wav', 'wav'],
    ['audio/mpeg', 'mp3'],
    ['audio/mp3', 'mp3'],
    ['audio/flac', 'flac'],
    ['audio/aac', 'aac'],
    ['', null],
    ['video/webm', null],
    ['application/octet-stream', null],
  ]
  for (const [mime, expected] of cases) {
    check(
      `'${mime}' -> ${expected === null ? 'null (convert karo)' : expected}`,
      acceptedExtensionForMime(mime) === expected,
      `got ${acceptedExtensionForMime(mime)}`,
    )
  }
}

console.log('== constants ==')
{
  check('TARGET_SAMPLE_RATE is 16000', TARGET_SAMPLE_RATE === 16000)
  check('TARGET_CHANNELS is 1 (mono)', TARGET_CHANNELS === 1)
}

console.log(`\n==== Audio-convert tests: ${passed} passed, ${failed} failed ====`)
if (failures.length) console.log('Failures:', failures.join(' | '))
process.exit(failed ? 1 : 0)
