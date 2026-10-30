/**
 * CallSuraksha AI — server layer (Phase 4, part 1).
 *
 * Plain Node + Express. The Gnani API key is read ONLY from process.env
 * (local `.env` via dotenv, if present). It is never logged, never returned
 * in any response, and never sent to the browser.
 *
 * Endpoints:
 *   GET  /api/health      -> { status: "ok", gnaniKeyConfigured: boolean }
 *   POST /api/transcribe  -> multipart audio_file -> real Prisma STT
 *
 * Audio is processed in memory only (multer memoryStorage). Nothing is
 * written to disk and there is no database. Logs carry one line per
 * request (ok/fail + status) — never transcript text, never the key.
 *
 * No key is configured yet, so POST /api/transcribe currently returns
 * 503 GNANI_KEY_NOT_CONFIGURED. That is the honest missing-key path, not
 * a failure of the wiring. A real Gnani call is a separate blocked step
 * that needs the key set in a local `.env` (see .env.example).
 */

import 'dotenv/config'
import express from 'express'
import multer from 'multer'

const PORT = Number(process.env.PORT ?? 3001)
const GNANI_STT_URL = 'https://api.vachana.ai/stt/v3'
const MAX_BYTES = 5 * 1024 * 1024 // locked MVP cap: max 5 MB

const ACCEPTED_EXTS = new Set(['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a'])
// MIME types browsers commonly report for the accepted formats.
const ACCEPTED_MIMES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
])

function getGnaniKey() {
  const key = process.env.GNANI_API_KEY
  return key && key.trim() ? key.trim() : undefined
}

function getExtension(filename) {
  const parts = String(filename ?? '').toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

/** Short, safe message from a Gnani error body — never the raw body. */
async function gnaniErrorDetail(res) {
  try {
    const body = await res.json()
    const type = body?.error?.type
    const message = body?.error?.message ?? body?.message
    const detail = body?.detail
    if (typeof type === 'string' && type) return type
    if (typeof message === 'string' && message) return message.slice(0, 160)
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).slice(0, 160)
    return 'gnani_error'
  } catch {
    return 'gnani_error'
  }
}

const app = express()
app.use(express.json({ limit: '100kb' }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', gnaniKeyConfigured: Boolean(getGnaniKey()) })
})

