import { checkResponse } from './client'
import { appPath } from '../base'
import type { Event } from './generated'

export class SSEDecoder {
  private buffer = ''
  private data: string[] = []
  private id = ''
  constructor(private readonly receive: (event: Event) => void) {}
  feed(chunk: string) {
    this.buffer += chunk
    if (this.buffer.length > 16 * 1024 * 1024) throw new Error('SSE frame exceeds the browser limit')
    for (;;) {
      const index = this.buffer.search(/[\r\n]/)
      if (index < 0 || (this.buffer[index] === '\r' && index === this.buffer.length - 1)) return
      const line = this.buffer.slice(0, index)
      const length = this.buffer[index] === '\r' && this.buffer[index + 1] === '\n' ? 2 : 1
      this.buffer = this.buffer.slice(index + length)
      if (line === '') {
        if (this.data.length) {
          const event = JSON.parse(this.data.join('\n')) as Event
          if (!/^\d+$/.test(this.id) || event.id !== this.id) throw new Error('Invalid SSE event cursor')
          this.receive(event)
        }
        this.data = []
        this.id = ''
      } else {
        const colon = line.indexOf(':')
        const name = colon < 0 ? line : line.slice(0, colon)
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
        if (name === 'data') this.data.push(value)
        if (name === 'id' && !value.includes('\0')) this.id = value
      }
    }
  }
}

export async function streamEvents(sid: string, cursor: string, signal: AbortSignal, receive: (event: Event) => void, connected: () => void) {
  const response = await fetch(appPath(`/api/v1/sessions/${encodeURIComponent(sid)}/events/stream?${new URLSearchParams({ after: cursor })}`), {
    signal, credentials: 'same-origin', headers: { Accept: 'text/event-stream' },
  })
  await checkResponse(response)
  if (!response.body || !response.headers.get('Content-Type')?.startsWith('text/event-stream')) throw new Error('Expected an event stream')
  connected()
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const parser = new SSEDecoder((event) => { if (!signal.aborted) receive(event) })
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) throw new Error('Event stream disconnected')
      parser.feed(decoder.decode(value, { stream: true }))
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
