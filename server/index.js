/**
 * CallSuraksha AI — server layer (Phase 4, complete; Phase 10 production hardening).
 *
 * Plain Node + Express. The Gnani API key is resolved Vault-first: the
 * server asks the runtime credential service (authd) for a surrogate for
 * the registered `custom.gnani` connection (see vault-key.js) and sends
 * that surrogate as the API header — the runtime egress swaps it for the
 * real key. The real key is never in a file, never logged, never returned
 * in any response, and never sent to the browser. Only when authd is
 * unreachable (e.g. running the project on a MacBook, where there is no
 * Vault — and on ANY production host, where there is no Vault either)
 * does the server fall back to the `GNANI_API_KEY` environment variable.
 * Production MUST set GNANI_API_KEY in the host's secret store.
 *
 * Endpoints:
 *   GET  /api/health      -> { status: "ok", gnaniKeyConfigured: boolean, keySource: "vault" | "env" | "none" }
 *   POST /api/transcribe  -> multipart audio_file -> real Prisma STT + risk analysis
 *   POST /api/guidance    -> JSON { analysis, voice } -> real Timbre TTS (WAV, base64)
 *
 * Production behaviour (Phase 10):
 *   - `NODE_ENV=production` + a built `dist/` -> the server also serves
 *     the Vite frontend and the SPA fallback from the SAME origin, so the
 *     frontend's relative `/api/...` calls work with no CORS and no
 *     build-time API URL. In dev (no NODE_ENV=production) Vite serves
 *     the frontend and proxies /api here, exactly as before.
 *   - Rate limiting on the two Gnani-backed endpoints (20 req / 15 min
 *     per IP each) so one visitor cannot burn the Gnani credit pool.
 *     /api/health is NOT rate-limited (hosts use it as a health check).
 *   - Optional staging basic auth: set BOTH STAGING_USER and
 *     STAGING_PASS to gate the whole service (except /api/health).
 *   - Optional CORS: set ALLOWED_ORIGINS (comma-separated) only when
 *     the frontend is hosted on a different origin; same-origin
 *     deployments need no CORS at all.
 *   - Upstream Gnani calls time out after 30 s; the HTTP server times
 *     out after 60 s; SIGTERM/SIGINT shut down gracefully.
 *
 * Audio is processed in memory only (multer memoryStorage). Nothing is
 * written to disk and there is no database. Logs carry one line per
 * request (ok/fail + status) — never transcript text, never the key.
 */

import 'dotenv/config'
import express from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import {
  invalidateVaultCredential,
  isVaultAvailable,
  resolveGnaniCredential,
} from './vault-key.js'
import { analyzeTranscript } from './risk-engine.js'
import { buildGuidanceScript, GUIDANCE_VOICES } from './guidance-script.js'
import { pcmDurationSeconds, pcmToWav } from './wav.js'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'
const GNANI_STT_URL = 'https://api.vachana.ai/stt/v3'
const GNANI_TTS_URL = 'https://api.vachana.ai/api/v1/tts/inference'
const MAX_BYTES = 5 * 1024 * 1024 // locked MVP cap: max 5 MB
// How long the server waits for Gnani before giving up (Prisma ~2 s,
// Timbre a few seconds; 30 s is generous and prevents hung requests).
const GNANI_TIMEOUT_MS = 30_000

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

async function getKeySource() {
  if (await isVaultAvailable()) return 'vault'
  const envKey = process.env.GNANI_API_KEY
  if (envKey && envKey.trim()) return 'env'
  return 'none'
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
app.disable('x-powered-by')
// Behind Render/Railway there is one proxy hop; without this, req.ip
// would be the proxy's address and per-IP rate limiting would be useless.
app.set('trust proxy', 1)
app.use(express.json({ limit: '100kb' }))

// ---- Security headers (no new dependency; API responses are never cached).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store')
  next()
})

