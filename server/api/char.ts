import { getCurrentChar } from '../utils/schedule'

const WINDOW_SECONDS = 60

export default defineEventHandler(() => {
  // Deliberately ignore any client-supplied time/query params. Using only
  // the server's own clock is what keeps the schedule secret - if a client
  // could pass its own timestamp, it could probe future moments and map
  // out exactly when broadcasts happen before they air.
  //
  // Response shape is identical regardless of whether a given char came
  // from a broadcast or the random generator - just char + time, nothing else.
  const now = Date.now()
  const nowSec = Math.floor(now / 1000)

  const entries: { char: string; time: string }[] = []
  for (let i = WINDOW_SECONDS - 1; i >= 0; i--) {
    const t = new Date((nowSec - i) * 1000)
    entries.push({ char: getCurrentChar(t), time: t.toISOString() })
  }
  return entries
})