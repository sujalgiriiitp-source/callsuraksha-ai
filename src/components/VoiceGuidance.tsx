/**
 * CallSuraksha AI — AI Voice Guidance card (Phase 7).
 *
 * Fetches real Gnani Timbre audio for the actual risk analysis from
 * POST /api/guidance (server builds the script from the analysis, calls
 * Timbre v2.5, wraps the raw PCM as WAV). Controls: play / pause / resume
 * / restart / download / speed / voice switch (Hinglish Poorvi or Hindi
 * Nalini). If TTS fails, the card does NOT break the dashboard — it shows
 * the text guidance (the server-returned script, or the safe steps) with a
 * retry button.
 * Phase A: the component sends only the transcribe `request_id` — the
 * server looks the analysis up from its own receipt store and never
 * trusts a client-sent analysis object. The `analysis` prop is kept
 * only for the local text fallback (safe steps) when audio fails.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioLines, Download, Pause, Play, Quote, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import type { RiskAnalysis } from '../lib/analysis'
import { GlowCard } from './GlowCard'

type VoiceKey = 'poorvi' | 'nalini'

type GuidanceState =
  | { status: 'loading' }
  | { status: 'ready'; script: string; audioUrl: string; duration: number; voice: VoiceKey }
  | { status: 'error'; script: string | null; message: string }

const SPEEDS = [1, 1.25, 0.75] as const

// Session cache for generated guidance audio. The script is built from
// the analysis of one transcribe, so the same request_id+voice always
// produces the same script — re-fetching it on every /results visit would
// burn a Gnani TTS call for identical audio. The cache is keyed by
// request_id + voice, holds at most a few entries, lives in browser
// memory for the session only (refresh clears it), and the blob URLs are
// revoked only when a cached entry is replaced — never on unmount,
// because the same URL may be shown again.
type CachedGuidance = { script: string; audioUrl: string; duration: number }
const guidanceCache = new Map<string, CachedGuidance>()

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VoiceGuidance({
  analysis,
  transcribeRequestId,
}: {
  analysis: RiskAnalysis
  transcribeRequestId: string | null
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const requestId = useRef(0)
  // In-flight dedup: React StrictMode (dev) mounts the effect twice, which
  // would fire two identical Timbre calls — and Gnani rate-limits the
  // second one (429). Identical request_id+voice requests share one fetch.
  const inflight = useRef<{ key: string; promise: Promise<{ ok: boolean; data: any }> } | null>(null)
  const [voice, setVoice] = useState<VoiceKey>('poorvi')
  const [state, setState] = useState<GuidanceState>({ status: 'loading' })
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(0)

  const fetchGuidance = useCallback(async (voiceKey: VoiceKey) => {
    const id = ++requestId.current
    setState({ status: 'loading' })
    setIsPlaying(false)
    setCurrentTime(0)
    const key = `${transcribeRequestId ?? 'none'}:${voiceKey}`
    // Session cache first — identical script, no new TTS call.
    const hit = guidanceCache.get(key)
    if (hit) {
      if (id !== requestId.current) return
      setState({ status: 'ready', script: hit.script, audioUrl: hit.audioUrl, duration: hit.duration, voice: voiceKey })
      return
    }
    try {
      let entry = inflight.current?.key === key ? inflight.current : null
      if (!entry) {
        const promise = fetch('/api/guidance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id: transcribeRequestId, voice: voiceKey }),
        }).then(async (res) => ({ ok: res.ok, data: await res.json() }))
        entry = { key, promise }
        inflight.current = entry
        void promise.finally(() => {
          if (inflight.current?.key === key) inflight.current = null
        })
      }
      const { ok, data } = await entry.promise
      if (id !== requestId.current) return // a newer request won
      if (!ok || !data?.audioBase64) {
        setState({
          status: 'error',
          script: typeof data?.script === 'string' ? data.script : null,
          message: data?.message ?? 'Voice guidance nahi ban payi.',
        })
        return
      }
      const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' })
      const audioUrl = URL.createObjectURL(blob)
      const duration = typeof data.durationSeconds === 'number' ? data.durationSeconds : 0
      guidanceCache.set(key, { script: data.script, audioUrl, duration })
      setState((prev) => {
        // The previous URL stays alive in the session cache (it may be
        // shown again), so it is NOT revoked here.
        if (prev.status === 'ready' && prev.audioUrl !== audioUrl) {
          // Only revoke a URL that is not cached anywhere.
          const stillCached = [...guidanceCache.values()].some((c) => c.audioUrl === prev.audioUrl)
          if (!stillCached) URL.revokeObjectURL(prev.audioUrl)
        }
        return {
          status: 'ready',
          script: data.script,
          audioUrl,
          duration,
          voice: voiceKey,
        }
      })
    } catch {
      if (id !== requestId.current) return
      setState({
        status: 'error',
        script: null,
        message: 'Network error — voice guidance nahi ban payi.',
      })
    }
  }, [transcribeRequestId])

  useEffect(() => {
    fetchGuidance(voice)
    return () => {
      requestId.current += 1
    }
  }, [fetchGuidance, voice])

  // No unmount revoke: a ready URL lives in the session cache and may be
  // shown again when the user returns to /results. The cache is
  // session-scoped — a refresh clears it and the browser frees the blobs.

  const speed = SPEEDS[speedIndex]

  const togglePlay = () => {
    // Read the ref at call time, not render time: the ref is only set
    // after the ready render commits, so a render-time capture is null.
    const audio = audioRef.current
    if (!audio || state.status !== 'ready') return
    if (audio.paused) {
      void audio.play()
    } else {
      audio.pause()
    }
  }

  const restart = () => {
    const audio = audioRef.current
    if (!audio || state.status !== 'ready') return
    audio.currentTime = 0
    void audio.play()
  }

  const cycleSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length
    setSpeedIndex(next)
    const audio = audioRef.current
    if (audio) audio.playbackRate = SPEEDS[next]
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    const audio = audioRef.current
    if (audio) audio.muted = next
  }

  const progress = state.status === 'ready' && state.duration > 0 ? (currentTime / state.duration) * 100 : 0

  return (
    <GlowCard className="min-w-0 border-[#8B5CF6]/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
          <AudioLines className="h-5 w-5 text-[#8B5CF6]" aria-hidden /> AI Voice Guidance
        </h2>
        <span className="rounded-full bg-[#11CFA8]/15 px-2.5 py-1 text-xs font-semibold text-[#11CFA8]">
          Gnani Timbre · v2.5
        </span>
      </div>

      {/* Voice switch — wraps on narrow screens so the two buttons never
          force the card wider than the viewport (Phase 6: HowItWorks
          overflow at 320/375px). */}
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Guidance voice">
        {(['poorvi', 'nalini'] as const).map((key) => (
          <button
            key={key}
            type="button"
            data-testid={`guidance-voice-${key}`}
            onClick={() => setVoice(key)}
            disabled={state.status === 'loading'}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              voice === key
                ? 'bg-[#8B5CF6] text-white'
                : 'border border-white/15 text-[#94A3B8] hover:border-[#8B5CF6]/60 hover:text-white'
            }`}
          >
            {key === 'poorvi' ? 'Hinglish · Poorvi' : 'Hindi · Nalini'}
          </button>
        ))}
      </div>

      {state.status === 'loading' && (
        <div className="mt-4" data-testid="guidance-status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6] opacity-70">
              <AudioLines className="h-5 w-5 animate-pulse text-white" aria-hidden />
            </span>
            <span className="text-sm text-[#94A3B8]">Voice guidance ban rahi hai…</span>
          </div>
        </div>
      )}

      {state.status === 'ready' && (
        <div className="mt-4" data-testid="guidance-status">
          <audio
            ref={audioRef}
            data-testid="guidance-audio"
            src={state.audioUrl}
            preload="auto"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              e.currentTarget.playbackRate = speed
            }}
          />
          {/* Player row: play/pause + waveform progress + time */}
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <button
              type="button"
              data-testid="guidance-play"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause guidance' : 'Play guidance'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6] text-white transition hover:bg-[#7C3AED]"
            >
              {isPlaying ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="ml-0.5 h-5 w-5" aria-hidden />}
            </button>
            <div className="min-w-0 flex-1">
              {/* Waveform progress bar */}
              <div
                className="flex h-6 items-center gap-[2px]"
                role="progressbar"
                aria-label="Guidance progress"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {Array.from({ length: 28 }, (_, i) => {
                  const height = [40, 70, 100, 60, 85, 45, 95, 55, 75, 35, 90, 65, 80, 50, 100, 60, 85, 40, 70, 95, 55, 80, 45, 90, 65, 75, 50, 100][i]
                  const played = progress >= ((i + 1) / 28) * 100
                  return (
                    <span
                      key={i}
                      className={`w-[3px] rounded-full ${played ? 'bg-[#8B5CF6]' : 'bg-white/20'}`}
                      style={{ height: `${height}%` }}
                    />
                  )
                })}
              </div>
              <div className="mt-1 text-xs text-[#94A3B8]">
                {formatTime(currentTime)} / {formatTime(state.duration)}
              </div>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="shrink-0 rounded-full p-2 text-[#94A3B8] hover:bg-white/5 hover:text-white"
            >
              {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
            </button>
          </div>

          {/* Secondary controls: restart, speed, download */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="guidance-restart"
              onClick={restart}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] hover:border-[#8B5CF6]/60"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restart
            </button>
            <button
              type="button"
              data-testid="guidance-speed"
              onClick={cycleSpeed}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] hover:border-[#8B5CF6]/60"
            >
              {speed}x
            </button>
            <a
              href={state.audioUrl}
              download={`callsuraksha-guidance-${state.voice}.wav`}
              data-testid="guidance-download"
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] hover:border-[#8B5CF6]/60"
            >
              <Download className="h-3.5 w-3.5" aria-hidden /> Download WAV
            </a>
            <span className="ml-auto text-xs text-[#94A3B8]">Guidance taiyaar hai — suno</span>
          </div>

          {/* Spoken script — the exact text Timbre spoke */}
          <div className="mt-4 rounded-xl bg-[#8B5CF6]/10 px-4 py-3">
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5CF6]" aria-hidden />
              <span>{state.script}</span>
            </p>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="mt-4" data-testid="guidance-status">
          <p className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-sm text-[#FCD34D]">
            {state.message} Audio nahi bana, lekin neeche text guidance padho.
          </p>
          <button
            type="button"
            onClick={() => fetchGuidance(voice)}
            className="mt-3 rounded-full bg-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7C3AED]"
          >
            Dobara try karo
          </button>
          <div className="mt-4 rounded-xl bg-[#8B5CF6]/10 px-4 py-3">
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5CF6]" aria-hidden />
              <span>{state.script ?? analysis.safeSteps.join(' ')}</span>
            </p>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-[#94A3B8]">
        Ye guidance aapki call ke risk analysis se bani hai — ye koi fraud verdict nahi hai.
        Gnani Timbre se boli gayi hai.
      </p>
    </GlowCard>
  )
}