// ---- Optional staging gate: set BOTH STAGING_USER and STAGING_PASS to
// protect the whole service with HTTP basic auth. Off by default.
// /api/health stays open so the host's health check keeps working.
const STAGING_USER = process.env.STAGING_USER
const STAGING_PASS = process.env.STAGING_PASS
function timingSafeEqual(a, b) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}
if (STAGING_USER && STAGING_PASS) {
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next()
    const header = req.headers.authorization ?? ''
    const [scheme, encoded] = header.split(' ')
    let ok = false
    if (scheme === 'Basic' && encoded) {
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
        const sep = decoded.indexOf(':')
        const user = sep >= 0 ? decoded.slice(0, sep) : ''
        const pass = sep >= 0 ? decoded.slice(sep + 1) : ''
        ok = timingSafeEqual(user, STAGING_USER) && timingSafeEqual(pass, STAGING_PASS)
      } catch {
        ok = false
      }
    }
    if (!ok) {
      res.setHeader('WWW-Authenticate', 'Basic realm="CallSuraksha staging"')
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Staging login chahiye.' })
    }
    next()
  })
}

// ---- Optional CORS: same-origin deployments need none. Set
// ALLOWED_ORIGINS (comma-separated, exact origins) only when the frontend
// is hosted on a different origin. Never a wildcard, no credentials.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
if (ALLOWED_ORIGINS.length > 0) {
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
    if (req.method === 'OPTIONS') return res.status(204).end()
    next()
  })
}

// ---- Rate limiting on the Gnani-backed endpoints only. Each Gnani call
// costs programme credits, so one visitor must not be able to fire
// hundreds of them. /api/health is exempt (hosts use it for health
// checks). Limits are demo-appropriate, not a substitute for watching
// the Gnani credit balance — see the deployment plan.
const gnaniLimiter = (endpoint) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Bahut saari requests — 15 minute rukkar dobara try karo.',
      })
    },
  })
const transcribeLimiter = gnaniLimiter('transcribe')
const guidanceLimiter = gnaniLimiter('guidance')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
})

app.get('/api/health', async (_req, res) => {
  const keySource = await getKeySource()
  res.json({ status: 'ok', gnaniKeyConfigured: keySource !== 'none', keySource })
})

app.post('/api/transcribe', transcribeLimiter, upload.single('audio_file'), async (req, res) => {
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

  // 5. Credential present? Vault-first; env fallback; else the honest
  //    missing-key path (503). The credential value is never logged.
  let credential = await resolveGnaniCredential()
  if (!credential) {
    console.log('[transcribe] fail status=503 GNANI_KEY_NOT_CONFIGURED')
    return res.status(503).json({
      error: 'GNANI_KEY_NOT_CONFIGURED',
      message: 'Gnani key not set — server par key configure karo, phir dobara try karo.',
    })
  }

  // 6. Forward to real Prisma STT. Node 24 has global fetch/FormData/Blob.
  //    On a 401 with a Vault surrogate, refetch once (rotation-safe).
  let upstream
  let retried = false
  try {
    const sendToGnani = async () => {
      const form = new FormData()
      form.append(
        'audio_file',
        new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }),
        file.originalname,
      )
      form.append('model', model)
      form.append('language_code', languageCode)
      form.append('format', 'transcribe')
      return fetch(GNANI_STT_URL, {
        method: 'POST',
        headers: { [credential.headerName]: credential.value },
        body: form,
        signal: AbortSignal.timeout(GNANI_TIMEOUT_MS),
      })
    }

    upstream = await sendToGnani()
    if (upstream.status === 401 && credential.source === 'vault' && !retried) {
      retried = true
      invalidateVaultCredential()
      const fresh = await resolveGnaniCredential()
      if (fresh) {
        credential = fresh
        upstream = await sendToGnani()
      }
    }

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
    // timestamps, confidence, or any percentage — plus the Phase 5
    // risk analysis of the real transcript (rule-based, explainable).
    const transcript = typeof data?.transcript === 'string' ? data.transcript : ''
    console.log(`[transcribe] ok status=200 model=${data?.model ?? 'unknown'}`)
    return res.json({
      success: true,
      request_id: data?.request_id ?? null,
      transcript,
      model: data?.model ?? model,
      detected_language_code: data?.detected_language_code ?? null,
      processing_time: data?.processing_time ?? null,
      end_to_end_latency: data?.end_to_end_latency ?? null,
      analysis: analyzeTranscript(transcript),
    })
  } catch (err) {
    // AbortSignal.timeout() surfaces as a TimeoutError — a slow Gnani,
    // not a broken network. Map it to 504 like the upstream timeout.
    if (err?.name === 'TimeoutError') {
      console.log('[transcribe] fail status=504 upstream_timeout')
      return res.status(504).json({
        error: 'UPSTREAM_TIMEOUT',
        message: 'Gnani se jawab time par nahi aaya — dobara try karo.',
      })
    }
    console.log('[transcribe] fail status=502 network_error')
    return res.status(502).json({
      error: 'NETWORK_ERROR',
      message: 'Gnani se connect nahi ho paya — network check karke dobara try karo.',
    })
  }
})

