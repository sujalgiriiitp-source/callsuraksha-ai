import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Download,
  FileAudio,
  HelpCircle,
  Info,
  Lightbulb,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import { GlowCard } from '../components/GlowCard'
import { VoiceGuidance } from '../components/VoiceGuidance'
import {
  categoryLabel,
  getLastAnalysis,
  languageLabel,
  type RiskBand,
  type RiskHighlight,
} from '../lib/analysis'

/** Mirror of the server-side sentence splitter (risk-engine.js). */
function splitSentences(transcript: string): string[] {
  return transcript
    .replace(/\.{2,}/g, ' ')
    .replace(/…/g, ' ')
    .split(/[।.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'Unknown'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatAnalyzedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Abhi abhi'
  return (
    d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }) + ' IST'
  )
}

const BAND_STYLE: Record<
  RiskBand,
  { label: string; text: string; border: string; bg: string; icon: typeof AlertTriangle }
> = {
  High: {
    label: 'High Risk',
    text: 'text-[#F3345E]',
    border: 'border-[#F3345E]/50',
    bg: 'bg-[#F3345E]/10',
    icon: AlertTriangle,
  },
  Medium: {
    label: 'Medium Risk',
    text: 'text-[#FF6A2C]',
    border: 'border-[#FF6A2C]/50',
    bg: 'bg-[#FF6A2C]/10',
    icon: AlertTriangle,
  },
  Low: {
    label: 'Low Risk',
    text: 'text-[#11CFA8]',
    border: 'border-[#11CFA8]/50',
    bg: 'bg-[#11CFA8]/10',
    icon: ShieldCheck,
  },
  'Unable to Assess': {
    label: 'Unable to Assess',
    text: 'text-[#94A3B8]',
    border: 'border-white/25',
    bg: 'bg-white/5',
    icon: HelpCircle,
  },
}

function severityChip(severity: RiskHighlight['severity']) {
  return severity === 'high' ? (
    <span className="rounded-full bg-[#F3345E]/15 px-2 py-0.5 text-xs font-semibold text-[#F3345E]">
      High severity
    </span>
  ) : (
    <span className="rounded-full bg-[#FF6A2C]/15 px-2 py-0.5 text-xs font-semibold text-[#FF6A2C]">
      Medium severity
    </span>
  )
}

