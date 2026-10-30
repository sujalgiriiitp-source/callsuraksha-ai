/**
 * CallSuraksha AI — analysis result types + in-memory store (Phase 6).
 *
 * The Results dashboard shows the REAL output of POST /api/transcribe:
 * the Prisma transcript plus the Phase 5 risk analysis. Nothing here is
 * hardcoded or pre-generated. The latest analysis lives only in browser
 * memory (no database, no localStorage — audio never leaves the session).
 * Refreshing the page clears it, and /results then shows an honest empty
 * state instead of stale or fake results.
 */

export type RiskBand = 'Low' | 'Medium' | 'High' | 'Unable to Assess'

export type RiskHighlight = {
  sentence: string
  category: string
  severity: 'high' | 'medium'
  reason: string
  precaution: string
}

export type RiskAnalysis = {
  riskBand: RiskBand
  highlights: RiskHighlight[]
  advisories: string[]
  safeSteps: string[]
  disclaimer: string
  reason: string
}

export type AnalysisResult = {
  transcript: string
  model: string
  detected_language_code: string | null
  processing_time: number | null
  end_to_end_latency: number | null
  request_id: string | null
  analysis: RiskAnalysis
}

export type StoredAnalysis = {
  result: AnalysisResult
  fileName: string
  fileSize: number
  format: string
  durationSeconds: number | null
  language: string
  audioUrl: string
  analyzedAt: string
}

let last: StoredAnalysis | null = null

export function setLastAnalysis(next: StoredAnalysis): void {
  if (last && last.audioUrl && last.audioUrl !== next.audioUrl) {
    URL.revokeObjectURL(last.audioUrl)
  }
  last = next
}

export function getLastAnalysis(): StoredAnalysis | null {
  return last
}

export function clearLastAnalysis(): void {
  if (last?.audioUrl) URL.revokeObjectURL(last.audioUrl)
  last = null
}

/** Human-readable label for a risk category code from the engine. */
export const CATEGORY_LABELS: Record<string, string> = {
  OTP_DEMAND: 'OTP / PIN maanga gaya',
  ACCOUNT_BLOCK: 'Account block ki dhamki',
  DIGITAL_ARREST: 'Digital arrest ki dhamki',
  PAYMENT_PRESSURE: 'Payment link / UPI dabav',
  PERSONAL_DETAILS: 'Personal details maangi gayi',
  IMPERSONATION: 'Bank / authority hone ka daava',
  MONEY_TRANSFER: 'Paise bhejne ko kaha',
  URGENCY: 'Jaldi karne ka dabav',
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

export function languageLabel(code: string): string {
  if (code === 'hi-IN,en-IN') return 'Hinglish (Hindi + English)'
  if (code === 'hi-IN') return 'Hindi'
  if (code === 'en-IN') return 'English'
  return code || 'Nahi batayi gayi'
}