// Phase 7 — voice guidance. The spoken script is built ONLY from the
// real risk analysis (band, categories, safe steps) — never invented, and
// never a fraud claim. Timbre returns raw s16le PCM (mono, 24 kHz); the
// server wraps it as WAV before sending it to the browser. On a TTS
// failure the script is still returned, so the frontend can show the text
// guidance instead of breaking.
app.post('/api/guidance', guidanceLimiter, async (req, res) => {
  const analysis = req.body?.analysis
  const voiceKey = req.body?.voice === 'nalini' ? 'nalini' : 'poorvi'

  let guidance
  try {
    guidance = buildGuidanceScript(analysis, voiceKey)
  } catch (err) {
    console.log(`[guidance] fail status=400 ${err?.message ?? 'invalid analysis'}`)
    return res.status(400).json({
      error: 'INVALID_ANALYSIS',
      message: 'Risk analysis sahi nahi hai — pehle call analyze karo, phir guidance mango.',
    })
  }

  let credential = await resolveGnaniCredential()
  if (!credential) {
    console.log('[guidance] fail status=503 GNANI_KEY_NOT_CONFIGURED')
    return res.status(503).json({
      error: 'GNANI_KEY_NOT_CONFIGURED',
      message: 'Gnani key not set — server par key configure karo, phir dobara try karo.',
      script: guidance.script,
      voice: guidance.voice,
      model: guidance.model,
      language: guidance.language,
    })
  }

  try {
    const sendToTimbre = async () =>
      fetch(GNANI_TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CallSuraksha-AI/1.0',
          [credential.headerName]: credential.value,
        },
        body: JSON.stringify({
          text: guidance.script,
          model: guidance.model,
          voice: guidance.voice,
          language: guidance.language,
          speed: 1.0,
        }),
        signal: AbortSignal.timeout(GNANI_TIMEOUT_MS),
      })

    let upstream = await sendToTimbre()
    // On a 401 with a Vault surrogate, refetch once (rotation-safe).
    if (upstream.status === 401 && credential.source === 'vault') {
      invalidateVaultCredential()
      const fresh = await resolveGnaniCredential()
      if (fresh) {
        credential = fresh
        upstream = await sendToTimbre()
      }
    }

    if (!upstream.ok) {
      const detail = await gnaniErrorDetail(upstream)
      const status = upstream.status
      const messages = {
        401: 'Gnani key invalid ya missing hai — key check karo.',
        402: 'Gnani credits khatam ho gaye — balance check karo.',
        403: 'Is key ko TTS ki permission nahi hai — scope check karo.',
        429: 'Gnani rate limit — thoda rukkar dobara try karo.',
        504: 'Gnani se jawab time par nahi aaya — dobara try karo.',
      }
      console.log(`[guidance] fail status=${status} detail=${detail}`)
      return res.status(status).json({
        error: detail,
        message: messages[status] ?? 'Voice guidance nahi ban payi — text guidance padho.',
        script: guidance.script,
        voice: guidance.voice,
        model: guidance.model,
        language: guidance.language,
      })
    }

    const pcm = Buffer.from(await upstream.arrayBuffer())
    if (pcm.length === 0) {
      console.log('[guidance] fail status=502 empty_audio')
      return res.status(502).json({
        error: 'EMPTY_AUDIO',
        message: 'Gnani se khaali audio aaya — dobara try karo.',
        script: guidance.script,
        voice: guidance.voice,
        model: guidance.model,
        language: guidance.language,
      })
    }
    const wav = pcmToWav(pcm)
    const durationSeconds = pcmDurationSeconds(pcm.length)
    console.log(
      `[guidance] ok status=200 voice=${guidance.voice} duration=${durationSeconds.toFixed(1)}s`,
    )
    return res.json({
      success: true,
      script: guidance.script,
      voice: guidance.voice,
      model: guidance.model,
      language: guidance.language,
      audioMime: 'audio/wav',
      audioBase64: wav.toString('base64'),
      durationSeconds: Math.round(durationSeconds * 100) / 100,
      pcmBytes: pcm.length,
    })
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      console.log('[guidance] fail status=504 upstream_timeout')
      return res.status(504).json({
        error: 'UPSTREAM_TIMEOUT',
        message: 'Gnani se jawab time par nahi aaya — dobara try karo.',
        script: guidance.script,
        voice: guidance.voice,
        model: guidance.model,
        language: guidance.language,
      })
    }
    console.log('[guidance] fail status=502 network_error')
    return res.status(502).json({
      error: 'NETWORK_ERROR',
      message: 'Gnani se connect nahi ho paya — network check karke dobara try karo.',
      script: guidance.script,
      voice: guidance.voice,
      model: guidance.model,
      language: guidance.language,
    })
  }
})

