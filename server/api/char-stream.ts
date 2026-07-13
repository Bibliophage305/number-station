import { getCurrentChar } from '../utils/schedule'

export default defineEventHandler(async (event) => {
  const stream = createEventStream(event)

  const pushCurrentChar = async () => {
    const now = new Date()
    await stream.push(
      JSON.stringify({ char: getCurrentChar(now), time: now.toISOString() })
    )
  }

  // Send one immediately so the client doesn't wait up to a second for
  // its first character after connecting.
  pushCurrentChar()

  // Align to the next whole second, then push once per second after that -
  // same alignment logic the client used to do itself when polling.
  const msIntoSecond = Date.now() % 1000
  let interval: ReturnType<typeof setInterval> | undefined
  const alignTimeout = setTimeout(() => {
    pushCurrentChar()
    interval = setInterval(pushCurrentChar, 1000)
  }, 1000 - msIntoSecond)

  // Runs when the client disconnects (tab closed, navigated away, etc.) -
  // without this the interval keeps running on the server forever, one
  // per abandoned connection.
  stream.onClosed(async () => {
    clearTimeout(alignTimeout)
    if (interval) clearInterval(interval)
    await stream.close()
  })

  return stream.send()
})