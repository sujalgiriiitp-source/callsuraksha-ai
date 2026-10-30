/**
 * CallSuraksha AI — raw PCM to WAV wrapper (Phase 7).
 *
 * Gnani Timbre returns RAW s16le PCM (mono, 24,000 Hz) — not a WAV file.
 * Browsers cannot play raw PCM directly, so the server wraps it in a
 * standard 44-byte RIFF/WAVE header before sending it to the frontend.
 * Verified format from the 31 Oct 2026 API tests: s16le, mono, 24 kHz.
 */

export const TIMBRE_SAMPLE_RATE = 24000
export const TIMBRE_CHANNELS = 1
export const TIMBRE_BITS_PER_SAMPLE = 16

/** Wrap raw s16le PCM bytes in a WAV file. Trims a trailing odd byte. */
export function pcmToWav(
  pcm,
  { sampleRate = TIMBRE_SAMPLE_RATE, channels = TIMBRE_CHANNELS, bitsPerSample = TIMBRE_BITS_PER_SAMPLE } = {},
) {
  const bytesPerSample = bitsPerSample / 8
  const frameSize = channels * bytesPerSample
  let data = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm)
  // A 16-bit sample is 2 bytes — drop a dangling final byte, if any.
  if (data.length % frameSize !== 0) {
    data = data.subarray(0, data.length - (data.length % frameSize))
  }
  const dataSize = data.length
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // PCM format chunk size
  header.writeUInt16LE(1, 20) // audio format: PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * frameSize, 28) // byte rate
  header.writeUInt16LE(frameSize, 32) // block align
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, data])
}

/** Duration in seconds of raw s16le PCM at the Timbre sample rate. */
export function pcmDurationSeconds(pcmBytes, sampleRate = TIMBRE_SAMPLE_RATE) {
  return pcmBytes / 2 / sampleRate
}
