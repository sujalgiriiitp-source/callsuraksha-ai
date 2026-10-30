/**
 * CallSuraksha AI — Demo Samples page (Phase 8).
 *
 * Six ethically generated synthetic scenarios, recorded with real Gnani
 * Timbre TTS. Every card has a real audio file (served from
 * public/samples/), a real duration, and an Analyze Sample button that
 * runs the SAME pipeline as /analyze: real Prisma transcription + real
 * risk engine -> the real Results dashboard (with Phase 7 Timbre
 * guidance available there).
 *
 * Nothing here is a real phone call, and nothing is presented as one.
 * Repeat analysis reuses a cached result — no duplicate Gnani call —
 * unless the user explicitly re-analyzes.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FlaskConical,
  Info,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { GlowCard } from '../components/GlowCard'
import { fetchPublicAudio, isTranscribeError, transcribeAudioFile } from '../lib/analyze-audio'
import {
  clearCachedAnalysis,
  getCachedAnalysis,
  loadSampleManifest,
  setCachedAnalysis,
  type DemoSample,
} from '../lib/samples'
import { getLastAnalysis, setLastAnalysis } from '../lib/analysis'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`
}

const CATEGORY_STYLE: Record<string, string> = {
  'OTP / Account threat': 'bg-[#F3345E]/15 text-[#F3345E]',
  'Payment pressure': 'bg-[#FF6A2C]/15 text-[#FF6A2C]',
  'Personal details': 'bg-[#F3345E]/15 text-[#F3345E]',
  Impersonation: 'bg-[#FF6A2C]/15 text-[#FF6A2C]',
  'Safety advisory': 'bg-[#11CFA8]/15 text-[#11CFA8]',
  Informational: 'bg-[#377BFF]/15 text-[#377BFF]',
}

export function Demo() {
  const navigate = useNavigate()
  const [samples, setSamples] = useState<DemoSample[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [errorById, setErrorById] = useState<Record<string, string>>({})
  const [analyzedIds, setAnalyzedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    loadSampleManifest()
      .then((list) => {
        if (!cancelled) setSamples(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Samples load nahi hue')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function analyzeSample(sample: DemoSample, forceFresh: boolean) {
    if (analyzingId) return
    setErrorById((prev) => ({ ...prev, [sample.id]: '' }))
    const cached = forceFresh ? undefined : getCachedAnalysis(sample.id)
    if (cached) {
      // Reuse the cached result — no new Gnani call, and the ORIGINAL
      // timestamp is kept so it never looks like a fresh request.
      const blob = await fetchPublicAudio(`/${sample.file}`)
      setLastAnalysis({
        result: cached.result,
        fileName: `${sample.id}.wav`,
        fileSize: sample.bytes,
        format: 'WAV',
        durationSeconds: sample.durationSeconds,
        language: sample.language,
        audioUrl: URL.createObjectURL(blob),
        analyzedAt: cached.analyzedAt,
        cached: true,
      })
      navigate('/results')
      return
    }
    setAnalyzingId(sample.id)
    try {
      const blob = await fetchPublicAudio(`/${sample.file}`)
      const result = await transcribeAudioFile(
        blob,
        `${sample.id}.wav`,
        sample.bytes,
        'WAV',
        sample.durationSeconds,
        sample.language,
      )
      const stored = getLastAnalysis()
      setCachedAnalysis(sample.id, result, stored?.analyzedAt ?? new Date().toISOString())
      setAnalyzedIds((prev) => new Set(prev).add(sample.id))
      navigate('/results')
    } catch (err: unknown) {
      setErrorById((prev) => ({
        ...prev,
        [sample.id]: isTranscribeError(err)
          ? err.message
          : 'Analysis fail hui — dobara try karo.',
      }))
    } finally {
      setAnalyzingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#377BFF] uppercase">Synthetic Demo Samples</p>
      <h1 className="font-display mt-2 text-3xl font-bold sm:text-4xl">
        Demo <span className="text-[#FF6A2C]">Samples</span>
      </h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-[#94A3B8]">
        Chhe synthetic call scenarios — Gnani Timbre se banaye gaye hain, koi asli phone call
        nahi hai. Kisi bhi sample ko suno, phir <strong className="text-[#E2E8F0]">Analyze Sample</strong> dabao:
        asli Gnani Prisma transcript aur risk analysis Results dashboard par dikhega.
      </p>

      {loadError && (
        <div className="mt-8 rounded-xl border border-[#F3345E]/40 bg-[#F3345E]/10 px-4 py-3 text-sm text-[#FDA4AF]">
          {loadError} — kya <code>public/samples/</code> me audio files hain? Regenerate karo:{' '}
          <code>node scripts/generate-samples.mjs</code>
        </div>
      )}
      {!samples && !loadError && (
        <p className="mt-8 flex items-center gap-2 text-[#94A3B8]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Samples load ho rahe hain…
        </p>
      )}

      {samples && (
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {samples.map((sample) => {
            const isAnalyzing = analyzingId === sample.id
            const isCached = analyzedIds.has(sample.id) || getCachedAnalysis(sample.id) !== undefined
            const error = errorById[sample.id]
            return (
              <GlowCard key={sample.id} className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CATEGORY_STYLE[sample.category] ?? 'bg-white/10 text-white'}`}>
                    {sample.category}
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-[#E2E8F0]">
                    {sample.languageLabel}
                  </span>
                  {isCached && (
                    <span className="rounded-full bg-[#11CFA8]/15 px-2.5 py-1 text-xs font-semibold text-[#11CFA8]">
                      Cached
                    </span>
                  )}
                </div>
                <h2 className="font-display mt-3 text-lg font-semibold">{sample.title}</h2>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-[#94A3B8]">{sample.description}</p>

                <div className="mt-4">
                  <audio
                    controls
                    preload="metadata"
                    src={`/${sample.file}`}
                    data-testid={`sample-audio-${sample.id}`}
                    className="w-full"
                  />
                  <p className="mt-2 text-xs text-[#94A3B8]">
                    Duration {formatDuration(sample.durationSeconds)} · {formatSize(sample.bytes)} · WAV ·{' '}
                    {sample.voice} ({sample.model})
                  </p>
                </div>

                {error && (
                  <p className="mt-3 rounded-xl border border-[#F3345E]/40 bg-[#F3345E]/10 px-3 py-2 text-sm text-[#FDA4AF]">
                    {error}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    data-testid={`analyze-sample-${sample.id}`}
                    onClick={() => void analyzeSample(sample, false)}
                    disabled={isAnalyzing}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF6A2C] to-[#F3345E] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Analyzing…
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" aria-hidden /> Analyze Sample
                      </>
                    )}
                  </button>
                  {isCached && !isAnalyzing && (
                    <button
                      type="button"
                      onClick={() => {
                        clearCachedAnalysis(sample.id)
                        setAnalyzedIds((prev) => {
                          const next = new Set(prev)
                          next.delete(sample.id)
                          return next
                        })
                        void analyzeSample(sample, true)
                      }}
                      title="Naya Gnani API call karke dobara analyze karo"
                      className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2.5 text-xs font-semibold text-[#E2E8F0] hover:border-[#FF6A2C]/60"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Re-analyze
                    </button>
                  )}
                </div>
              </GlowCard>
            )
          })}
        </div>
      )}

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <FlaskConical className="h-5 w-5 shrink-0 text-[#377BFF]" aria-hidden />
          <p className="text-sm leading-relaxed text-[#94A3B8]">
            <strong className="text-[#E2E8F0]">Synthetic hi hai.</strong> Ye recordings Gnani
            Timbre se generate ki gayi hain — koi asli customer call nahi hai.
          </p>
        </div>
        <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <ShieldAlert className="h-5 w-5 shrink-0 text-[#FF6A2C]" aria-hidden />
          <p className="text-sm leading-relaxed text-[#94A3B8]">
            <strong className="text-[#E2E8F0]">Risk flag, verdict nahi.</strong> Low result ka
            matlab ye guarantee nahi hai ki call safe thi.
          </p>
        </div>
        <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-[#11CFA8]" aria-hidden />
          <p className="text-sm leading-relaxed text-[#94A3B8]">
            <strong className="text-[#E2E8F0]">No duplicate calls.</strong> Dobara analyze karne
            par cached result dikhta hai — naya Gnani call sirf Re-analyze par hota hai.
          </p>
        </div>
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-[#94A3B8]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">
          Har sample max 30 second aur 5 MB ke andar hai (Prisma limit). Audio files{' '}
          <code>public/samples/</code> me hain aur <code>scripts/generate-samples.mjs</code> se
          dobara banaye ja sakte hain.
        </span>
      </p>
    </div>
  )
}