export function Results() {
  const navigate = useNavigate()
  const [stored] = useState(() => getLastAnalysis())
  const [tab, setTab] = useState<'transcript' | 'insights'>('transcript')
  const [activeHighlight, setActiveHighlight] = useState<number | null>(null)

  // No analysis in this session — honest empty state, never fake data.
  if (!stored) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#FF6A2C]">
          Analysis Results
        </p>
        <h1 className="font-display mt-3 text-3xl font-bold sm:text-4xl">Abhi koi analysis nahi hai</h1>
        <p className="mt-3 leading-relaxed text-[#94A3B8]">
          Is session me abhi koi call analyze nahi hui hai. Results page sirf tabhi bharta hai
          jab Analyze page se real Gnani Prisma analysis chalti hai — yahan koi pre-generated ya
          fake result nahi dikhaya jata.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/analyze')}
            className="bg-gradient-brand rounded-xl px-6 py-3 font-semibold text-white"
          >
            Analyze a call
          </button>
          <Link
            to="/"
            className="rounded-xl border border-white/15 px-6 py-3 font-semibold hover:bg-white/5"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  const { result } = stored
  const analysis = result.analysis
  const band = BAND_STYLE[analysis.riskBand]
  const BandIcon = band.icon
  const sentences = splitSentences(result.transcript)
  const highlightIndexBySentence = new Map<string, number[]>()
  analysis.highlights.forEach((h, i) => {
    const list = highlightIndexBySentence.get(h.sentence) ?? []
    list.push(i)
    highlightIndexBySentence.set(h.sentence, list)
  })

  // Group highlights by category for the breakdown (real counts, no scores).
  const byCategory = new Map<string, { count: number; severity: 'high' | 'medium' }>()
  analysis.highlights.forEach((h) => {
    const entry = byCategory.get(h.category) ?? { count: 0, severity: h.severity }
    entry.count += 1
    if (h.severity === 'high') entry.severity = 'high'
    byCategory.set(h.category, entry)
  })

  function jumpToIndicator(index: number) {
    setActiveHighlight(index)
    document.getElementById(`indicator-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 sm:py-16">
      {/* Header — mirrors the Analysis Results reference */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#377BFF]">
          Analysis Results
        </p>
        <h1 className="font-display mt-3 text-3xl font-bold sm:text-5xl">
          Analysis <span className="text-gradient-brand">Results</span>
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-[#94A3B8]">
          Aapki uploaded call ka asli Gnani Prisma analysis — transcript, risk indicators aur
          safety guidance. Koi score ya percentage nahi hai: jo dikh raha hai, wo transcript se
          seedha nikla hai.
        </p>
      </section>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start">
        {/* Middle column first on mobile: the risk verdict. On desktop it sits
            in the centre (cols 4–8), matching the reference layout. */}
        <div className="order-1 space-y-6 lg:order-none lg:col-span-5 lg:col-start-4 lg:row-start-1">
          {/* Overall Risk Level */}
          <GlowCard className={band.border}>
            <p className="text-sm font-medium text-[#94A3B8]">Overall Risk Level</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${band.bg}`}>
                <BandIcon className={`h-7 w-7 ${band.text}`} aria-hidden />
              </span>
              <p className={`font-display text-4xl font-bold ${band.text}`}>{band.label}</p>
            </div>
            <p className="mt-4 leading-relaxed text-[#F8FAFC]">{analysis.reason}</p>
            {analysis.riskBand === 'Low' && (
              <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-[#94A3B8]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Low risk ka matlab ye guarantee nahi hai ki call safe hai — hamesha verify karein.
              </p>
            )}
            <dl className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[#94A3B8]">Language</dt>
                <dd className="mt-0.5 font-medium">
                  {languageLabel(stored.language)}
                  {result.detected_language_code
                    ? ` · detected: ${result.detected_language_code}`
                    : ''}
                </dd>
              </div>
              <div>
                <dt className="text-[#94A3B8]">Duration</dt>
                <dd className="mt-0.5 font-medium">{formatDuration(stored.durationSeconds)}</dd>
              </div>
              <div>
                <dt className="text-[#94A3B8]">{stored.cached ? 'Cached result — analyzed on' : 'Analyzed on'}</dt>
                <dd className="mt-0.5 font-medium">{formatAnalyzedAt(stored.analyzedAt)}</dd>
                {stored.cached && (
                  <dd className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
                    Ye purana analysis hai — is baar naya API call nahi hua.
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-[#94A3B8]">Model</dt>
                <dd className="mt-0.5 font-medium">{result.model}</dd>
              </div>
            </dl>
          </GlowCard>

          {/* Risk Breakdown — qualitative categories, no scores */}
          <GlowCard>
            <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
              <ShieldAlert className="h-5 w-5 text-[#FF6A2C]" aria-hidden /> Risk Breakdown
            </h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Transcript me mile risk signals — category ke hisaab se. Ye scores nahi hain, sirf
              mile hue signals ki ginti hai.
            </p>
            {analysis.riskBand === 'Unable to Assess' ? (
              <div className="mt-5 rounded-xl border border-white/15 bg-white/5 px-4 py-4">
                <p className="flex items-start gap-2 text-sm leading-relaxed">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
                  Evidence kam hai — transcript bahut chhota ya samajh me nahi aaya, isliye risk
                  judge nahi kar sakte. Iska matlab ye nahi hai ki call safe hai. Saaf audio se
                  dobara record karke analyze karo.
                </p>
              </div>
            ) : byCategory.size === 0 ? (
              <p className="mt-5 rounded-xl border border-[#11CFA8]/30 bg-[#11CFA8]/5 px-4 py-4 text-sm leading-relaxed">
                Koi risk pattern nahi mila — lekin ye guarantee nahi hai ki call safe hai.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {[...byCategory.entries()].map(([category, entry]) => (
                  <li
                    key={category}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <span className="font-medium">{categoryLabel(category)}</span>
                    <span className="flex items-center gap-2 text-sm text-[#94A3B8]">
                      {entry.count} {entry.count === 1 ? 'signal' : 'signals'}
                      {severityChip(entry.severity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlowCard>

          {/* Why this is risky — evidence-linked indicator cards */}
          {analysis.highlights.length > 0 && (
            <GlowCard className="border-[#F3345E]/30">
              <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                <AlertTriangle className="h-5 w-5 text-[#F3345E]" aria-hidden /> Why this is risky
              </h2>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Har indicator transcript ke exact sentence se juda hai — sentence par click karke
                yahan aao, ya yahan se wapas transcript dekho.
              </p>
              <ol className="mt-5 space-y-4">
                {analysis.highlights.map((h, i) => (
                  <li
                    key={`${h.category}-${i}`}
                    id={`indicator-${i}`}
                    className={`scroll-mt-24 rounded-xl border px-4 py-4 transition-colors ${
                      activeHighlight === i
                        ? 'border-[#FF6A2C]/70 bg-[#FF6A2C]/10'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-gradient-brand flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white">
                        {i + 1}
                      </span>
                      <p className="font-semibold">{categoryLabel(h.category)}</p>
                      {severityChip(h.severity)}
                    </div>
                    <blockquote className="mt-3 rounded-lg bg-black/30 px-3 py-2 text-sm leading-relaxed text-[#F8FAFC]">
                      “{h.sentence}”
                    </blockquote>
                    <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{h.reason}</p>
                    <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#11CFA8]" aria-hidden />
                      <span>
                        <span className="font-medium text-[#11CFA8]">Precaution: </span>
                        {h.precaution}
                      </span>
                    </p>
                  </li>
                ))}
              </ol>
            </GlowCard>
          )}
        </div>

        {/* Left column: uploaded call + transcript (desktop cols 1–3) */}
        <div className="order-2 space-y-6 lg:order-none lg:col-span-3 lg:col-start-1 lg:row-start-1">
          <GlowCard>
            <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
              <FileAudio className="h-5 w-5 text-[#FF6A2C]" aria-hidden /> Uploaded Call
            </h2>
            <p className="mt-3 break-all font-medium">{stored.fileName}</p>
            <p className="mt-1 text-sm text-[#94A3B8]">
              {stored.format} · {formatDuration(stored.durationSeconds)} ·{' '}
              {(stored.fileSize / 1024).toFixed(1)} KB
            </p>
            <audio controls src={stored.audioUrl} className="mt-4 w-full" aria-label="Uploaded call playback" />
            <a
              href={stored.audioUrl}
              download={stored.fileName}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[#94A3B8] hover:bg-white/5"
            >
              <Download className="h-4 w-4" aria-hidden /> Download audio
            </a>
            <dl className="mt-4 grid gap-2 border-t border-white/10 pt-4 text-xs text-[#94A3B8]">
              <div className="flex justify-between gap-2">
                <dt>Processing time</dt>
                <dd className="font-medium text-[#F8FAFC]">
                  {result.processing_time !== null ? `${result.processing_time.toFixed(2)} s` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Latency</dt>
                <dd className="font-medium text-[#F8FAFC]">
                  {result.end_to_end_latency !== null ? `${result.end_to_end_latency.toFixed(2)} s` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Request ID</dt>
                <dd className="break-all text-right font-medium text-[#F8FAFC]">
                  {result.request_id ?? '—'}
                </dd>
              </div>
            </dl>
          </GlowCard>

          <GlowCard>
            <div role="tablist" aria-label="Transcript views" className="flex flex-wrap gap-2">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'transcript'}
                onClick={() => setTab('transcript')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  tab === 'transcript' ? 'bg-gradient-brand text-white' : 'border border-white/15 hover:bg-white/5'
                }`}
              >
                Transcript
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'insights'}
                onClick={() => setTab('insights')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  tab === 'insights' ? 'bg-gradient-brand text-white' : 'border border-white/15 hover:bg-white/5'
                }`}
              >
                AI Insights
              </button>
            </div>

            {tab === 'transcript' ? (
              <div className="mt-5">
                {sentences.length === 0 ? (
                  <p className="rounded-xl border border-[#F3345E]/40 bg-[#F3345E]/10 px-4 py-3 text-sm leading-relaxed" role="alert">
                    Khali transcript — audio me koi speech nahi mili. Iska matlab ye nahi hai ki
                    call safe thi; risk judge karne ke liye evidence hi nahi hai.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-[#94A3B8]">
                      Gnani Prisma ka asli transcript. Highlighted lines par click karo — uska
                      indicator card dikhega.
                    </p>
                    <div className="mt-4 space-y-2">
                      {sentences.map((sentence) => {
                        const indices = highlightIndexBySentence.get(sentence)
                        const worst = indices?.length
                          ? analysis.highlights[indices[0]].severity
                          : null
                        const advisory = analysis.advisories.includes(sentence)
                        return (
                          <button
                            key={sentence}
                            type="button"
                            disabled={!indices?.length}
                            onClick={() => indices?.length && jumpToIndicator(indices[0])}
                            className={`block w-full rounded-lg px-3 py-2 text-left text-[15px] leading-relaxed transition-colors ${
                              worst === 'high'
                                ? 'bg-[#F3345E]/20 text-[#F8FAFC] ring-1 ring-[#F3345E]/50 hover:bg-[#F3345E]/30'
                                : worst === 'medium'
                                  ? 'bg-[#FF6A2C]/20 text-[#F8FAFC] ring-1 ring-[#FF6A2C]/50 hover:bg-[#FF6A2C]/30'
                                  : advisory
                                    ? 'bg-[#11CFA8]/10 text-[#F8FAFC] ring-1 ring-[#11CFA8]/30'
                                    : 'bg-white/[0.03] text-[#F8FAFC]'
                            }`}
                          >
                            {sentence}
                            {worst && (
                              <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                                {worst === 'high' ? 'High risk signal' : 'Medium risk signal'} — details ke
                                liye click karo
                              </span>
                            )}
                            {advisory && !worst && (
                              <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-[#11CFA8]">
                                Safety advisory
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[#94A3B8]">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      Prisma word timestamps ya speaker labels nahi deta, isliye transcript me na
                      time dikhaya gaya hai, na “Caller / You” — sirf jo bola gaya, wahi hai.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-4 text-sm leading-relaxed">
                <p>{analysis.reason}</p>
                {analysis.advisories.length > 0 && (
                  <div>
                    <p className="font-semibold text-[#11CFA8]">Safety warnings mile</p>
                    <ul className="mt-2 space-y-1.5 text-[#94A3B8]">
                      {analysis.advisories.map((a) => (
                        <li key={a} className="rounded-lg bg-[#11CFA8]/10 px-3 py-2 text-[#F8FAFC]">
                          “{a}”
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[#94A3B8]">
                      Ye lines caller ki dhamki nahi, safety ki salah hain — isliye inhe risk nahi
                      mana gaya.
                    </p>
                  </div>
                )}
                <div>
                  <p className="font-semibold">Signals mile: {analysis.highlights.length}</p>
                  <p className="mt-1 text-[#94A3B8]">
                    High severity: {analysis.highlights.filter((h) => h.severity === 'high').length}
                    {' · '}Medium severity:{' '}
                    {analysis.highlights.filter((h) => h.severity === 'medium').length}
                  </p>
                </div>
                <p className="text-[#94A3B8]">
                  Analysis deterministic rules se hua hai — koi AI confidence score ya accuracy
                  percentage invent nahi kiya gaya.
                </p>
              </div>
            )}
          </GlowCard>
        </div>

        {/* Right column: voice guidance (Phase 7, real Timbre) + safe actions (desktop cols 9–12) */}
        <div className="order-3 space-y-6 lg:order-none lg:col-span-4 lg:col-start-9 lg:row-start-1">
          <VoiceGuidance analysis={analysis} transcribeRequestId={result.request_id} />

          <GlowCard className="border-[#11CFA8]/30">
            <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-5 w-5 text-[#11CFA8]" aria-hidden /> Recommended safe actions
            </h2>
            <p className="mt-1 text-sm text-[#94A3B8]">Safe rehne ke liye ye steps follow karo.</p>
            <ol className="mt-5 space-y-3">
              {analysis.safeSteps.map((step, i) => (
                <li key={step} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#11CFA8]/15 text-sm font-bold text-[#11CFA8]">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm leading-relaxed text-[#94A3B8]">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6A2C]" aria-hidden />
              {analysis.disclaimer}
            </p>
          </GlowCard>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/analyze')}
              className="bg-gradient-brand flex-1 rounded-xl px-5 py-3 text-sm font-semibold text-white"
            >
              Analyze another call
            </button>
            <Link
              to="/"
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/5"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
