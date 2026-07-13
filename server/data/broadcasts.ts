/**
 * SERVER-ONLY DATA.
 *
 * This file must only ever be imported from other files under /server.
 * Nitro (Nuxt's server engine) keeps everything under /server out of the
 * client bundle automatically - but only as long as nothing client-side
 * (pages, components, composables, plugins/*.client.ts) imports it,
 * directly or transitively. If you ever see `broadcasts` show up in
 * the browser's network tab or bundle, something imported this from
 * the wrong place.
 */

export type RepeatType = 'once' | 'five-minutes' | 'ten-minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface Broadcast {
  /** Unique id, used only in server logs/errors - never sent to the client */
  id: string
  /** Anchor date/time (to-the-second). For repeating broadcasts, this is
   *  the first occurrence; later ones are derived from it. */
  start: Date
  repeat: RepeatType
  /** One char per second, broadcast starting at `start` (or each occurrence). */
  message: string
}

export const broadcasts: Broadcast[] = [
  {
    id: 'thom-message',
    start: new Date('2026-01-01T22:00:00Z'),
    repeat: 'five-minutes',
    message: 'HI THOM',
  },
]