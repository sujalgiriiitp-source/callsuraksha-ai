# CallSuraksha AI

**Tagline:** "Call Suno, Risk Samjho."

Recorded Hindi / Hinglish / English phone calls ko samjho — Gnani Prisma
transcript, explainable risk indicators, aur Hindi safety guidance.
Built for Gnani AI — The Great Indian AI Internship Challenge 2026.
Submission deadline: **10 Nov 2026, 11:59 PM IST**.

> Lovable is OUT (30 Oct 2026 — Sujal's call). This app is built locally
> with Vite + React + TypeScript + Tailwind CSS. The old Lovable project is
> abandoned and is not used here.

## Run it

```bash
npm install
npm run dev      # frontend dev server, usually http://localhost:5173
npm run server   # Express server for Gnani calls, http://localhost:3001
npm run build    # production build (tsc + vite build)
npm run preview  # serve the production build locally
```

Frontend + server **dono** chahiye: dev me Vite `/api` calls ko local server
(port 3001) par proxy karta hai (see `vite.config.ts`). Production
deployment is out of scope for this phase.

### Gnani key (server-side only)

```bash
cp .env.example .env   # phir .env me apni real key daalo
```

Key sirf server ke `.env` me rehti hai — `.env` gitignored hai, key kabhi
chat / git / browser code me nahi jati. Bina key ke server chalta hai, par
`/api/transcribe` 503 `GNANI_KEY_NOT_CONFIGURED` deta hai (yehi honest
missing-key path hai).

## What is built (Phase 1 + Phase 2 + Phase 3)

- Foundation: Vite + React + TS + Tailwind v4, react-router-dom, lucide-react.
- Design tokens (exact): background `#050D1C`, secondary `#0A1830`, card
  `#101D35`, orange `#FF6A2C`, red `#F3345E`, blue `#377BFF`, purple
  `#8B5CF6`, green `#11CFA8`, text `#F8FAFC`, muted `#94A3B8`. Inter body,
  Sora headings, glass cards, dark cinematic.
- Routes: `/`, `/analyze`, `/results`, `/guidance`, `/compare`, `/demo`,
  `/how-it-works`, `/about`. Top nav only + mobile bottom nav, no sidebar.
- Shared components: `AppHeader`, `MobileNav`, `Disclaimer` (always
  visible), `GlowCard`.
- **Home page (`/`) is fully built** — hero, 5-step How It Works strip,
  What it does / does NOT do, demo samples teaser, safety & privacy strip.
- **Analyze page (`/analyze`) is fully built (Phase 3) and wired to the server
  (Phase 4)** — drag-and-drop + browse upload (WAV/MP3/OGG/FLAC/AAC/M4A, max
  5 MB / 30 s, real measured duration), mic recording via MediaRecorder
  (30 s auto-stop, preview, discard/re-record), required language select
  (Hindi / Hinglish / English — no auto-detect), required consent checkbox,
  inline dismissible error states. Analyze dabane par file `/api/transcribe`
  ko bheji jati hai: real loading state, phir Prisma ka ASLI transcript
  (transcript, model, detected language, processing time, request ID) ya
  server ka ASLI error. Koi fake transcript, risk band ya progress nahi.
  Mic webm/opus recordings Prisma ko reject ho sakti hain — conversion abhi
  pending hai.
- **Server layer (`server/`, Phase 4 part 1)** — plain Node + Express,
  in-memory audio only (kuch disk/DB par store nahi hota). `GET /api/health`
  (sirf `gnaniKeyConfigured` boolean batata hai), `POST /api/transcribe`
  (server-side validation: format, max 5 MB, language/model rules; key
  missing ho to 503 `GNANI_KEY_NOT_CONFIGURED`; key ho to real Prisma STT
  `POST https://api.vachana.ai/stt/v3` forward karta hai, sirf asli response
  fields wapas deta hai, Gnani errors 401/402/403/429/400/504 honestly map
  karta hai). Key sirf server ke `process.env` (local `.env`) se padhi jati
  hai — kabhi log nahi hoti, kabhi response me nahi aati.
- `src/lib/gnani.ts` — verified Gnani endpoint/model constants only. No key,
  no API call wired yet.
- `docs/gnani-feasibility.md` — endpoints, models, limits, error codes, and
  the corrected MVP cap (**max 5 MB, max 30 seconds**).

## What is placeholder

- `/results` (Phase 6), `/guidance` (Phase 7),
  `/compare` + `/demo` (Phase 8), `/how-it-works` detail and `/about`
  full pages — honest "Phase X me banega" pages with working nav back home.
- No fake scores, no accuracy %, no phone numbers, no dates, no made-up
  stats anywhere in the app.

## Honest limits

- This is a **risk-flag analysis** of recorded calls — never a fraud
  verdict. No live call interception, no caller identification, no deepfake
  detection, no auto-reporting to police/bank.
- Synthetic or consented recordings only. Audio is not stored.

## Blocker — Gnani API key (real call abhi bhi pending)

Server layer + Analyze wiring **poori tarah taiyaar** hai, par real Gnani
call abhi tak **ek bhi baar nahi hui**: koi API key configure nahi hai, aur
is task me key available nahi thi. Missing-key path test hua hai (503
`GNANI_KEY_NOT_CONFIGURED`), par integration ko "working" tabhi mark kiya
jayega jab key set karke ek asli Prisma call succeed hogi. Key Sujal ko
secure connector link se maangi gayi hai — kabhi chat me paste mat karo.

## Next

1. **Blocked step (alag):** key `.env` me set karo, phir ek asli Prisma
   call test karo (v3.0 vs v2.5, `hi-IN` vs `hi-IN,en-IN`) aur lock karo.
2. **Phase 5:** risk engine (sentence-level, negation-aware) + uske tests.
3. **Phase 6:** Results page.
