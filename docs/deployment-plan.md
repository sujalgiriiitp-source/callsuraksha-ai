# CallSuraksha AI — Deployment Plan (Phase 10)

**Status:** READINESS ONLY. Nothing is deployed. No public URL exists.
**Recommended architecture:** single-service on **Render (free tier)** — one
web service builds the Vite frontend and runs the Express backend, which
serves `dist/` + `/api` from the same origin.

---

## 1. Why this architecture

The frontend calls the API with RELATIVE URLs (`/api/transcribe`,
`/api/guidance`, `/api/health`) and uses `BrowserRouter`. That means:

- Same-origin deployment needs **no CORS, no build-time API URL, no
  second service**. The server already serves the frontend in production
  (`NODE_ENV=production` + `dist/` present) with an SPA fallback.
- A split deployment (Vercel frontend + Render backend) would need
  `VITE_API_URL` at build time + `ALLOWED_ORIGINS` on the backend + two
  services to watch. More moving parts for zero benefit here.
- Vercel-only (serverless API) is REJECTED: the Express server would
  need a rewrite, and Vercel Hobby serverless functions cap at 10 s and
  ~4.5 MB payloads — the 5 MB upload + ~28 s TTS audio do not fit.

### Options compared (verified Oct 2026)

| Option | Cost | Pros | Cons | Verdict |
|---|---|---|---|---|
| **Render single-service (free)** | $0 | One service, one URL, no CORS, HTTPS + health check included, 750 free hrs/mo | Spins down after 15 min idle (~1 min wake), 512 MB RAM, ephemeral disk, Render says free is "not for production" | **RECOMMENDED for staging/demo** |
| Render single-service ($7/mo) | $7/mo | Same as above + no spin-down | Costs money (needs approval) | **RECOMMENDED for real production** |
| Vercel frontend + Render backend | $0 + $0 | Vercel CDN for static | Two services, CORS + VITE_API_URL, backend still sleeps on free | Not chosen |
| Railway single-service | $5 trial, then $1/mo min | Similar to Render | No real ongoing free tier (trial $5/30 days, then $1/mo buys ~100 MB RAM) — not free for an always-on app | Not chosen |
| Fly.io | Trial only | — | No ongoing free allowance for new orgs in 2026 | Not chosen |

**Free-tier limits that matter (Render, verified Oct 2026):** 15-min idle
spin-down (~1 min wake-up on next request); 750 free instance hours per
workspace per month (one service fits); 512 MB RAM / 0.1 CPU; 5 GB
bandwidth/month; ephemeral filesystem (nothing written to disk survives
— the app writes nothing to disk, so this is fine); no persistent disk;
outbound SMTP blocked (irrelevant — the app sends no email). No card is
needed for the free tier. Prices/terms change — re-check render.com
before launch.

---

## 2. Prerequisites (before ANY deploy)

1. **Audio assets on GitHub (BLOCKER — see §6).** The 7 WAVs are NOT on
   GitHub (text-only connector). Upload them via the GitHub web UI:
   repo → `public/samples/` → Add file → Upload files → drag the 6
   WAVs from `public/samples/` (+ `manifest.json` is already there) →
   Commit; then `public/compare/` → upload `bank-otp-noisy.wav`.
   Total ~5.4 MB, largest file 860 KB (web UI allows up to 25 MB/file).
   After upload, verify each file exists at its path on github.com.
2. **Dedicated production Gnani key.** At app.gnani.ai → API Keys →
   create a NEW key for production (separate from the dev/Vault key, so
   it can be revoked independently). Do NOT paste it in chat, git, or
   render.yaml. It goes in the Render dashboard only (§4).
