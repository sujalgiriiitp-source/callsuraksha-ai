import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  FileAudio,
  Gift,
  Headphones,
  Info,
  Landmark,
  Lightbulb,
  Mic,
  Play,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react'
import { GlowCard } from '../components/GlowCard'
import { setLastAnalysis, type AnalysisResult } from '../lib/analysis'
import { MVP_MAX_DURATION_SECONDS, MVP_MAX_FILE_MB } from '../lib/gnani'

const MAX_BYTES = MVP_MAX_FILE_MB * 1024 * 1024

const ACCEPTED_EXTS = ['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a'] as const
const ACCEPTED_LABEL = 'WAV, MP3, OGG, FLAC, AAC, M4A'

const LANGUAGES = [
  { value: 'hi-IN', label: 'Hindi — hi-IN' },
  { value: 'hi-IN,en-IN', label: 'Hinglish — hi-IN,en-IN (Prisma v3.0)' },
  { value: 'en-IN', label: 'English — en-IN' },
] as const

type LanguageValue = (typeof LANGUAGES)[number]['value'] | ''

type TabValue = 'upload' | 'record' | 'sample'

const TABS: { value: TabValue; label: string }[] = [
  { value: 'upload', label: 'Upload Audio' },
  { value: 'record', label: 'Record Audio' },
  { value: 'sample', label: 'Try a Sample' },
]

// Synthetic samples — names and risk bands only. No audio files and no
// invented durations: audio lands in Phase 8.
const SAMPLES = [
  {
    title: 'Bank OTP Fraud',
    desc: 'Fraudster claims to be from your bank and asks for OTP to block your account.',
    risk: 'High Risk',
    riskClass: 'bg-[#F3345E]/15 text-[#F3345E]',
    language: 'Hindi',
    icon: Landmark,
  },
  {
    title: 'UPI Verification Scam',
    desc: 'Caller asks for UPI PIN to verify a payment and offers a fake reward.',
    risk: 'High Risk',
    riskClass: 'bg-[#F3345E]/15 text-[#F3345E]',
    language: 'Hinglish',
    icon: Gift,
  },
  {
    title: 'KYC Update Call',
    desc: 'Fake customer care representative asks for personal details to update KYC.',
    risk: 'Medium Risk',
    riskClass: 'bg-[#FF6A2C]/15 text-[#FF6A2C]',
    language: 'Hindi',
    icon: UserCheck,
  },
  {
    title: 'Customer Care Impersonation',
    desc: 'Fraudster claims to be from a popular company and asks for account information.',
    risk: 'Medium Risk',
    riskClass: 'bg-[#FF6A2C]/15 text-[#FF6A2C]',
    language: 'Hinglish',
    icon: Headphones,
  },
  {
    title: 'Safe Call (Awareness)',
    desc: 'Genuine bank message that warns you to never share OTP or PIN.',
    risk: 'Low Risk',
    riskClass: 'bg-[#11CFA8]/15 text-[#11CFA8]',
    language: 'Hindi',
    icon: ShieldCheck,
  },
  {
    title: 'Genuine Bank Information',
    desc: 'Actual customer care call with general information about account services.',
    risk: 'Low Risk',
    riskClass: 'bg-[#11CFA8]/15 text-[#11CFA8]',
    language: 'English',
    icon: Info,
  },
]

const TIPS = [
  'Use clear audio without too much background noise',
  'Ensure the call is in Hindi, Hinglish or English',
  'Audio should be at least a few seconds long',
  'Avoid uploading personal or sensitive information',
  'Synthetic or consented recordings only',
]

type SelectedAudio = {
  name: string
  fileName: string
  blob: Blob
  size: number
  format: string
  durationSeconds: number | null
  durationUnknown: boolean
  url: string
  source: 'upload' | 'recording'
  mime: string
}

type TranscribeError = {
  status: number | null
  error: string
  message: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'Unknown'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getExtension(name: string): string {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

async function measureDuration(blob: Blob, url: string): Promise<number | null> {
  // Primary: decode the audio — exact duration, no guessing.
  try {
    const ctx = new AudioContext()
    try {
      const buf = await blob.arrayBuffer()
      const decoded = await ctx.decodeAudioData(buf)
      return decoded.duration
    } finally {
      void ctx.close()
    }
  } catch {
    // Fall through to the audio-element check.
  }
  // Fallback: metadata from an audio element.
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => resolve(audio.duration)
      audio.onerror = () => reject(new Error('metadata failed'))
      audio.src = url
    })
    return Number.isFinite(duration) ? duration : null
  } catch {
    return null
  }
}

