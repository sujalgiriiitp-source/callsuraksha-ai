/**
 * CallSuraksha AI — evaluation metrics (Phase 8).
 *
 * Pure, dependency-free. Used by the Clean vs Noisy comparison page to
 * measure real Prisma transcripts against the known spoken script.
 *
 * Methodology (documented, honest):
 * - Normalization: NFC Unicode form, lowercased, punctuation removed
 *   (Devanagari danda included), whitespace collapsed. Devanagari and
 *   Roman words are kept as-is — a Roman word in the reference and its
 *   Devanagari transliteration in the transcript count as DIFFERENT
 *   words, and that is reported as an error, not hidden. This is why the
 *   comparison uses a Devanagari script: reference and transcript are in
 *   the same script, so WER/CER measure transcription, not transliteration.
 * - WER = (substitutions + deletions + insertions) / reference words
 *   (Levenshtein word alignment). CER is the same on characters of the
 *   normalized text (spaces kept, single spaces).
 * - Important Phrase Recall = fraction of a fixed list of important
 *   phrases (e.g. "OTP", "account block") found in the transcript.
 * - A metric returns null when it cannot be calculated reliably (empty
 *   reference). The UI shows "Not Measured" for null. An empty
 *   transcript against a non-empty reference is a real result: WER 1.0
 *   (every word missed), not "Not Measured".
 * - Small-sample honesty: the comparison script is ~23 words, so a
 *   single missed word moves WER by ~4 points. The numbers are a
 *   demonstration measurement, not a benchmark claim.
 *
 * This file uses only erasable TypeScript syntax so the plain-Node test
 * (server/test-metrics.js) can import it directly on Node 24.
 */

export function normalizeText(text: string): string {
  return String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    // Keep letters, combining marks (Devanagari vowel signs, anusvara,
    // chandrabindu — stripping them would corrupt Hindi words like
    // "बैंक" into "बक"), numbers and spaces; drop punctuation.
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function wordTokens(text: string): string[] {
  const norm = normalizeText(text)
  return norm === '' ? [] : norm.split(' ')
}

export type AlignOp = {
  type: 'match' | 'sub' | 'del' | 'ins'
  ref?: string
  hyp?: string
}

/** Levenshtein alignment. Returns { distance, ops }. */
export function levenshtein(
  refTokens: string[],
  hypTokens: string[],
): { distance: number; ops: AlignOp[] } {
  const n = refTokens.length
  const m = hypTokens.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i++) dp[i][0] = i
  for (let j = 0; j <= m; j++) dp[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = refTokens[i - 1] === hypTokens[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  const ops: AlignOp[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && refTokens[i - 1] === hypTokens[j - 1]) {
      ops.push({ type: 'match', ref: refTokens[i - 1], hyp: hypTokens[j - 1] })
      i--
      j--
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.push({ type: 'sub', ref: refTokens[i - 1], hyp: hypTokens[j - 1] })
      i--
      j--
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: 'del', ref: refTokens[i - 1] })
      i--
    } else {
      ops.push({ type: 'ins', hyp: hypTokens[j - 1] })
      j--
    }
  }
  ops.reverse()
  return { distance: dp[n][m], ops }
}

/** Word Error Rate, or null when the reference has no words. */
export function wordErrorRate(reference: string, hypothesis: string): number | null {
  const ref = wordTokens(reference)
  if (ref.length === 0) return null
  const hyp = wordTokens(hypothesis)
  const { distance } = levenshtein(ref, hyp)
  return distance / ref.length
}

/** Character Error Rate on the normalized text (spaces kept), or null. */
export function characterErrorRate(reference: string, hypothesis: string): number | null {
  const ref = normalizeText(reference)
  if (ref.length === 0) return null
  const hyp = normalizeText(hypothesis)
  const { distance } = levenshtein([...ref], [...hyp])
  return distance / ref.length
}

/**
 * Important Phrase Recall. `phrases` is a fixed list of phrases that
 * must survive transcription (e.g. "OTP", "account block"). Matching is
 * on normalized text, so case and punctuation do not matter. Returns
 * { recall, found, missed } or null when the phrase list is empty.
 */
export function importantPhraseRecall(
  hypothesis: string,
  phrases: string[],
): { recall: number; found: string[]; missed: string[] } | null {
  const list = (phrases ?? []).map((p) => normalizeText(p)).filter(Boolean)
  if (list.length === 0) return null
  const hyp = normalizeText(hypothesis)
  const found: string[] = []
  const missed: string[] = []
  for (const phrase of list) {
    if (hyp.includes(phrase)) found.push(phrase)
    else missed.push(phrase)
  }
  return { recall: found.length / list.length, found, missed }
}

/** Word-level diff: which reference words were missed or altered, and
 *  which extra words the transcript added. */
export function diffWords(
  reference: string,
  hypothesis: string,
): { missed: string[]; altered: Array<{ ref: string; hyp: string }>; extra: string[] } {
  const ref = wordTokens(reference)
  const hyp = wordTokens(hypothesis)
  const { ops } = levenshtein(ref, hyp)
  const missed: string[] = []
  const altered: Array<{ ref: string; hyp: string }> = []
  const extra: string[] = []
  for (const op of ops) {
    if (op.type === 'del' && op.ref) missed.push(op.ref)
    else if (op.type === 'sub' && op.ref && op.hyp) altered.push({ ref: op.ref, hyp: op.hyp })
    else if (op.type === 'ins' && op.hyp) extra.push(op.hyp)
  }
  return { missed, altered, extra }
}
