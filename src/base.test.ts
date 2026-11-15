import { afterEach, expect, it, vi } from 'vitest'
import { appPath } from './base'

afterEach(() => vi.unstubAllEnvs())

it.each(['/', '/orpheus/'])('keeps API, auth and asset URLs under %s', (base) => {
  vi.stubEnv('BASE_URL', base)
  expect(appPath('/api/v1/sessions?a=1')).toBe(`${base}api/v1/sessions?a=1`)
  expect(appPath('/auth/logout')).toBe(`${base}auth/logout`)
  expect(appPath('favicon.svg')).toBe(`${base}favicon.svg`)
})
