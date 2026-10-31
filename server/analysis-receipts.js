/**
 * CallSuraksha AI — analysis receipts (Phase A).
 *
 * The guidance endpoint must NOT accept an analysis object from the
 * client — anyone could forge one and get free TTS. Instead, after a
 * successful /api/transcribe the server keeps a short-lived receipt:
 * the Prisma request_id mapped to the real risk analysis it produced.
 * /api/guidance only takes the request_id and looks the analysis up
 * here. A missing, forged or expired id is rejected.
 *
 * Receipts are multi-use inside their TTL (10 minutes): the same
 * analysis legitimately needs two guidance calls — one per voice
 * (Poorvi, then Nalini on voice switch). Abuse inside that window is
 * still bounded by the combined per-IP rate limit. At most 100
 * receipts are kept; the oldest is evicted when the cap is hit.
 * Nothing is written to disk — a restart clears the receipts, which
 * only means the user re-analyzes (a fresh transcribe).
 */

export const RECEIPT_TTL_MS = 10 * 60 * 1000
export const MAX_RECEIPTS = 100

const receipts = new Map() // request_id -> { analysis, expiresAt }

/** Store the analysis a real transcribe produced, keyed by its request_id. */
export function storeAnalysisReceipt(requestId, analysis, ttlMs = RECEIPT_TTL_MS) {
  if (typeof requestId !== 'string' || !requestId) return
  if (receipts.size >= MAX_RECEIPTS) {
    const oldest = receipts.keys().next().value
    if (oldest !== undefined) receipts.delete(oldest)
  }
  receipts.set(requestId, { analysis, expiresAt: Date.now() + ttlMs })
}

/**
 * Look up the analysis for a request_id. Returns null for a missing,
 * forged or expired id (expired entries are deleted on sight).
 */
export function getAnalysisReceipt(requestId) {
  if (typeof requestId !== 'string' || !requestId) return null
  const entry = receipts.get(requestId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    receipts.delete(requestId)
    return null
  }
  return entry.analysis
}

/** How many receipts are held right now (tests + diagnostics). */
export function receiptCount() {
  return receipts.size
}

/** Clear all receipts. Used by tests only — never in production code. */
export function clearAnalysisReceipts() {
  receipts.clear()
}
