/**
 * CallSuraksha AI — Gnani concurrency cap (Phase A).
 *
 * At most 2 Gnani API calls (transcribe + guidance combined) run at the
 * same time. A third caller gets a busy response instead of queuing: on
 * the 512 MB free-tier instance, unbounded parallel 5 MB uploads plus
 * upstream calls could exhaust memory, and parallel calls also burn
 * credits faster. One tiny in-process counter is enough — the service
 * runs as a single instance.
 */

export const MAX_CONCURRENT_GNANI = 2

let active = 0

/** Take a slot if one is free; false when both are busy. */
export function tryAcquireGnaniSlot() {
  if (active >= MAX_CONCURRENT_GNANI) return false
  active += 1
  return true
}

/** Give a slot back. Always call it in a `finally` after acquiring. */
export function releaseGnaniSlot() {
  if (active > 0) active -= 1
}

/** How many Gnani calls are in flight right now (tests + logging). */
export function activeGnaniCalls() {
  return active
}
