/**
 * CallSuraksha AI — metrics tests (Phase 8).
 *
 * Plain Node, no framework: `node server/test-metrics.js`
 * (or `npm run test:metrics` from the app root).
 * Covers WER, CER, Important Phrase Recall, word diffs, Unicode
 * normalization, and the null ("Not Measured") cases.
 * Exit code 0 = all pass, 1 = any failure.
 */

import {
  characterErrorRate,
  diffWords,
  importantPhraseRecall,
  levenshtein,
  normalizeText,
  wordErrorRate,
  wordTokens,
} from '../src/lib/metrics.ts'

let passed = 0
let failed = 0
function check(name, ok, extra = '') {
  if (ok) {
    passed += 1
    console.log(`PASS ${name}`)
  } else {
    failed += 1
    console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`)
  }
}
function approx(a, b) {
  return a !== null && b !== null && Math.abs(a - b) < 1e-9
}

// --- Normalization ---------------------------------------------------------
check('normalize: Devanagari danda + punctuation removed', normalizeText('नमस्ते। मैं, आपके bank से बोल रहा हूँ!') === 'नमस्ते मैं आपके bank से बोल रहा हूँ')
check('normalize: lowercase + collapse spaces', normalizeText('  OTP   Batao  ') === 'otp batao')
check('normalize: NFC composes decomposed accents', normalizeText('é') === 'é')
check('normalize: empty stays empty', normalizeText('   ') === '')
check('wordTokens: empty text -> []', wordTokens('').length === 0)
check('wordTokens: splits on spaces', JSON.stringify(wordTokens('a b  c')) === JSON.stringify(['a', 'b', 'c']))

// --- Levenshtein -----------------------------------------------------------
check('levenshtein: identical -> 0', levenshtein(['a', 'b'], ['a', 'b']).distance === 0)
check('levenshtein: one substitution -> 1', levenshtein(['a', 'b', 'c'], ['a', 'x', 'c']).distance === 1)
check('levenshtein: deletion -> 1', levenshtein(['a', 'b', 'c'], ['a', 'c']).distance === 1)
check('levenshtein: insertion -> 1', levenshtein(['a', 'c'], ['a', 'b', 'c']).distance === 1)
check('levenshtein: empty hyp -> all deleted', levenshtein(['a', 'b'], []).distance === 2)

// --- WER -------------------------------------------------------------------
check('wer: identical -> 0', wordErrorRate('otp batao turant', 'OTP batao turant') === 0)
check('wer: 1 sub in 4 words -> 0.25', approx(wordErrorRate('a b c d', 'a x c d'), 0.25))
check('wer: 1 del in 4 words -> 0.25', approx(wordErrorRate('a b c d', 'a c d'), 0.25))
check('wer: 1 ins in 4 words -> 0.25', approx(wordErrorRate('a b c d', 'a b x c d'), 0.25))
check('wer: empty hypothesis -> 1.0 (all missed)', wordErrorRate('a b c', '') === 1)
check('wer: empty reference -> null (Not Measured)', wordErrorRate('', 'a b') === null)
check('wer: Hindi 1 sub in 5 words -> 0.2',
  approx(wordErrorRate('नमस्ते मैं आपके बैंक से', 'नमस्ते मैं आपके बैंक में'), 0.2))
check('wer: Roman vs Devanagari counts as different',
  wordErrorRate('otp batao', 'ओटीपी बताओ') === 1)

// --- CER -------------------------------------------------------------------
check('cer: identical -> 0', characterErrorRate('otp', 'OTP') === 0)
check('cer: kitten -> sitting = 3/6 = 0.5', approx(characterErrorRate('kitten', 'sitting'), 0.5))
check('cer: one char changed in 3 -> 1/3', approx(characterErrorRate('abc', 'axc'), 1 / 3))
check('cer: empty reference -> null', characterErrorRate('', 'abc') === null)
check('cer: empty hypothesis -> 1.0', characterErrorRate('abc', '') === 1)
check('cer: Devanagari one char changed',
  approx(characterErrorRate('बैंक', 'बेंक'), 1 / 4))

// --- Important Phrase Recall ----------------------------------------------
const phrases = ['OTP', 'account block', 'bank']
const recallAll = importantPhraseRecall('Apna OTP batao, account block ho gaya, bank se bol raha hoon', phrases)
check('recall: all 3 phrases found -> 1.0', recallAll?.recall === 1 && recallAll.found.length === 3)
const recallHalf = importantPhraseRecall('Bank se bol raha hoon, OTP batao', ['OTP', 'account block'])
check('recall: 1 of 2 found -> 0.5, missed listed',
  recallHalf?.recall === 0.5 && JSON.stringify(recallHalf.missed) === JSON.stringify(['account block']))
check('recall: case + punctuation insensitive',
  importantPhraseRecall('OTP! batao.', ['otp'])?.recall === 1)
check('recall: empty phrase list -> null', importantPhraseRecall('otp', []) === null)
check('recall: Devanagari phrase',
  importantPhraseRecall('कृपया अपना ओटीपी बताइये', ['ओटीपी'])?.recall === 1)

// --- Word diff ---------------------------------------------------------------
const diff = diffWords('a b c d', 'a x c d e')
check('diff: missed word', JSON.stringify(diff.missed) === JSON.stringify([]))
check('diff: altered word', diff.altered.length === 1 && diff.altered[0].ref === 'b' && diff.altered[0].hyp === 'x')
check('diff: extra word', JSON.stringify(diff.extra) === JSON.stringify(['e']))
const diff2 = diffWords('otp batao turant', 'otp turant')
check('diff: deleted word listed as missed', JSON.stringify(diff2.missed) === JSON.stringify(['batao']))

console.log(`\n${passed}/${passed + failed} passed`)
process.exit(failed === 0 ? 0 : 1)
