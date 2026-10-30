/**
 * CallSuraksha AI — shared audio transcription helper (Phase 8).
 *
 * One place for the real /api/transcribe call, used by the Demo Samples
 * page and the Clean vs Noisy comparison. The Analyze page keeps its own
 * inline copy (working code — not touched). The result is stored with the
 * same in-memory store the Results dashboard reads.
 */
import { clearLastAnalysis, setLastAnalysis, type AnalysisResult } from './analysis'

export type TranscribeError = {
  status: number | null
  error: string
  message: string
}

export function isTranscribeError(err: unknown): err is TranscribeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    'message' in err &&
    typeof (err as TranscribeError).message === 'string'
  )
}

/**
 * POST an audio Blob to the real backend (Prisma v3.0 + Phase 5 risk
 * engine), store the result, and return it. Throws TranscribeError on
 * any failure — the caller shows the message and a retry control.
 * Clears any previous analysis first, so /results can never show a stale
 * result while a new one is in flight.
 */
export async function transcribeAudioFile(
  blob: Blob,
  fileName: string,
  fileSize: number,
  format: string,
  durationSeconds: number | null,
  language: string,
): Promise<AnalysisResult> {
  clearLastAnalysis()
  const form = new FormData()
  form.append('audio_file', blob, fileName)
  form.append('language_code', language)
  form.append('model', 'prisma-v3.0')
  let res: Response
  try {
    res = await fetch('/api/transcribe', { method: 'POST', body: form })
  } catch {
    throw {
      status: null,
      error: 'NETWORK_ERROR',
      message: 'Server se connect nahi ho paya — kya server chal raha hai? (npm run server)',
    } satisfies TranscribeError
  }
  const data = (await res.json().catch(() => null)) as
    | (Partial<AnalysisResult> & { error?: string; message?: string })
    | null
  if (!res.ok || !data || typeof data.transcript !== 'string') {
    throw {
      status: res.status,
      error: data?.error ?? 'TRANSCRIBE_FAILED',
      message: data?.message ?? 'Transcription fail hui — dobara try karo.',
    } satisfies TranscribeError
  }
  const analysis = data.analysis
  if (
    !analysis ||
    typeof analysis.riskBand !== 'string' ||
    !Array.isArray(analysis.highlights) ||
    !Array.isArray(analysis.safeSteps)
  ) {
    throw {
      status: res.status,
      error: 'ANALYSIS_MISSING',
      message: 'Server ne transcript to bheja, par risk analysis nahi bheja — dobara try karo.',
    } satisfies TranscribeError
  }
  const result: AnalysisResult = {
    transcript: data.transcript,
    model: typeof data.model === 'string' ? data.model : 'prisma-v3.0',
    detected_language_code: data.detected_language_code ?? null,
    processing_time: typeof data.processing_time === 'number' ? data.processing_time : null,
    end_to_end_latency: typeof data.end_to_end_latency === 'number' ? data.end_to_end_latency : null,
    request_id: typeof data.request_id === 'string' ? data.request_id : null,
    analysis,
  }
  setLastAnalysis({
    result,
    fileName,
    fileSize,
    format,
    durationSeconds,
    language,
    audioUrl: URL.createObjectURL(blob),
    analyzedAt: new Date().toISOString(),
  })
  return result
}

/** Fetch a public sample file as a Blob (for analysis). */
export async function fetchPublicAudio(path: string): Promise<Blob> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Audio file load nahi hui: ${path} (HTTP ${res.status})`)
  return await res.blob()
}
