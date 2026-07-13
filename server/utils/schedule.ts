import { broadcasts, type Broadcast, type RepeatType } from '../data/broadcasts'

/**
 * Change this to something private (e.g. read from process.env / Nuxt
 * runtimeConfig.numberStationSalt) before deploying. Anyone who has your
 * source AND knows this constant can precompute every "random" char in
 * advance, so don't commit the real value to a public repo.
 */
const SALT = 0x9e3779b9

function periodSeconds(repeat: RepeatType): number | null {
  switch (repeat) {
    case 'five-minutes':
      return 300
    case 'ten-minutes':
      return 600
    case 'hourly':
      return 3600
    case 'daily':
      return 86400
    case 'weekly':
      return 604800
    default:
      return null // 'monthly' and 'once' need calendar-aware handling
  }
}

/**
 * For a given broadcast, find the start time of the occurrence that would
 * be active at `now`, if any. Returns null if the broadcast hasn't started
 * repeating yet at all. Does NOT check duration - callers must also check
 * that `now` falls within `numbers.length` seconds of the result.
 *
 * All calendar math is done in UTC to avoid DST/timezone ambiguity.
 */
export function getOccurrenceStart(b: Broadcast, now: Date): Date | null {
  const nowMs = now.getTime()
  const startMs = b.start.getTime()

  if (b.repeat === 'once') {
    return nowMs >= startMs ? b.start : null
  }

  if (nowMs < startMs) return null

  const period = periodSeconds(b.repeat)
  if (period) {
    const elapsedPeriods = Math.floor((nowMs - startMs) / (period * 1000))
    return new Date(startMs + elapsedPeriods * period * 1000)
  }

  // Monthly: variable period, so step through calendar months instead of
  // using fixed arithmetic. If the anchor day doesn't exist in a given
  // month (e.g. the 31st in February), it's clamped to that month's last
  // day - decide if that's the behaviour you want, or skip such months.
  const anchor = b.start
  const candidate = new Date(now)
  candidate.setUTCFullYear(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const daysInMonth = new Date(
    Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0)
  ).getUTCDate()
  candidate.setUTCDate(Math.min(anchor.getUTCDate(), daysInMonth))
  candidate.setUTCHours(
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    0
  )

  if (candidate.getTime() > nowMs) {
    const prev = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() - 1, 1))
    const daysInPrev = new Date(
      Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 0)
    ).getUTCDate()
    prev.setUTCDate(Math.min(anchor.getUTCDate(), daysInPrev))
    prev.setUTCHours(anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), 0)
    return prev.getTime() >= startMs ? prev : null
  }

  return candidate
}

/** The char this broadcast is transmitting at `now`, or null if inactive. */
export function activeChar(b: Broadcast, now: Date): string | null {
  const occStart = getOccurrenceStart(b, now)
  if (!occStart) return null
  const elapsedSec = Math.floor((now.getTime() - occStart.getTime()) / 1000)
  if (elapsedSec < 0 || elapsedSec >= b.numbers.length) return null
  return b.numbers[elapsedSec]
}

/**
 * Deterministic, stateless "random" char for a given unix second.
 * Same second -> same char, for every user, every server instance,
 * with no shared mutable state needed. Not cryptographically secure,
 * but not meant to be - it just needs to look uniform to a casual observer.
 */
export function pseudoRandomChar(unixSeconds: number, salt = SALT): string {
  let h = (unixSeconds ^ salt) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822519)
  h = Math.imul(h ^ (h >>> 13), 3266489917)
  h ^= h >>> 16
  return String((h >>> 0) % 10)
}

/**
 * The single source of truth for "what char is on air right now".
 * This is the only thing that should ever cross the server/client boundary.
 */
export function getCurrentChar(now: Date = new Date()): string {
  for (const b of broadcasts) {
    const d = activeChar(b, now)
    if (d !== null) return d
  }
  const sec = Math.floor(now.getTime() / 1000)
  return String(pseudoRandomChar(sec))
}