// Unknown /api route -> JSON 404, never the SPA page or Express HTML.
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Ye API route nahi hai.' })
})

// ---- Single-service production frontend (Phase 10).
// Only when NODE_ENV=production AND a Vite build exists: serve dist/ and
// fall back to index.html for every non-/api GET (BrowserRouter needs
// this so a refresh on /demo or /results still loads the app). In dev
// this stays off — Vite serves the frontend and proxies /api here.
const DIST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
)
const DIST_INDEX = path.join(DIST_DIR, 'index.html')
const serveFrontend = process.env.NODE_ENV === 'production' && fs.existsSync(DIST_INDEX)
if (serveFrontend) {
  // ETag-based revalidation (default); no long max-age, so a redeploy
  // with new audio assets is picked up without stale caches.
  // redirect:false matters: dist/ has real directories named `compare`
  // and `samples`, and without it express.static 301-redirects the SPA
  // route /compare to /compare/ instead of serving the app.
  app.use(express.static(DIST_DIR, { index: false, redirect: false }))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(DIST_INDEX)
  })
}

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

const server = app.listen(PORT, HOST, async () => {
  console.log(`CallSuraksha server listening on http://${HOST}:${PORT}`)
  const keySource = await getKeySource()
  console.log(`Gnani key configured: ${keySource !== 'none'} (source: ${keySource})`)
  if (serveFrontend) console.log(`Serving frontend from ${DIST_DIR} (single-service mode)`)
})
// A hung client must not hold a connection forever; 60 s covers the
// 30 s Gnani timeout plus processing time.
server.timeout = 60_000
server.keepAliveTimeout = 5_000

// Graceful shutdown (Render sends SIGTERM on redeploy / spin-down).
let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[server] ${signal} received — shutting down`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
