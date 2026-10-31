/**
 * CallSuraksha AI — WAV duration from the RIFF header (Phase A).
 *
 * The server must validate audio duration itself — the client's duration
 * check is not enough, because a client can send anything. A WAV file
 * carries everything needed in its header (sample rate, channels, bits
 * per sample, data size), so no decoding and no dependency is needed.
 * Returns the duration in seconds, or null when the buffer is not a
 * parseable WAV (the caller then lets it through — Prisma rejects an
 * over-long clip with 400 as the backstop, and a malformed file fails
 * there too).
 */

export const MAX_AUDIO_DURATION_SECONDS = 30 // locked MVP cap

export function wavDurationSeconds(buffer) {
  if (!buffer || buffer.length < 44) return null
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') return null
  // Walk the chunks: 'fmt ' carries sample rate/channels/bits, 'data'
  // carries the byte count. Chunks are word-aligned (odd sizes pad 1).
  let offset = 12
  let channels = null
  let sampleRate = null
  let bitsPerSample = null
  let dataSize = null
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    if (id === 'fmt ') {
      if (size >= 16 && offset + 24 <= buffer.length) {
        channels = buffer.readUInt16LE(offset + 10)
        sampleRate = buffer.readUInt32LE(offset + 12)
        bitsPerSample = buffer.readUInt16LE(offset + 22)
      }
    } else if (id === 'data') {
      dataSize = size
      break
    }
    offset += 8 + size + (size % 2)
  }
  if (!channels || !sampleRate || !bitsPerSample || dataSize === null) return null
  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8)
  if (bytesPerSecond <= 0) return null
  return dataSize / bytesPerSecond
}
