import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it('generates deep links below the configured base', async () => {
  vi.stubEnv('BASE_URL', '/orpheus/')
  const { router } = await import('./index')
  expect(router.resolve('/sessions/one/runs/two').href).toBe('/orpheus/sessions/one/runs/two')
  expect(router.resolve('/limits').href).toBe('/orpheus/limits')
})
