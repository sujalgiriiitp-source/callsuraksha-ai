/**
 * CallSuraksha AI — Clean vs Noisy Audio Comparison (Phase 8).
 *
 * One synthetic call (the bank-otp sample), two versions: clean, and the
 * IDENTICAL audio with controlled white noise added (measured SNR 12.01
 * dB, see the manifest). Both are evaluated with independent real Gnani
 * Prisma requests, and the transcripts are scored against the known
 * script with real WER / CER / Important Phrase Recall.
 *
 * Honest by design: if the noisy transcript is identical to the clean
 * one, the page says so — it never invents a degradation. No fake
 * accuracy percentages, no confidence claims, no timestamps, no speaker
 * labels, no credits. The reference image's fake bits (credits, per-line
 * timestamps, speaker labels, "confidence") are deliberately NOT copied.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { GlowCard } from '../components/GlowCard'
import { fetchPublicAudio, isTranscribeError, transcribeAudioFile } from '../lib/analyze-audio'
import {
  clearCachedAnalysis,
  getCachedAnalysis,
  loadCompareManifest,
  setCachedAnalysis,
  type CompareManifest,
} from '../lib/samples'
import { getLastAnalysis, setLastAnalysis, type AnalysisResult } from '../lib/analysis'
import {
  characterErrorRate,
  diffWords,
  importantPhraseRecall,
  wordErrorRate,
} from '../lib/metrics'

type Side = 'clean' | 'noisy'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPercent(value: number | null): string {
  if (value === null) return 'Not Measured'
  return `${(value * 100).toFixed(1)}%`
}

function bandClass(band: string): string {
  if (band === 'High') return 'bg-[#F3345E]/15 text-[#F3345E]'
  if (band === 'Medium') return 'bg-[#FF6A2C]/15 text-[#FF6A2C]'
  if (band === 'Low') return 'bg-[#11CFA8]/15 text-[#11CFA8]'
  return 'bg-white/10 text-[#E2E8F0]'
}

export function Compare() {
  const navigate = useNavigate()
  const [manifest, setManifest] = useState<CompareManifest | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [cleanResult, setCleanResult] = useState<AnalysisResult | null>(null)
  const [noisyResult, setNoisyResult] = useState<AnalysisResult | null>(null)
  // Per-side analysis metadata — kept so "View Full Analysis" can show
  // the original timestamp and the cached flag honestly.
  const [metaBySide, setMetaBySide] = useState<Record<Side, { analyzedAt: string; cached: boolean } | null>>({ clean: null, noisy: null })
  const [errorBySide, setErrorBySide] = useState<Partial<Record<Side, string>>>({})
  const [analyzed, setAnalyzed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadCompareManifest()
      .then((m) => {
        if (!cancelled) setManifest(m)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Compare manifest load nahi hui')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function analyzeSide(side: Side, file: string, language: string, durationSeconds: number, bytes: number, forceFresh: boolean): Promise<{ result: AnalysisResult; analyzedAt: string; cached: boolean } | null> {
    const key = `compare-${side}`
    if (!forceFresh) {
      const cached = getCachedAnalysis(key)
      // Original timestamp kept — a cached result never looks fresh.
      if (cached) return { result: cached.result, analyzedAt: cached.analyzedAt, cached: true }
    }
    const blob = await fetchPublicAudio(`/${file}`)
    const result = await transcribeAudioFile(blob, file.split('/').pop() ?? `${side}.wav`, bytes, 'WAV', durationSeconds, language)
    const stored = getLastAnalysis()
    const analyzedAt = stored?.analyzedAt ?? new Date().toISOString()
    setCachedAnalysis(key, result, analyzedAt)
    return { result, analyzedAt, cached: false }
  }

  async function runComparison(forceFresh: boolean) {
    if (!manifest || running) return
    setRunning(true)
    setErrorBySide({})
    try {
      // Sequential — two simultaneous Gnani calls risk a 429 (Phase 7 lesson).
      const clean = await analyzeSide('clean', manifest.clean.file, 'hi-IN', manifest.clean.durationSeconds, manifest.clean.bytes, forceFresh)
      setCleanResult(clean?.result ?? null)
      setMetaBySide((prev) => ({ ...prev, clean: clean ? { analyzedAt: clean.analyzedAt, cached: clean.cached } : null }))
      const noisy = await analyzeSide('noisy', manifest.noisy.file, 'hi-IN', manifest.noisy.durationSeconds, manifest.noisy.bytes, forceFresh)
      setNoisyResult(noisy?.result ?? null)
      setMetaBySide((prev) => ({ ...prev, noisy: noisy ? { analyzedAt: noisy.analyzedAt, cached: noisy.cached } : null }))
      setAnalyzed(true)
    } catch (err: unknown) {
      const message = isTranscribeError(err) ? err.message : 'Comparison fail hui — dobara try karo.'
      setErrorBySide((prev) => ({ ...prev, noisy: message }))
    } finally {
      setRunning(false)
    }
  }

  async function viewFullAnalysis(side: Side) {
    if (!manifest) return
    const result = side === 'clean' ? cleanResult : noisyResult
    if (!result) return
    const file = side === 'clean' ? manifest.clean : manifest.noisy
    const meta = metaBySide[side]
    const blob = await fetchPublicAudio(`/${file.file}`)
    setLastAnalysis({
      result,
      fileName: file.file.split('/').pop() ?? `${side}.wav`,
      fileSize: file.bytes,
      format: 'WAV',
      durationSeconds: file.durationSeconds,
      language: 'hi-IN',
      audioUrl: URL.createObjectURL(blob),
      analyzedAt: meta?.analyzedAt ?? new Date().toISOString(),
      cached: meta?.cached,
    })
    navigate('/results')
  }

  async function copyTranscript(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard unavailable — no fallback needed, the text is visible.
    }
  }

  const ref = manifest?.referenceTranscript ?? ''
  const metrics =
    manifest && cleanResult && noisyResult
      ? {
          clean: {
            wer: wordErrorRate(ref, cleanResult.transcript),
            cer: characterErrorRate(ref, cleanResult.transcript),
            recall: importantPhraseRecall(cleanResult.transcript, manifest.importantPhrases),
            diff: diffWords(ref, cleanResult.transcript),
          },
          noisy: {
            wer: wordErrorRate(ref, noisyResult.transcript),
            cer: characterErrorRate(ref, noisyResult.transcript),
            recall: importantPhraseRecall(noisyResult.transcript, manifest.importantPhrases),
            diff: diffWords(ref, noisyResult.transcript),
          },
        }
      : null

  const consistent: string[] = []
  const changed: string[] = []
  if (metrics && cleanResult && noisyResult) {
    if (cleanResult.analysis.riskBand === noisyResult.analysis.riskBand) {
      consistent.push(`Dono ka risk band ek jaisa hai (${cleanResult.analysis.riskBand}).`)
    } else {
      changed.push(`Risk band badla: clean ${cleanResult.analysis.riskBand} → noisy ${noisyResult.analysis.riskBand}.`)
    }
    const cleanCats = cleanResult.analysis.highlights.map((h) => h.category).sort().join(',')
    const noisyCats = noisyResult.analysis.highlights.map((h) => h.category).sort().join(',')
    if (cleanCats === noisyCats) {
      consistent.push('Detected risk indicators ek jaise hain.')
    } else {
      changed.push('Detected risk indicators me farak aaya — neeche dekho.')
    }
    if (cleanResult.transcript === noisyResult.transcript) {
      consistent.push('Dono transcripts ek jaise aaye — is sample par noise se koi farak nahi pada.')
    } else {
      const between = diffWords(cleanResult.transcript, noisyResult.transcript)
      const parts: string[] = []
      for (const a of between.altered) parts.push(`“${a.ref}” → “${a.hyp}”`)
      for (const w of between.missed) parts.push(`clean me “${w}” tha, noisy me nahi`)
      for (const w of between.extra) parts.push(`noisy me extra “${w}”`)
      changed.push(
        parts.length > 0
          ? `Transcripts me farak aaya: ${parts.join('; ')}.`
          : 'Transcripts me chhota sa farak aaya (punctuation ya spacing).',
      )
    }
    if (metrics.clean.wer === metrics.noisy.wer && metrics.clean.cer === metrics.noisy.cer) {
      consistent.push(`WER aur CER dono me ek jaise hain (WER ${formatPercent(metrics.clean.wer)}).`)
    } else {
      changed.push(`WER badla: clean ${formatPercent(metrics.clean.wer)} → noisy ${formatPercent(metrics.noisy.wer)}.`)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#377BFF] uppercase">Audio Comparison Demo</p>
      <h1 className="font-display mt-2 text-3xl font-bold sm:text-4xl">
        Clean vs <span className="text-[#FF6A2C]">Noisy</span> Audio Comparison
      </h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-[#94A3B8]">
        Ek hi synthetic call, do versions — clean aur controlled background noise ke saath.
        Dono ko alag-alag real Gnani Prisma requests se analyze kiya jata hai, taaki pata chale
        ki noisy audio par bhi risk signals pakde jate hain ya nahi.
      </p>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#FF6A2C]/40 bg-[#FF6A2C]/10 px-3 py-1.5 text-xs font-semibold text-[#FF6A2C]">
        Same call · Different audio quality · Same AI protection
      </p>

      {loadError && (
        <div className="mt-8 rounded-xl border border-[#F3345E]/40 bg-[#F3345E]/10 px-4 py-3 text-sm text-[#FDA4AF]">
          {loadError} — pehle <code>node scripts/generate-samples.mjs</code> aur{' '}
          <code>node scripts/add-noise.mjs</code> chalao.
        </div>
      )}

      {manifest && (
        <>
          {/* Two panels */}
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {(
              [
                { side: 'clean' as Side, title: 'Clean Recording', sub: 'Clear audio, minimal background noise', accent: 'border-[#11CFA8]/40', file: manifest.clean, result: cleanResult },
                { side: 'noisy' as Side, title: 'Noisy Recording', sub: 'Same call, controlled background noise ke saath', accent: 'border-[#F3345E]/40', file: manifest.noisy, result: noisyResult },
              ]
            ).map(({ side, title, sub, accent, file, result }) => (
              <GlowCard key={side} className={accent}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold">{title}</h2>
                  {side === 'noisy' ? (
                    <span className="rounded-full bg-[#F3345E]/15 px-2.5 py-1 text-xs font-semibold text-[#F3345E]">
                      Measured SNR {manifest.noise.measuredSnrDb} dB
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#11CFA8]/15 px-2.5 py-1 text-xs font-semibold text-[#11CFA8]">
                      Clean audio, low background noise
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[#94A3B8]">{sub}</p>
                <audio controls preload="metadata" src={`/${file.file}`} data-testid={`compare-audio-${side}`} className="mt-4 w-full" />
                <p className="mt-2 text-xs text-[#94A3B8]">
                  Duration {formatDuration(file.durationSeconds)} · {(file.bytes / 1024).toFixed(0)} KB · WAV
                </p>
                {result && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${bandClass(result.analysis.riskBand)}`}>
                      {result.analysis.riskBand} Risk
                    </span>
                    <span className="text-xs text-[#94A3B8]">
                      {result.analysis.highlights.length} indicator
                      {result.analysis.highlights.length === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void viewFullAnalysis(side)}
                      className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#FF6A2C] hover:underline"
                    >
                      View Full Analysis <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                )}
                {errorBySide[side] && (
                  <p className="mt-3 rounded-xl border border-[#F3345E]/40 bg-[#F3345E]/10 px-3 py-2 text-sm text-[#FDA4AF]">
                    {errorBySide[side]}
                  </p>
                )}
              </GlowCard>
            ))}
          </div>

          {/* Run / re-run */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="run-comparison"
              onClick={() => void runComparison(false)}
              disabled={running}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6A2C] to-[#F3345E] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Dono analyze ho rahe hain…
                </>
              ) : (
                <>Compare karo — dono ko analyze karo</>
              )}
            </button>
            {analyzed && !running && (
              <button
                type="button"
                onClick={() => {
                  clearCachedAnalysis('compare-clean')
                  clearCachedAnalysis('compare-noisy')
                  setCleanResult(null)
                  setNoisyResult(null)
                  setMetaBySide({ clean: null, noisy: null })
                  setAnalyzed(false)
                  void runComparison(true)
                }}
                className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-3 text-xs font-semibold text-[#E2E8F0] hover:border-[#FF6A2C]/60"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Naye API calls se dobara compare karo
              </button>
            )}
            <p className="text-xs text-[#94A3B8]">
              Dono recordings ko alag-alag Prisma requests milti hain. Dobara compare karne par cached
              result dikhta hai — naya API call sirf Re-run par hota hai.
            </p>
          </div>

          {/* Results */}
          {metrics && cleanResult && noisyResult && (
            <div className="mt-10 space-y-6" data-testid="comparison-results">
              {/* Reference transcript */}
              <GlowCard>
                <h2 className="font-display text-lg font-semibold">Expected Reference Transcript</h2>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  Ye wahi script hai jo Timbre ne bola tha — metrics isi se compare karte hain.
                </p>
                <p className="mt-3 rounded-xl bg-white/[0.03] px-4 py-3 text-sm leading-relaxed">{ref}</p>
              </GlowCard>

              {/* Transcripts side by side */}
              <div className="grid gap-6 lg:grid-cols-2">
                {(
                  [
                    { side: 'clean' as Side, label: 'Clean Transcript', result: cleanResult },
                    { side: 'noisy' as Side, label: 'Noisy Transcript', result: noisyResult },
                  ]
                ).map(({ side, label, result }) => (
                  <GlowCard key={side}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-semibold">{label}</h3>
                      <button
                        type="button"
                        onClick={() => void copyTranscript(result.transcript)}
                        className="flex items-center gap-1 text-xs font-semibold text-[#94A3B8] hover:text-white"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
                      </button>
                    </div>
                    <p className="mt-3 rounded-xl bg-white/[0.03] px-4 py-3 text-sm leading-relaxed">{result.transcript}</p>
                    <p className="mt-2 text-xs text-[#94A3B8]">
                      Model {result.model} · detected: {result.detected_language_code ?? 'unknown'}
                      {result.end_to_end_latency !== null ? ` · latency ${result.end_to_end_latency.toFixed(2)}s` : ''}
                    </p>
                  </GlowCard>
                ))}
              </div>

              {/* Metrics */}
              <GlowCard>
                <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                  <BarChart3 className="h-5 w-5 text-[#377BFF]" aria-hidden /> Measured Evaluation Metrics
                </h2>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  Reference script se compare karke, sahi tareeke se calculate kiye gaye metrics. Ye
                  ek ~23-word script par measured hain — ek word ka farak WER ko ~4 points hilata hai,
                  isliye ye demonstration measurement hai, benchmark claim nahi.
                </p>
                <div className="mt-4 space-y-3">
                  {(
                    [
                      { label: 'Word Error Rate (WER)', clean: formatPercent(metrics.clean.wer), noisy: formatPercent(metrics.noisy.wer) },
                      { label: 'Character Error Rate (CER)', clean: formatPercent(metrics.clean.cer), noisy: formatPercent(metrics.noisy.cer) },
                      {
                        label: 'Important Phrase Recall',
                        clean: metrics.clean.recall
                          ? `${metrics.clean.recall.found.length} / ${metrics.clean.recall.found.length + metrics.clean.recall.missed.length} phrases`
                          : 'Not Measured',
                        noisy: metrics.noisy.recall
                          ? `${metrics.noisy.recall.found.length} / ${metrics.noisy.recall.found.length + metrics.noisy.recall.missed.length} phrases`
                          : 'Not Measured',
                      },
                    ]
                  ).map((row) => (
                    <div key={row.label} className="grid grid-cols-1 gap-1 rounded-xl bg-white/[0.03] px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
                      <p className="text-sm">{row.label}</p>
                      <p className="text-sm">
                        <span className="font-semibold text-[#11CFA8]">Clean: </span>
                        <span className="font-semibold">{row.clean}</span>
                      </p>
                      <p className="text-sm">
                        <span className="font-semibold text-[#F3345E]">Noisy: </span>
                        <span className="font-semibold">{row.noisy}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {(
                    [
                      { label: 'Clean — missed / altered words', diff: metrics.clean.diff },
                      { label: 'Noisy — missed / altered words', diff: metrics.noisy.diff },
                    ]
                  ).map(({ label, diff }) => (
                    <div key={label} className="rounded-xl bg-white/[0.03] px-4 py-3">
                      <p className="text-sm font-semibold">{label}</p>
                      {diff.missed.length === 0 && diff.altered.length === 0 && diff.extra.length === 0 ? (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-[#11CFA8]">
                          <Check className="h-4 w-4" aria-hidden /> Koi word miss ya alter nahi hua.
                        </p>
                      ) : (
                        <ul className="mt-1 space-y-1 text-sm text-[#94A3B8]">
                          {diff.missed.map((w) => (
                            <li key={`m-${w}`}>Missed: “{w}”</li>
                          ))}
                          {diff.altered.map((a) => (
                            <li key={`a-${a.ref}`}>Altered: “{a.ref}” → “{a.hyp}”</li>
                          ))}
                          {diff.extra.map((w) => (
                            <li key={`e-${w}`}>Extra: “{w}”</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                {metrics.clean.recall && metrics.clean.recall.missed.length > 0 && (
                  <p className="mt-3 text-sm text-[#94A3B8]">
                    Missed important phrase(s): {metrics.clean.recall.missed.join(', ')} — ye script
                    difference hai (reference me “बैंक” Devanagari me hai, transcript me “bank” Roman
                    me aaya), concept miss nahi hua.
                  </p>
                )}
              </GlowCard>

              {/* Comparison summary */}
              <div className="grid gap-6 lg:grid-cols-2">
                <GlowCard className="border-[#11CFA8]/30">
                  <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                    <Check className="h-5 w-5 text-[#11CFA8]" aria-hidden /> What Stayed Consistent
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#94A3B8]">
                    {consistent.length === 0 && <li>Kuch bhi consistent nahi raha — neeche dekho.</li>}
                    {consistent.map((c) => (
                      <li key={c} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#11CFA8]" aria-hidden /> {c}
                      </li>
                    ))}
                  </ul>
                </GlowCard>
                <GlowCard className="border-[#FF6A2C]/30">
                  <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                    <ShieldAlert className="h-5 w-5 text-[#FF6A2C]" aria-hidden /> What Changed (Due to Noise)
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#94A3B8]">
                    {changed.length === 0 && (
                      <li className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#11CFA8]" aria-hidden />
                        Kuch nahi badla — is sample par {manifest.noise.measuredSnrDb} dB noise ke baad bhi
                        transcript, metrics aur risk band ek jaise rahe.
                      </li>
                    )}
                    {changed.map((c) => (
                      <li key={c} className="flex gap-2">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6A2C]" aria-hidden /> {c}
                      </li>
                    ))}
                  </ul>
                </GlowCard>
              </div>

              {/* Evaluation explanation */}
              <GlowCard>
                <h2 className="font-display text-lg font-semibold">Evaluation Explanation</h2>
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-[#94A3B8]">
                  <p>
                    <strong className="text-[#E2E8F0]">Method:</strong> ek hi Timbre recording ko
                    do baar use kiya gaya — ek baar clean, ek baar white noise mix karke. Dono ko
                    alag-alag Prisma requests bheji gayin. Metrics (WER/CER/phrase recall) dono
                    transcripts ko known script se compare karke calculate kiye gaye; normalization
                    NFC + lowercase + punctuation hata kar ki gayi hai, aur Roman-vs-Devanagari
                    script difference ko error mana gaya hai, chhupaya nahi gaya.
                  </p>
                  <p>
                    <strong className="text-[#E2E8F0]">Noise:</strong> {manifest.noise.type}; target
                    SNR {manifest.noise.targetSnrDb} dB, measured SNR{' '}
                    {manifest.noise.measuredSnrDb} dB (signal RMS {manifest.noise.signalRms}, noise
                    RMS {manifest.noise.noiseRms}). {manifest.noise.method}
                  </p>
                  <p>
                    <strong className="text-[#E2E8F0]">Limit:</strong> ye ek sample aur ek noise
                    level par measured hai — isse ye claim nahi kiya ja sakta ki Prisma har noisy
                    call par itna hi achha karega. Processing latency yahan dikhayi gayi hai
                    (Prisma se mili hui), par usey accuracy ka proof mat samjho.
                  </p>
                </div>
              </GlowCard>
            </div>
          )}
        </>
      )}

      <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-[#94A3B8]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">
          Ye synthetic demo samples hain, testing aur evaluation ke liye banaye gaye. Real-world
          calls par results alag ho sakte hain. CallSuraksha AI risk indicators deta hai — fraud
          hone ya na hone ka faisla nahi.
        </span>
      </p>
    </div>
  )
}
