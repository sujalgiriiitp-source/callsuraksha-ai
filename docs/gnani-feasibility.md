# Gnani API Feasibility (local build — Lovable removed 30 Oct 2026)

Source: https://docs.gnani.ai (reviewed 30 Oct 2026). Status: **documented, not yet
verified with a real call** (Gnani API key not configured). No Gnani call is wired
into this app yet.

## Speech-to-text — Prisma

- Endpoint: `POST https://api.vachana.ai/stt/v3` (multipart/form-data)
- Auth header: `X-API-Key-ID: <key>` (server-side only, never in browser code)
- Models: `prisma-v3.0` (send `model=prisma-v3.0`), `prisma-v2.5` (default when
  `model` is omitted)
- Fields: `audio_file` (required), `language_code` (required; v3.0 accepts
  `indic-auto` or up to 4 comma-separated codes, e.g. `hi-IN,en-IN`; v2.5
  accepts ONE language only), `format` (`verbatim` | `transcribe` |
  v3.0-only `codemix`, `transliterate`)
- Formats: WAV, MP3, OGG, FLAC, AAC, M4A — detected from file extension
- Limits: **30 seconds per REST request**; minimum 0.1 s. Longer audio needs
  the Batch API (up to 4 h) or server-side chunking — neither is in the MVP.
- Response (v3.0): `{ success, request_id, transcript, model,
  detected_language_code, processing_time, end_to_end_latency }`.
  **No word timestamps and no per-word confidence on REST** — the app must
  never show them.
- Errors: `429 RATE_LIMITED` (some accounts allow 1 active request at a time,
  no Retry-After header); `401` missing/invalid key; `402` insufficient
  credit; `403` scope not allowed; `400` for bad model/language/format and
  `MAX_AUDIO_DURATION_EXCEEDED` over 30 s.

## Text-to-speech — Timbre

- Endpoint: `POST https://api.vachana.ai/api/v1/tts/inference` (JSON)
- Auth header: `X-API-Key-ID`
- Models: `timbre-v3.0` (voices e.g. Shivani, Avinash, Lakshmi), `timbre-v2.5`
  (voices e.g. Nalini, Kaveri, Deepak, Poorvi)
- Fields: `text`, `model`, `voice`, `language` (`hi-IN`, `hi-en`, `auto`, …),
  `speed` 0.85–1.15, `audio_config` (sample rate, container wav/mp3/ogg)
- Returns full audio in one response.
- Note: Poorvi is a **v2.5-only** voice. On v3.0, test a v3.0 voice (e.g.
  Shivani) with `language: hi-en` for Hinglish; Poorvi hi-en + Nalini hi-IN
  are the v2.5 fallback tests.

## Integration decision

- Both APIs are plain HTTPS + header key, so they can be called from a
  server-side layer. This local Vite app has **no backend yet** — a server
  layer (or a small backend service) is needed before any real Gnani call,
  because the key must never ship to the browser.
- Plan: Prisma v3.0 + Timbre v3.0 first, with v2.5 fallback if v3.0 access
  fails on the programme key.

## CORRECTION — MVP upload cap

The old Lovable Phase 0 plan doc said the transcribe function checks
"max 10 MB and duration max 3 min". That was **wrong** against the official
docs: the REST STT hard limit is 30 seconds
(`MAX_AUDIO_DURATION_EXCEEDED` over 30 s). The locked MVP cap is:

**max 5 MB, max 30 seconds.**

## Open items

- [ ] Add the Gnani API key as a server-side secret (never in chat, never in
      browser code, never in git). Secure link se maanga gaya hai — key abhi
      available nahi hai.
- [x] Build the server layer for Gnani calls (Phase 4 part 1, 30 Oct 2026) —
      `server/index.js`, `/api/health` + `/api/transcribe`, missing-key path
      tested (503). Real call abhi bhi pending hai (key chahiye).
- [ ] Run a real Timbre call and send its audio to Prisma (round-trip probe)
      once the key is set — v3.0 vs v2.5 aur `hi-IN` vs `hi-IN,en-IN` lock karo.
- [ ] Confirm v3.0 models are acceptable under competition rules (the
      challenge brief mentions v2.5).
- [ ] Confirm the programme credit balance / rate limits on app.gnani.ai.