app.post('/api/transcribe', upload.single('audio_file'), async (req, res) => {
  // 1. File present?
  const file = req.file
  if (!file || file.size === 0) {
    return res.status(400).json({
      error: 'NO_FILE',
      message: 'Koi audio file nahi mili — pehle file upload ya record karo.',
    })
  }

  // 2. Format: extension is the primary gate (Gnani itself detects the
  //    format from the file extension). The MIME type is only a soft check:
  //    reject it when it is clearly a non-audio type. `application/octet-
  //    stream` is a generic fallback some clients send for audio files and
  //    must NOT cause a rejection. Mic webm/opus is NOT in the accepted
  //    list (no webm extension) and is rejected here honestly (conversion
  //    is still pending work).
  const ext = getExtension(file.originalname)
  const mime = (file.mimetype ?? '').toLowerCase()
  const mimeClearlyNotAudio =
    mime !== '' &&
    mime !== 'application/octet-stream' &&
    !ACCEPTED_MIMES.has(mime) &&
    (mime.startsWith('text/') ||
      mime.startsWith('image/') ||
      mime.startsWith('video/') ||
      mime.startsWith('application/'))
  if (!ACCEPTED_EXTS.has(ext) || mimeClearlyNotAudio) {
    return res.status(400).json({
      error: 'UNSUPPORTED_FORMAT',
      message: `Format supported nahi hai: "${ext || 'unknown'}". Sirf WAV, MP3, OGG, FLAC, AAC, M4A accept hote hain.`,
    })
  }

  // 3. Size (multer already enforces the 5 MB limit; this is a second check).
  if (file.size > MAX_BYTES) {
    return res.status(400).json({
      error: 'FILE_TOO_LARGE',
      message: 'File bahut badi hai — limit max 5 MB hai.',
    })
  }

  // 4. Language + model rules.
  const rawLanguage = String(req.body?.language_code ?? '').trim()
  const rawModel = String(req.body?.model ?? '').trim()
  // Default is Prisma v3.0. Explicit v2.5 is allowed; anything else is rejected.
  const model = rawModel === '' ? 'prisma-v3.0' : rawModel
  if (model !== 'prisma-v3.0' && model !== 'prisma-v2.5') {
    return res.status(400).json({
      error: 'INVALID_MODEL',
      message: 'Model sirf prisma-v3.0 ya prisma-v2.5 ho sakta hai.',
    })
  }
  const codes = rawLanguage
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  if (codes.length === 0) {
    return res.status(400).json({
      error: 'INVALID_LANGUAGE_CODE',
      message: 'Language code chahiye — Hindi, Hinglish ya English chuno.',
    })
  }
  if (model === 'prisma-v2.5' && codes.length !== 1) {
    return res.status(400).json({
      error: 'INVALID_LANGUAGE_CODE',
      message: 'Prisma v2.5 sirf ek language accept karta hai — Hinglish (hi-IN,en-IN) ke liye v3.0 chuno.',
    })
  }
  if (codes.length > 4) {
    return res.status(400).json({
      error: 'INVALID_LANGUAGE_CODE',
      message: 'Prisma v3.0 zyada se zyada 4 languages accept karta hai.',
    })
  }
  const languageCode = codes.join(',')

  // 5. Key present? This is the missing-key path tested in Phase 4 part 1.
  const key = getGnaniKey()
  if (!key) {
    console.log('[transcribe] fail status=503 GNANI_KEY_NOT_CONFIGURED')
    return res.status(503).json({
      error: 'GNANI_KEY_NOT_CONFIGURED',
      message: 'Gnani key not set — server par key configure karo, phir dobara try karo.',
    })
  }

  // 6. Forward to real Prisma STT. Node 24 has global fetch/FormData/Blob.
  try {
    const form = new FormData()
    form.append(
      'audio_file',
      new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }),
      file.originalname,
    )
    form.append('model', model)
    form.append('language_code', languageCode)
    form.append('format', 'transcribe')

    const upstream = await fetch(GNANI_STT_URL, {
      method: 'POST',
      headers: { 'X-API-Key-ID': key },
      body: form,
    })

    if (!upstream.ok) {
      const detail = await gnaniErrorDetail(upstream)
      // Map the upstream status honestly; never leak the key or raw body.
      const status = upstream.status
      const messages = {
        400: 'Gnani ne request reject ki.',
        401: 'Gnani key invalid ya missing hai — key check karo.',
        402: 'Gnani credits khatam ho gaye — balance check karo.',
        403: 'Is key ko STT ki permission nahi hai — scope check karo.',
        429: 'Gnani rate limit — thoda rukkar dobara try karo.',
        504: 'Gnani se jawab time par nahi aaya — dobara try karo.',
      }
      console.log(`[transcribe] fail status=${status} detail=${detail}`)
      return res.status(status).json({
        error: detail,
        message: messages[status] ?? 'Transcription fail hui — dobara try karo.',
      })
    }

    const data = await upstream.json()
    // Return ONLY the real Prisma response fields — never invent
    // timestamps, confidence, or any percentage.
    console.log(`[transcribe] ok status=200 model=${data?.model ?? 'unknown'}`)
    return res.json({
      success: true,
      request_id: data?.request_id ?? null,
      transcript: typeof data?.transcript === 'string' ? data.transcript : '',
      model: data?.model ?? model,
      detected_language_code: data?.detected_language_code ?? null,
      processing_time: data?.processing_time ?? null,
      end_to_end_latency: data?.end_to_end_latency ?? null,
    })
  } catch {
    console.log('[transcribe] fail status=502 network_error')
    return res.status(502).json({
      error: 'NETWORK_ERROR',
      message: 'Gnani se connect nahi ho paya — network check karke dobara try karo.',
    })
  }
})

// Multer errors (e.g. file over 5 MB) -> honest 400, not a crash.
app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'FILE_TOO_LARGE',
      message: 'File bahut badi hai — limit max 5 MB hai.',
    })
  }
  if (err?.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'INVALID_UPLOAD',
      message: 'Sirf ek audio file (field: audio_file) bhejo.',
    })
  }
  console.log(`[server] fail status=500 error=${err?.code ?? 'unknown'}`)
  return res.status(500).json({
    error: 'SERVER_ERROR',
    message: 'Server me error aaya — dobara try karo.',
  })
})

app.listen(PORT, () => {
  console.log(`CallSuraksha server listening on http://localhost:${PORT}`)
  console.log(`Gnani key configured: ${Boolean(getGnaniKey())}`)
})
