import { afterEach, expect, it, vi } from 'vitest'
import { SSEDecoder, streamEvents } from './stream'
import { MessageEventType } from './generated'
import { message, sid, timestamp } from '../test/fixtures'
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it('streams from the prefixed API and preserves the cursor and cancellation signal', async () => {
  vi.stubEnv('BASE_URL', '/orpheus/')
  const fetcher = vi.fn().mockResolvedValue(new Response('', { headers: { 'Content-Type': 'text/event-stream' } }))
  vi.stubGlobal('fetch', fetcher)
  const signal = new AbortController().signal
  await expect(streamEvents('a/b', '9007199254740993', signal, vi.fn(), vi.fn())).rejects.toThrow('disconnected')
  expect(fetcher.mock.calls[0]).toMatchObject([
    '/orpheus/api/v1/sessions/a%2Fb/events/stream?after=9007199254740993',
    { signal, credentials: 'same-origin' },
  ])
})
it('parses split CRLF, comments and multiline data without converting the cursor to a Number', () => {
  const data = { type: MessageEventType.message_updated, id: '9007199254740993', data: message(), session_id: sid, created_at: timestamp }
  const received: unknown[] = []
  const decoder = new SSEDecoder((event) => received.push(event))
  const raw = ': heartbeat\r\n\r\nid: 9007199254740993\r\nevent: message.updated\r\ndata: ' + JSON.stringify(data) + '\r\n\r\n'
  for (const char of raw) decoder.feed(char)
  expect(received).toEqual([data])
})
it('does not dispatch a partial frame and rejects cursor mismatch', () => {
  const received: unknown[] = []
  const decoder = new SSEDecoder((event) => received.push(event))
  decoder.feed('id: 9\ndata: {"id":"10"}\n')
  expect(received).toEqual([])
  expect(() => decoder.feed('\n')).toThrow(/cursor/)
})
