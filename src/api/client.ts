import type { ErrorResponse, paths } from './generated'
import { appPath } from '../base'

type JSONGet<P> = P extends { get: { responses: { 200: { content: { 'application/json': unknown } } } } } ? P : never
type GetPath = { [P in keyof paths]: JSONGet<paths[P]> extends never ? never : P }[keyof paths]
type Operation<P extends GetPath> = paths[P]['get']
type Params<P extends GetPath> = Operation<P> extends { parameters: infer T } ? T : never
type Query<P extends GetPath> = Params<P> extends { query?: infer Q } ? Q : never
type PathParams<P extends GetPath> = Params<P> extends { path?: infer R } ? R : never
type Response<P extends GetPath> = Operation<P> extends { responses: { 200: { content: { 'application/json': infer R } } } } ? R : never

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem?: ErrorResponse['error']) {
    super(problem?.message ?? `HTTP ${status}`)
  }
}

let accessFailure: ((status: number) => void) | undefined
export function onAccessFailure(handler: (status: number) => void) {
  accessFailure = handler
  return () => { if (accessFailure === handler) accessFailure = undefined }
}

export async function checkResponse(response: globalThis.Response, reportAccessFailure = true) {
  if (response.ok) return
  if (reportAccessFailure && (response.status === 401 || response.status === 403)) accessFailure?.(response.status)
  const payload: ErrorResponse | null = await response.json().catch(() => null)
  throw new ApiError(response.status, payload?.error)
}

export async function get<P extends GetPath>(path: P, options: {
  signal: AbortSignal
  query?: Query<P>
} & (PathParams<P> extends undefined ? { path?: never } : { path: PathParams<P> })): Promise<Response<P>> {
  let url: string = appPath(path)
  for (const [name, value] of Object.entries(options.path ?? {})) url = url.replace(`{${name}}`, encodeURIComponent(String(value)))
  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null) query.set(name, String(value))
  }
  const response = await fetch(url + (query.size ? `?${query}` : ''), {
    credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: options.signal,
  })
  await checkResponse(response)
  return response.json() as Promise<Response<P>>
}

export async function logout(signal: AbortSignal) {
  const response = await fetch(appPath('/auth/logout'), {
    method: 'POST', credentials: 'same-origin', signal, headers: { 'X-Orpheus-CSRF': '1' },
  })
  await checkResponse(response, false)
}