3. **Phase 10 code backed up.** The Phase 10 changes (server hardening,
   render.yaml, this plan, e2e-production) are currently uncommitted
   locally + in the Phase 10 ZIP. Push them to the PRIVATE repo before
   deploying from GitHub (needs Sujal's approval — not done yet).

---

## 3. Hosting settings (Render)

- **Service type:** Web Service, **Runtime:** Node, **Plan:** free
  (staging) or $7/mo Starter (production, no spin-down).
- **Repository:** `sujalgiriiitp-source/callsuraksha-ai`, branch `main`.
- **Build command:** `npm install && npm run build`
  (installs root deps incl. Express + rate-limit; `tsc -b && vite build`
  produces `dist/` with the 7 WAVs + manifests).
- **Start command:** `npm start` (= `node server/index.js`).
- **Health check path:** `/api/health` (must return 200; it does even
  without a key, with `gnaniKeyConfigured: false`).
- **Node version:** `engines.node >= 20` in package.json; Render's
  default Node 22 works.
- **Blueprint:** `render.yaml` in the repo root creates the service with
  these settings ("New from Blueprint"). `GNANI_API_KEY` is declared
  with `sync: false` — Render asks for its value in the dashboard and
  never stores it in the file or git.
- **Ports:** the app listens on `process.env.PORT` (Render sets it
  automatically) on `0.0.0.0`. Do NOT hardcode a port. No other port
  is needed — frontend and API share the one service port.
- **HTTPS:** Render terminates TLS and issues a free certificate for
  `*.onrender.com` (and for a custom domain if added later).

## 4. Environment variables (Render dashboard → Environment)

| Variable | Value | Notes |
|---|---|---|
| `GNANI_API_KEY` | (production key from app.gnani.ai) | **REQUIRED.** Secret. Without it the API returns 503 `GNANI_KEY_NOT_CONFIGURED` and the frontend shows the honest "key not set" state. |
| `NODE_ENV` | `production` | Turns on single-service frontend serving + SPA fallback. Render defaults to production for Node, set it explicitly anyway. |
| `HOST` | `0.0.0.0` | So the host health check can reach the service. |
| `AI_ENABLED` | `true` | **REQUIRED since Phase A.** Only the exact value `true` enables the paid AI endpoints. Missing, empty or anything else blocks `/api/transcribe` + `/api/guidance` with 503 `AI_DISABLED` (fails closed). Emergency switch: set to `false` in the dashboard to stop all Gnani calls instantly — the service restarts, demo audio players keep working, only live analysis stops. |
| `STAGING_USER` + `STAGING_PASS` | (optional, strong random) | Set BOTH to password-protect the staging URL with HTTP basic auth (`/api/health` stays open for the health check). Leave unset for a public demo URL. |
| `ALLOWED_ORIGINS` | (leave empty) | Only for a split deployment (frontend on another origin). Same-origin needs none. |
| `PORT` | (do not set) | Render sets it automatically. |

### Phase A security (since 31 Oct 2026)
- **Combined rate limit:** 10 expensive AI requests per 15 minutes per IP, counted ACROSS `/api/transcribe` + `/api/guidance` together (one shared limiter). 11th request → 429 `RATE_LIMITED`.
- **Concurrency cap:** at most 2 Gnani calls at once (transcribe + guidance combined); a third caller gets 503 `SERVER_BUSY`.
- **Guidance binding:** `/api/guidance` takes only `{request_id, voice}`; the analysis comes from the server's receipt store (a real transcribe, 10-min TTL). Forged/missing ids → 400 `INVALID_REQUEST`; client-sent analysis objects are never trusted.
- **Server-side audio validation:** format + 5 MB size + WAV duration (RIFF header, max 30 s) checked before any Gnani call; over-long WAV → 400 `AUDIO_TOO_LONG`.
- **Emergency switch:** see `AI_ENABLED` above. Check the Gnani dashboard balance twice a week (no balance API exists); if credits drop unexpectedly, set `AI_ENABLED=false` and tell Muse.

## 5. API routing (single service)

| Route | Served by |
|---|---|
| `GET /` and any non-`/api` GET (`/demo`, `/results`, …) | `dist/index.html` (SPA fallback; direct loads + refreshes work) |
| `GET /assets/*`, `/samples/*`, `/compare/*`, `/favicon.svg`, `/icons.svg` | `express.static(dist/)` (ETag revalidation, no long cache) |
| `GET /api/health` | Express — `{status, gnaniKeyConfigured, keySource}` |
| `POST /api/transcribe` | Express → Prisma v3.0 + risk engine (AI_ENABLED gate + combined limit 10/15 min/IP + max 2 concurrent + WAV duration check) |
| `POST /api/guidance` | Express → Timbre v2.5 → WAV base64 (AI_ENABLED gate + combined limit 10/15 min/IP + max 2 concurrent; needs a valid transcribe `request_id`) |
| Unknown `/api/*` | JSON 404 `{error: NOT_FOUND}` |

## 6. Audio asset packaging (critical)

- The Vite build copies `public/` into `dist/`, so **a build from a
  checkout that HAS the WAVs ships all 7 WAVs + both manifests**.
  Verified: `dist/samples/` (6 WAVs) + `dist/compare/` (1 WAV).
- **The GitHub repo currently does NOT have the WAVs.** A Render
  deploy straight from GitHub today would build a `dist/` WITHOUT
  audio — the Demo page would 404 on playback and the manifests would
  point at missing files. **Do not deploy from GitHub until §2 item 1
  (web-UI upload) is done and verified.**
- After the upload, verify on github.com that all 7 files exist, then
  confirm in the Render build log that the build output contains them
  (or check `https://<service>/samples/manifest.json` + one WAV URL
  after deploy).
- Fallback if web-UI upload is impossible: regenerate at build time
  (`node scripts/generate-samples.mjs && node scripts/add-noise.mjs`
  — needs `GNANI_API_KEY` at build time and burns 6 TTS calls per
  deploy; the scripts currently use the Muse Vault helper, so they
  would need a small change to read the env key instead). Not
  recommended; web-UI upload is the clean path.
- The 4.7 MB asset ZIP (`callsuraksha-ai-assets-phase8.zip`) and the
  full-project ZIPs remain the offline backup of the WAVs.

## 7. Health checks

- **Render:** `GET /api/health` → 200 `{status:"ok", ...}`.
- **Manual (after deploy):** `curl https://<service>/api/health`
  should show `keySource: "env"` and `gnaniKeyConfigured: true` (with
  the production key set) — `vault` must NEVER appear in production.
- **Smoke test (after deploy, before announcing):** open the URL →
  Home shows "Server online · Gnani connected" → Demo → Analyze
  Sample → Results shows High Risk + real transcript → guidance plays
  → Compare runs. Full script: `scripts/e2e-production.mjs` with
  `PROD_URL=https://<service>` (it defaults to localhost:3001).

## 8. Secret setup (exact steps for Sujal)

1. Go to **app.gnani.ai** → sign in → **API Keys** → **Create key**
   (name it e.g. `callsuraksha-prod`) → copy the key value once.
2. Go to **Render dashboard** → service `callsuraksha-ai` →
   **Environment** → **Add Environment Variable** → key
   `GNANI_API_KEY`, value = the copied key → Save (Render redeploys).
3. Check `https://<service>/api/health` → `keySource: "env"`,
   `gnaniKeyConfigured: true`.
4. If the key ever leaks or the Vault/dev key is rotated, create a new
   production key and replace the value in the dashboard, then revoke
   the old one at app.gnani.ai. Never put the key in chat, email, git,
   render.yaml, or frontend code.
5. **Rate-limit reality check:** the server limits each IP to a COMBINED
   10 AI requests (transcribe + guidance together) per 15 minutes, but a
   public demo URL can still burn Gnani credits if many people use it.
   Watch the credit balance at app.gnani.ai; if it drops fast, set
   `AI_ENABLED=false` in Environment to stop paid AI calls at once, or
   take the service down from the Render dashboard (Suspend).

## 9. Rollback process

- **Code rollback:** Render dashboard → service → **Deploys** → pick
  the previous successful deploy → **Redeploy**. Or `git revert` the
  bad commit on `main` and push — Render auto-deploys `main`.
- **Key rollback:** replace `GNANI_API_KEY` in the dashboard with the
  previous working key (keep the old key unrevoked until the new one
  is proven).
- **Full stop:** Render dashboard → service → **Suspend** (stops the
  service; nothing is deleted; resume any time). The GitHub repo +
  ZIPs remain the source of truth.
- **No database, no disk state** — rollback is only code + env vars.

## 10. Expected limitations (honest)

- **Free tier spins down** after 15 min idle; the first visitor after
  a quiet spell waits ~1 min for the wake-up (Render shows a loading
  page). The 60-sec demo video should be recorded against a warm
  service (visit the URL first, or use the $7/mo plan).
- **No persistent storage:** results live in browser memory; a page
  refresh clears them (by design). No user accounts, no history.
- **Mic recordings (webm) still cannot be sent to Prisma** — the
  format gate rejects them honestly; upload a WAV/MP3 instead.
- **Prisma can garble or drop sentences** on noisy audio; the app
  shows the real transcript and never claims a partial transcript is
  "safe".
- **Timbre v2.5 speaks slowly** (~2 words/sec); guidance is ~28 s.
- **Rate limits are per-IP and demo-grade** — they slow abuse, they
  do not make the public endpoint abuse-proof (see §8.5).
- **Free-tier bandwidth is 5 GB/month** — the app is tiny (JS 395 kB,
  7 WAVs ~5.4 MB served per full demo run), so this binds only under
  heavy traffic.
- **Render's docs say free instances are not for production use.**
  Treat the free tier as staging/demo; the $7/mo instance is the
  honest "production" step.
