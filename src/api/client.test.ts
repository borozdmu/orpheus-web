import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, get, logout, onAccessFailure } from './client'
import { PathsApiV1SessionsGetParametersQueryActivity as Activity } from './generated'
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('API transport', () => {
  it('keeps reads and logout below the configured ingress prefix', async () => {
    vi.stubEnv('BASE_URL', '/orpheus/')
    const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [] }))
    vi.stubGlobal('fetch', fetcher)
    await get('/api/v1/sessions/{sid}', { path: { sid: 'a/b' }, signal: new AbortController().signal })
    await logout(new AbortController().signal)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/orpheus/api/v1/sessions/a%2Fb', '/orpheus/auth/logout'])
  })
  it('encodes opaque keys and passes the abort signal and same-origin credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [], next_cursor: null }))
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    await get('/api/v1/sessions', { signal, query: { namespace: 'team / A', external_key: 'a&b', activity: Activity.active } })
    const [url, options] = fetcher.mock.calls[0]
    expect(new URL(url, 'http://example.test').searchParams.get('external_key')).toBe('a&b')
    expect(options).toMatchObject({ signal, credentials: 'same-origin' })
    expect(options.headers).not.toHaveProperty('Authorization')
  })
  it('reports auth failures centrally, preserving status and structured error', async () => {
    const failed = vi.fn()
    const remove = onAccessFailure(failed)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'unauthorized', message: 'Sign in', details: [], phase: null } }, { status: 401 })))
    await expect(get('/api/v1/accounts/limits', { signal: new AbortController().signal })).rejects.toMatchObject({ status: 401, problem: { code: 'unauthorized' } })
    expect(failed).toHaveBeenCalledWith(401)
    remove()
  })
  it('reports non-JSON proxy errors without treating HTML as API data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })))
    await expect(get('/api/v1/accounts/limits', { signal: new AbortController().signal })).rejects.toBeInstanceOf(ApiError)
  })
  it('sends the required logout CSRF header', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    await logout(new AbortController().signal)
    expect(fetcher.mock.calls[0]).toMatchObject(['/auth/logout', { method: 'POST', headers: { 'X-Orpheus-CSRF': '1' } }])
  })
  it('does not invalidate read access when logout is rejected', async () => {
    const failed = vi.fn()
    const remove = onAccessFailure(failed)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'forbidden', message: 'Invalid origin' } }, { status: 403 })))
    await expect(logout(new AbortController().signal)).rejects.toMatchObject({ status: 403 })
    expect(failed).not.toHaveBeenCalled()
    remove()
  })
})
