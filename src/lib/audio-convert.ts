/**
 * CallSuraksha AI — browser-side recording conversion (Phase B).
 *
 * Mic recordings come out as WebM/Opus in Chrome/Edge, but Gnani Prisma
 * accepts only WAV/MP3/OGG/FLAC/AAC/M4A. The conversion happens entirely
 * in the browser with the Web Audio API — no ffmpeg, no server change,
 * no new dependency:
 *
 *   Record (MediaRecorder) -> decode (AudioContext.decodeAudioData)
 *   -> resample to 16 kHz mono (OfflineAudioContext)
 *   -> encode PCM16 WAV (encodeWav, same 44-byte RIFF layout the
 *   server's wav.js uses) -> Preview (the converted WAV) -> Upload.
 *
 * Only erasable TypeScript is used here (no enums, no parameter
 * properties), so the plain-Node test (server/test-audio-convert.js)
 * can import the pure functions directly — exactly like metrics.ts.
 *
 * If the recorded format is ALREADY accepted by Prisma (Safari records
 * audio/mp4), the raw file is used directly — conversion is skipped.
 * If decoding or resampling fails, the caller gets a clear Error with
 * an honest message; nothing fake is ever uploaded.
 */

export const TARGET_SAMPLE_RATE = 16000 // locked Phase B target (verify: Prisma accepts 16 kHz WAV)
export const TARGET_CHANNELS = 1 // mono
export const TARGET_BITS_PER_SAMPLE = 16

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

/**
 * Pure: encode Float32 PCM samples (-1..1) as a 16-bit PCM WAV Blob.
 * Header is the standard 44-byte RIFF/WAVE layout (same as the server's
 * wav.js), so the server's own WAV-duration parser reads it back.
 * Samples are clipped to [-1, 1]; the blob is always mono 16 kHz when
 * called with the converted samples.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = TARGET_BITS_PER_SAMPLE / 8
  const blockAlign = TARGET_CHANNELS * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // audio format: PCM
  view.setUint16(22, TARGET_CHANNELS, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, TARGET_BITS_PER_SAMPLE, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += bytesPerSample
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Pure: map a recorded MIME type to an upload extension Prisma accepts,
 * or null when conversion is needed. The part after ';' (codecs) is
 * ignored. `audio/mp4` (Safari) maps to `m4a`, which the server accepts.
 */
export function acceptedExtensionForMime(mimeType: string): string | null {
  const base = mimeType.toLowerCase().split(';')[0].trim()
  if (base === 'audio/mp4' || base === 'audio/x-m4a') return 'm4a'
  if (base === 'audio/ogg') return 'ogg'
  if (base === 'audio/wav' || base === 'audio/x-wav') return 'wav'
  if (base === 'audio/mpeg' || base === 'audio/mp3') return 'mp3'
  if (base === 'audio/flac') return 'flac'
  if (base === 'audio/aac') return 'aac'
  return null
}

/**
 * Browser only: pick the best MediaRecorder MIME type this browser
 * supports, preferring Opus in WebM (Chrome/Edge/Firefox), then MP4
 * (Safari), then Ogg. Returns undefined when the browser reports
 * nothing — the caller then constructs MediaRecorder with no mimeType
 * and lets the browser choose its default.
 */
export function pickRecordingMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]
  for (const candidate of candidates) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
        return candidate
      }
    } catch {
      // isTypeSupported threw — treat this candidate as unsupported.
    }
  }
  return undefined
}

export type ConvertedRecording = {
  wavBlob: Blob
  durationSeconds: number
  originalDurationSeconds: number
  sampleRate: number
  channels: number
}

/**
 * Browser only: decode any recorded blob, resample it to 16 kHz mono,
 * and return a PCM16 WAV. Throws an Error with an honest, user-facing
 * message when the format cannot be decoded or the resample fails —
 * the caller shows that message instead of uploading anything fake.
 */
export async function convertRecordingToWav(blob: Blob): Promise<ConvertedRecording> {
  if (!blob || blob.size === 0) {
    throw new Error('Recording khaali hai (0 bytes) — koi audio capture nahi hua.')
  }
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const OfflineCtx =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext
  if (!AudioCtx || !OfflineCtx) {
    throw new Error('Is browser me audio conversion supported nahi hai — file upload karo.')
  }
  let ctx: AudioContext | null = null
  try {
    ctx = new AudioCtx()
    const arrayBuffer = await blob.arrayBuffer()
    let decoded: AudioBuffer
    try {
      decoded = await ctx.decodeAudioData(arrayBuffer)
    } catch {
      throw new Error(
        'Recording decode nahi ho payi — ye format is browser me supported nahi hai. File upload karo.',
      )
    }
    if (!decoded || decoded.duration <= 0 || decoded.numberOfChannels === 0) {
      throw new Error('Recording me koi awaaz nahi mili (0 seconds). Dobara record karo.')
    }
    const targetLength = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE))
    const offline = new OfflineCtx(TARGET_CHANNELS, targetLength, TARGET_SAMPLE_RATE)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start(0)
    let rendered: AudioBuffer
    try {
      rendered = await offline.startRendering()
    } catch {
      throw new Error('Audio convert nahi ho paya (resample fail hua). Dobara try karo ya file upload karo.')
    }
    const channelData = rendered.getChannelData(0)
    const wavBlob = encodeWav(channelData, TARGET_SAMPLE_RATE)
    return {
      wavBlob,
      durationSeconds: rendered.duration,
      originalDurationSeconds: decoded.duration,
      sampleRate: TARGET_SAMPLE_RATE,
      channels: TARGET_CHANNELS,
    }
  } finally {
    if (ctx) void ctx.close()
  }
}