function SampleRows({
  picked,
  onPick,
}: {
  picked: string | null
  onPick: (title: string) => void
}) {
  return (
    <ul className="space-y-3">
      {SAMPLES.map((sample) => (
        <li
          key={sample.title}
          className={`rounded-xl border px-4 py-3 ${
            picked === sample.title ? 'border-[#FF6A2C]/60 bg-[#FF6A2C]/5' : 'border-white/10 bg-white/[0.03]'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3345E]/15 text-[#F3345E]">
              <sample.icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{sample.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sample.riskClass}`}>
                  {sample.risk}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[#94A3B8]">{sample.desc}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#94A3B8]">{sample.language} · Synthetic sample · ≤ 28 sec</p>
            <button
              type="button"
              onClick={() => onPick(sample.title)}
              className="bg-gradient-brand shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white"
            >
              {picked === sample.title ? 'Selected' : 'Use This Sample'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Analyze() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<SelectedAudio | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [language, setLanguage] = useState<LanguageValue>('')
  const [consent, setConsent] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<TranscribeError | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isReading, setIsReading] = useState(false)

  const [isRecording, setIsRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [micError, setMicError] = useState<string | null>(null)
  const [recordingFormat, setRecordingFormat] = useState<string | null>(null)

  const [tab, setTab] = useState<TabValue>('upload')
  const [focusRisk, setFocusRisk] = useState(true)
  const [focusSummary, setFocusSummary] = useState(false)
  const [focusGuidance, setFocusGuidance] = useState(true)
  const [samplePicked, setSamplePicked] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const selectedUrlRef = useRef<string | null>(null)
  // True when leaving for /results: the audio URL must survive the
  // unmount, because the Results page plays from it.
  const keepUrlRef = useRef(false)
  const recSecondsRef = useRef(0)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (selectedUrlRef.current && !keepUrlRef.current) URL.revokeObjectURL(selectedUrlRef.current)
    }
  }, [])

  function addError(message: string) {
    setErrors((prev) => (prev.includes(message) ? prev : [...prev, message]))
  }

  function dismissError(index: number) {
    setErrors((prev) => prev.filter((_, i) => i !== index))
  }

  function clearSelected() {
    if (selectedUrlRef.current) URL.revokeObjectURL(selectedUrlRef.current)
    selectedUrlRef.current = null
    setSelected(null)
    setTranscribeError(null)
    setRecordingFormat(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFile(file: File) {
    setTranscribeError(null)
    setErrors([])
    const ext = getExtension(file.name)
    if (!ACCEPTED_EXTS.includes(ext as (typeof ACCEPTED_EXTS)[number])) {
      addError(
        `Format supported nahi hai: "${ext || 'unknown'}". Sirf ${ACCEPTED_LABEL} files accept hoti hain.`,
      )
      return
    }
    if (file.size === 0) {
      addError('Ye file khaali hai (0 bytes) — koi audio nahi hai. Koi aur file choose karo.')
      return
    }
    if (file.size > MAX_BYTES) {
      addError(
        `File bahut badi hai: ${formatSize(file.size)}. Limit max ${MVP_MAX_FILE_MB} MB hai. Chhoti clip (max 30 seconds) choose karo.`,
      )
      return
    }
    setIsReading(true)
    const url = URL.createObjectURL(file)
    const duration = await measureDuration(file, url)
    setIsReading(false)
    if (duration !== null && duration <= 0) {
      URL.revokeObjectURL(url)
      addError('Ye audio 0 seconds ka hai — isme koi awaaz nahi hai. Koi aur file choose karo.')
      return
    }
    if (duration !== null && duration > MVP_MAX_DURATION_SECONDS) {
      URL.revokeObjectURL(url)
      addError(
        `Audio bahut lamba hai: ${formatDuration(duration)}. Limit max ${MVP_MAX_DURATION_SECONDS} seconds hai. Chhoti clip choose karo.`,
      )
      return
    }
    clearSelected()
    selectedUrlRef.current = url
    setSelected({
      name: file.name,
      fileName: file.name,
      blob: file,
      size: file.size,
      format: ext.toUpperCase(),
      durationSeconds: duration,
      durationUnknown: duration === null,
      url,
      source: 'upload',
      mime: file.type || 'audio/*',
    })
  }

  async function handleAnalyze() {
    if (!selected || !readyToAnalyze || isAnalyzing) return
    setIsAnalyzing(true)
    setTranscribeError(null)
    try {
      const form = new FormData()
      form.append('audio_file', selected.blob, selected.fileName)
      form.append('language_code', language)
      // Default model is Prisma v3.0 (accepts single codes and hi-IN,en-IN).
      form.append('model', 'prisma-v3.0')
      const res = await fetch('/api/transcribe', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as
        | (Partial<AnalysisResult> & { error?: string; message?: string })
        | null
      if (!res.ok || !data || typeof data.transcript !== 'string') {
        setTranscribeError({
          status: res.status,
          error: data?.error ?? 'TRANSCRIBE_FAILED',
          message:
            data?.message ??
            'Transcription fail hui — dobara try karo.',
        })
        return
      }
      // The server must also return the Phase 5 risk analysis — without it
      // the Results page has nothing real to show.
      const analysis = data.analysis
      if (
        !analysis ||
        typeof analysis.riskBand !== 'string' ||
        !Array.isArray(analysis.highlights) ||
        !Array.isArray(analysis.safeSteps)
      ) {
        setTranscribeError({
          status: res.status,
          error: 'ANALYSIS_MISSING',
          message: 'Server ne transcript to bheja, par risk analysis nahi bheja — dobara try karo.',
        })
        return
      }
      // Only real Prisma fields + real engine output — nothing invented.
      // The Results page reads this from the in-memory store.
      keepUrlRef.current = true
      setLastAnalysis({
        result: {
          transcript: data.transcript,
          model: typeof data.model === 'string' ? data.model : 'prisma-v3.0',
          detected_language_code: data.detected_language_code ?? null,
          processing_time: typeof data.processing_time === 'number' ? data.processing_time : null,
          end_to_end_latency:
            typeof data.end_to_end_latency === 'number' ? data.end_to_end_latency : null,
          request_id: typeof data.request_id === 'string' ? data.request_id : null,
          analysis,
        },
        fileName: selected.fileName,
        fileSize: selected.size,
        format: selected.format,
        durationSeconds: selected.durationSeconds,
        language,
        audioUrl: selected.url,
        analyzedAt: new Date().toISOString(),
      })
      navigate('/results')
    } catch {
      setTranscribeError({
        status: null,
        error: 'NETWORK_ERROR',
        message: 'Server se connect nahi ho paya — kya server chal raha hai? (npm run server)',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function finishRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    // onstop handler below builds the recording from chunksRef.
  }

  async function startRecording() {
    setMicError(null)
    setTranscribeError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Is browser me mic recording supported nahi hai. Koi aur browser try karo, ya file upload karo.')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setMicError('Is browser me MediaRecorder supported nahi hai. Koi aur browser try karo, ya file upload karo.')
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setMicError(
          'Microphone permission denied hai — browser ke address bar / settings me mic ko Allow karo, phir dobara try karo.',
        )
      } else if (name === 'NotFoundError') {
        setMicError('Koi microphone nahi mila — device me mic connect karo, phir dobara try karo.')
      } else {
        setMicError('Mic start nahi ho paya. Dobara try karo, ya file upload karo.')
      }
      return
    }
    streamRef.current = stream
    chunksRef.current = []
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream)
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      setMicError('Is browser me mic recording start nahi ho payi. File upload karo.')
      return
    }
    mediaRecorderRef.current = recorder
    setRecordingFormat(recorder.mimeType || 'browser default recording format')
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      stopTimer()
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      const secs = recSecondsRef.current
      const url = URL.createObjectURL(blob)
      clearSelected()
      selectedUrlRef.current = url
      setSelected({
        name: `Mic recording (${formatDuration(secs)})`,
        fileName: 'recording.webm',
        blob,
        size: blob.size,
        format: (recorder.mimeType || 'webm').split(';')[0].split('/')[1]?.toUpperCase() || 'WEBM',
        durationSeconds: secs,
        durationUnknown: false,
        url,
        source: 'recording',
        mime: blob.type,
      })
      setIsRecording(false)
    }
    recorder.onerror = () => {
      stopTimer()
      stream.getTracks().forEach((t) => t.stop())
      setIsRecording(false)
      setMicError('Recording me error aaya — recording save nahi hui. Dobara try karo, ya file upload karo.')
    }
    setRecSeconds(0)
    recSecondsRef.current = 0
    setIsRecording(true)
    recorder.start(250)
    timerRef.current = window.setInterval(() => {
      const next = Math.min(recSecondsRef.current + 1, MVP_MAX_DURATION_SECONDS)
      recSecondsRef.current = next
      setRecSeconds(next)
      if (next >= MVP_MAX_DURATION_SECONDS) finishRecording()
    }, 1000)
  }

  function stopRecording() {
    finishRecording()
  }

  const durationOk =
    selected !== null && selected.durationSeconds !== null && selected.durationSeconds > 0 &&
    selected.durationSeconds <= MVP_MAX_DURATION_SECONDS
  const durationUnknown = selected !== null && selected.durationUnknown
  const readyToAnalyze = selected !== null && durationOk && language !== '' && consent
  const checklist = [
    { label: 'File ready', done: selected !== null },
    {
      label: `Duration ${MVP_MAX_DURATION_SECONDS} s ke andar`,
      done: durationOk,
      warn: durationUnknown ? 'Duration read nahi ho payi — verify nahi hui' : undefined,
    },
    { label: 'Language chuni gayi', done: language !== '' },
    { label: 'Consent diya gaya', done: consent },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 sm:py-16">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#FF6A2C]">Step 1 of 3</p>
        <h1 className="font-display mt-3 text-3xl font-bold sm:text-4xl">Upload or Record a Call</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-[#94A3B8]">
          Recorded call upload karo ya mic se record karo. Audio sirf Analyze dabane par server
          ko bheja jata hai — server audio store nahi karta, aur key set nahi hai to saaf bata
          diya jayega, koi fake transcript nahi.
        </p>
        <div className="glass-card mt-6 flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#11CFA8]" aria-hidden />
          <span className="text-[#94A3B8]">Limits:</span>
          <span className="font-medium">max {MVP_MAX_FILE_MB} MB</span>
          <span aria-hidden className="text-[#94A3B8]">·</span>
          <span className="font-medium">max {MVP_MAX_DURATION_SECONDS} seconds</span>
          <span aria-hidden className="text-[#94A3B8]">·</span>
          <span className="font-medium">{ACCEPTED_LABEL}</span>
        </div>
      </section>

      {errors.length > 0 && (
        <div className="space-y-2" role="alert" aria-live="polite">
          {errors.map((error, i) => (
            <div
              key={`${error}-${i}`}
              className="flex items-start gap-3 rounded-xl border border-[#F3345E]/40 bg-[#F3345E]/10 px-4 py-3 text-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F3345E]" aria-hidden />
              <p className="flex-1">{error}</p>
              <button
                type="button"
                onClick={() => dismissError(i)}
                aria-label="Error hatayein"
                className="rounded p-1 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          {/* Tabs */}
          <div role="tablist" aria-label="Audio input method" className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                  tab === t.value
                    ? 'bg-gradient-brand text-white'
                    : 'border border-white/15 bg-[#101D35]/60 text-[#F8FAFC] hover:bg-white/10'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Upload tab */}
          {tab === 'upload' && (
            <GlowCard>
              <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                <Upload className="h-5 w-5 text-[#FF6A2C]" aria-hidden /> Upload Audio
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
                Apne device se ek recorded call file choose karo. Sirf synthetic ya apni
                consented recording.
              </p>
              <div
                role="button"
                tabIndex={0}
                aria-label="Audio file choose karne ke liye drop zone"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) void handleFile(file)
                }}
                className={`mt-5 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
                  isDragging ? 'border-[#FF6A2C] bg-[#FF6A2C]/10' : 'border-white/20 hover:border-[#FF6A2C]/60'
                }`}
              >
                <FileAudio className="h-8 w-8 text-[#FF6A2C]" aria-hidden />
                <p className="mt-3 font-medium">
                  {isDragging ? 'File yahan chhodo' : 'File yahan drag karo, ya click karke choose karo'}
                </p>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  {ACCEPTED_LABEL} · max {MVP_MAX_FILE_MB} MB · max {MVP_MAX_DURATION_SECONDS} seconds
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".wav,.mp3,.ogg,.flac,.aac,.m4a,audio/wav,audio/mpeg,audio/ogg,audio/flac,audio/aac,audio/mp4"
                className="hidden"
                aria-label="Audio file choose karo"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFile(file)
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-gradient-brand mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              >
                <Upload className="h-4 w-4" aria-hidden /> Browse files
              </button>
              {isReading && (
                <p className="mt-3 text-sm text-[#94A3B8]" aria-live="polite">
                  File ki duration padhi ja rahi hai…
                </p>
              )}
            </GlowCard>
          )}

          {/* Record tab */}
          {tab === 'record' && (
            <GlowCard>
              <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                <Mic className="h-5 w-5 text-[#8B5CF6]" aria-hidden /> Record Audio
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
                Apni awaaz me synthetic call script padho — max {MVP_MAX_DURATION_SECONDS}{' '}
                seconds, uske baad recording khud ruk jayegi.
              </p>
              {micError && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#F3345E]/40 bg-[#F3345E]/10 px-4 py-3 text-sm" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F3345E]" aria-hidden />
                  <p className="flex-1">{micError}</p>
                  <button
                    type="button"
                    onClick={() => setMicError(null)}
                    aria-label="Error hatayein"
                    className="rounded p-1 text-[#94A3B8] hover:text-[#F8FAFC]"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#8B5CF6] px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    <Mic className="h-4 w-4" aria-hidden /> Start recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F3345E] px-5 py-2.5 text-sm font-semibold text-white"
                    aria-label="Recording roko"
                  >
                    <Square className="h-4 w-4" aria-hidden /> Stop recording
                  </button>
                )}
                <span className="font-display text-2xl font-bold tabular-nums" aria-live="polite">
                  {formatDuration(isRecording ? recSeconds : selected?.source === 'recording' ? selected.durationSeconds ?? 0 : 0)}
                </span>
                {isRecording && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3345E]/15 px-2.5 py-1 text-xs font-medium text-[#F3345E]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#F3345E]" aria-hidden /> Recording…
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-[#94A3B8]">
                Recording format: {recordingFormat ?? 'abhi koi recording nahi hai'}. Mic recordings
                aam taur par webm/opus me banti hain — Prisma sirf WAV/MP3/OGG/FLAC/AAC/M4A accept
                karta hai, isliye mic recording server par reject ho sakti hai; format conversion
                abhi pending hai.
              </p>
              {selected?.source === 'recording' && !isRecording && (
                <div className="mt-4">
                  <p className="text-sm font-medium">Recording preview</p>
                  <audio controls src={selected.url} className="mt-2 w-full" aria-label="Recording preview" />
                  <button
                    type="button"
                    onClick={clearSelected}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[#94A3B8] hover:bg-white/5"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Discard / re-record
                  </button>
                </div>
              )}
            </GlowCard>
          )}

          {/* Try a Sample tab */}
          {tab === 'sample' && (
            <GlowCard>
              <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                <Play className="h-5 w-5 text-[#FF6A2C]" aria-hidden /> Try a Sample
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
                Synthetic demo calls — inhe suno aur samjho ki analysis kya dikhayega. Asli audio
                aur Analyze Sample button Demo Samples page par hain.
              </p>
              <div className="mt-4">
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6A2C] to-[#F3345E] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <Play className="h-4 w-4" aria-hidden /> Demo Samples page par suno
                </Link>
              </div>
              <div className="mt-5">
                <SampleRows
                  picked={samplePicked}
                  onPick={(title) => setSamplePicked(title)}
                />
              </div>
              {samplePicked && (
                <p className="mt-4 text-sm text-[#94A3B8]" role="status">
                  “{samplePicked}” chuna gaya — iska asli audio Demo Samples page par hai, wahan se
                  analyze karo.
                </p>
              )}
            </GlowCard>
          )}

          {/* Selected file details */}
          {selected && (
            <GlowCard className="border-[#11CFA8]/30">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-[#11CFA8]" aria-hidden /> Selected audio
                </h2>
                <button
                  type="button"
                  onClick={clearSelected}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[#94A3B8] hover:bg-white/5"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Clear / Remove
                </button>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-[#94A3B8]">File</dt>
                  <dd className="mt-1 break-all font-medium">{selected.name}</dd>
                </div>
                <div>
                  <dt className="text-[#94A3B8]">Size</dt>
                  <dd className="mt-1 font-medium">
                    {formatSize(selected.size)} / max {MVP_MAX_FILE_MB} MB
                  </dd>
                </div>
                <div>
                  <dt className="text-[#94A3B8]">Format</dt>
                  <dd className="mt-1 font-medium">{selected.format}</dd>
                </div>
                <div>
                  <dt className="text-[#94A3B8]">Duration</dt>
                  <dd className="mt-1 font-medium">
                    {durationUnknown ? 'Unknown — read nahi ho payi, guess nahi kiya gaya' : `${formatDuration(selected.durationSeconds)} / max 0:30`}
                  </dd>
                </div>
              </dl>
              {durationUnknown && (
                <p className="mt-3 text-sm text-[#94A3B8]">
                  Duration read nahi ho payi, isliye duration check verify nahi hua. File reject nahi
                  ki gayi — 30 seconds se lamba audio ho to Gnani khud use reject kar dega.
                </p>
              )}
              {selected.source === 'upload' && (
                <audio controls src={selected.url} className="mt-4 w-full" aria-label="Uploaded audio preview" />
              )}
              <p className="mt-3 flex items-center gap-2 text-sm font-medium text-[#11CFA8]">
                <Check className="h-4 w-4" aria-hidden />
                {durationOk
                  ? 'Ready — file limits ke andar hai.'
                  : durationUnknown
                    ? 'File selected hai — duration verify nahi hui.'
                    : 'File selected hai.'}
              </p>
            </GlowCard>
          )}

          {/* Language + Analysis Focus */}
          <div className="grid gap-6 lg:grid-cols-2">
            <GlowCard>
              <label htmlFor="analyze-language" className="font-display text-lg font-semibold">
                Language chuno <span className="text-[#F3345E]" aria-hidden>*</span>
              </label>
              <p className="mt-2 text-sm text-[#94A3B8]">
                Prisma ko batana hoga ki call kis language me hai. Language khud chunni hogi.
              </p>
              <select
                id="analyze-language"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value as LanguageValue)
                  setTranscribeError(null)
                }}
                className="mt-4 w-full rounded-xl border border-white/15 bg-[#0A1830] px-4 py-3 text-[#F8FAFC] outline-none focus:border-[#FF6A2C]"
              >
                <option value="">— Language chuno —</option>
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-sm text-[#94A3B8]">
                Hinglish option Prisma v3.0 ke liye hai (hi-IN,en-IN). Prisma v2.5 sirf ek language
                accept karta hai.
              </p>
            </GlowCard>

            <GlowCard>
              <h2 className="font-display text-lg font-semibold">Analysis Focus</h2>
              <p className="mt-2 text-sm text-[#94A3B8]">
                Kya analyze karna hai — ek se zyada chun sakte ho. Ye choice aage ke phases me
                use hogi.
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <label className="flex cursor-pointer items-start gap-3 leading-relaxed">
                  <input
                    type="checkbox"
                    checked={focusRisk}
                    onChange={(e) => setFocusRisk(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#FF6A2C]"
                  />
                  <span>
                    <span className="font-medium">Fraud Risk Detection</span>
                    <span className="block text-[#94A3B8]">Identify suspicious indicators</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 leading-relaxed">
                  <input
                    type="checkbox"
                    checked={focusSummary}
                    onChange={(e) => setFocusSummary(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#FF6A2C]"
                  />
                  <span>
                    <span className="font-medium">Call Summary</span>
                    <span className="block text-[#94A3B8]">Short summary of the conversation</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 leading-relaxed">
                  <input
                    type="checkbox"
                    checked={focusGuidance}
                    onChange={(e) => setFocusGuidance(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#FF6A2C]"
                  />
                  <span>
                    <span className="font-medium">Safety Guidance</span>
                    <span className="block text-[#94A3B8]">Get preventive advice in Hindi</span>
                  </span>
                </label>
              </div>
            </GlowCard>
          </div>

          {/* Consent */}
          <GlowCard>
            <h2 className="font-display text-lg font-semibold">Consent</h2>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked)
                  setTranscribeError(null)
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#FF6A2C]"
              />
              <span>
                Main confirm karta/karti hoon ki ye audio synthetic hai ya meri apni consented
                recording hai — kisi teesre vyakti ki call bina consent ke record ki hui nahi hai —
                aur isme koi real phone number ya account details nahi hain.
              </span>
            </label>
            <p className="mt-4 text-sm leading-relaxed text-[#94A3B8]">
              Analyze dabane par audio server ko bheja jata hai (Gnani Prisma ko forward). Server
              audio store nahi karta; Clear / Remove se turant hatayi ja sakti hai.
            </p>
          </GlowCard>

          {/* Ready checklist + Analyze */}
          <GlowCard>
            <h2 className="font-display text-lg font-semibold">Ready to analyze</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-start gap-2.5">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#11CFA8]" aria-hidden />
                  ) : (
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/30" aria-hidden />
                  )}
                  <span className={item.done ? '' : 'text-[#94A3B8]'}>
                    {item.label}
                    {item.warn && <span className="block text-[#94A3B8]">{item.warn}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={!readyToAnalyze || isAnalyzing}
              onClick={() => void handleAnalyze()}
              className="bg-gradient-brand mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-4 w-4" aria-hidden /> {isAnalyzing ? 'Transcribe ho raha hai…' : 'Analyze with AI'} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            {!readyToAnalyze && (
              <p className="mt-3 text-sm text-[#94A3B8]">
                Analyze tabhi enable hoga jab file ready ho, language chuni ho aur consent diya ho.
              </p>
            )}
            {isAnalyzing && (
              <p className="mt-4 text-sm text-[#94A3B8]" role="status" aria-live="polite">
                Audio server ko bheja gaya — Gnani Prisma se asli transcript ka intezaar hai…
              </p>
            )}
            {transcribeError && (
              <div
                className="mt-4 flex items-start gap-3 rounded-xl border border-[#F3345E]/40 bg-[#F3345E]/10 px-4 py-3 text-sm"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F3345E]" aria-hidden />
                <div className="flex-1">
                  <p className="font-semibold">
                    {transcribeError.error === 'GNANI_KEY_NOT_CONFIGURED'
                      ? 'Gnani key not set'
                      : 'Transcription fail hui'}
                  </p>
                  <p className="mt-1 text-[#94A3B8]">
                    {transcribeError.message}
                    {transcribeError.status !== null && ` (status ${transcribeError.status})`}
                  </p>
                  <p className="mt-1 text-[#94A3B8]">
                    Koi fake transcript nahi dikhaya gaya hai — ye server ka asli jawab hai.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTranscribeError(null)}
                  aria-label="Error hatayein"
                  className="rounded p-1 text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-sm font-semibold">Pipeline</p>
              <ol className="mt-3 flex flex-wrap gap-2 text-xs">
                {[
                  { step: 'Upload', note: 'ready' },
                  { step: 'Prisma transcript', note: 'Phase 4 — wired' },
                  { step: 'Risk indicators', note: 'Phase 5 — live, Results page par' },
                  { step: 'Voice guidance', note: 'Phase 7 se' },
                ].map((item, i) => (
                  <li key={item.step} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden className="text-[#94A3B8]">→</span>}
                    <span className="rounded-full bg-white/5 px-3 py-1.5 font-medium text-[#94A3B8]">
                      {item.step} · {item.note}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </GlowCard>
        </div>

        {/* Right rail */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-20">
          <GlowCard>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
                <Headphones className="h-5 w-5 text-[#FF6A2C]" aria-hidden /> Sample Calls
              </h2>
              <span className="text-xs font-semibold text-[#FF6A2C]">View All</span>
            </div>
            <p className="mt-2 text-sm text-[#94A3B8]">
              In synthetic call samples ko try karo — kaise analysis dikhega, samjho.
            </p>
            <div className="mt-5">
              <SampleRows
                picked={samplePicked}
                onPick={(title) => {
                  setSamplePicked(title)
                  setTab('sample')
                }}
              />
            </div>
            {samplePicked && (
              <p className="mt-4 text-sm text-[#94A3B8]" role="status">
                “{samplePicked}” chuna gaya — sample audio Phase 8 me aayega.
              </p>
            )}
          </GlowCard>

          <GlowCard>
            <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
              <Lightbulb className="h-5 w-5 text-[#FF6A2C]" aria-hidden /> Tips for Best Results
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#94A3B8]">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#11CFA8]" aria-hidden />
                  {tip}
                </li>
              ))}
            </ul>
          </GlowCard>
        </aside>
      </div>
    </div>
  )
}
