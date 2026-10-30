/**
 * CallSuraksha AI — Gnani API reference constants (client-safe).
 *
 * NO API key lives here. No Gnani call is wired yet: a real call needs the
 * Gnani API key, which must stay server-side only and is NOT configured.
 * Integration is NOT working yet — see docs/gnani-feasibility.md.
 *
 * Verified against https://docs.gnani.ai on 30 Oct 2026.
 */

// Prisma — speech-to-text (REST, short recorded clips only)
export const GNANI_STT_URL = 'https://api.vachana.ai/stt/v3'
export const PRISMA_MODEL_V3 = 'prisma-v3.0'
// Prisma v2.5 is the default when `model` is omitted.
export const PRISMA_MODEL_V2 = 'prisma-v2.5'
// v3.0 accepts `indic-auto` or 1–4 comma-separated codes, e.g. 'hi-IN,en-IN'.
// v2.5 accepts ONE language code only.
export const PRISMA_LANGUAGE_V3 = 'hi-IN,en-IN'
export const PRISMA_LANGUAGE_V2 = 'hi-IN'
// Hard REST limit: 30 seconds per call. Locked MVP cap: max 5 MB, max 30 s.
// REST response carries only success / request_id / transcript (+ model,
// detected_language_code, timings on v3.0) — NO word timestamps, NO
// per-word confidence. The app must never show those.

// Timbre — text-to-speech (REST, full audio in one response)
export const GNANI_TTS_URL = 'https://api.vachana.ai/api/v1/tts/inference'
export const TIMBRE_MODEL_V3 = 'timbre-v3.0'
export const TIMBRE_MODEL_V2 = 'timbre-v2.5'
// v2.5 voices: Poorvi (Hinglish, hi-en), Nalini (Hindi, hi-IN),
// Kaveri, Deepak. v3.0 voices: Shivani, Avinash, Lakshmi — each speaks
// all 10 languages. Poorvi is v2.5-only; on v3.0 test a v3.0 voice
// (e.g. Shivani) with language 'hi-en'.
export const TIMBRE_VOICE_HINGLISH_V2 = 'Poorvi'
export const TIMBRE_VOICE_HINDI_V2 = 'Nalini'
export const TIMBRE_VOICE_HINGLISH_V3 = 'Shivani'

export const GNANI_AUTH_HEADER = 'X-API-Key-ID'

// Locked MVP upload cap (corrected — see docs/gnani-feasibility.md).
export const MVP_MAX_FILE_MB = 5
export const MVP_MAX_DURATION_SECONDS = 30
