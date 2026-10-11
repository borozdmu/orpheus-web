import { expect, test } from '@playwright/test'
import { mockAPI } from './fixtures'
import { sid } from '../src/test/fixtures'

test('keeps navigation, API, SSE, assets and deep-link reloads under the base', async ({ page, baseURL }) => {
  await mockAPI(page)
  const base = new URL(baseURL!).pathname
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto(base)
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Sessions', exact: true })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Sessions', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${base}sessions$`))
  await page.goto(`${base}sessions/${sid}`)
  await expect(page.getByText('The pagination fix is ready.', { exact: false }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('navigation')).toBeVisible()
  await expect.poll(() => requests.some((url) => url.includes('/events/stream?'))).toBe(true)
  for (const url of requests) {
    const path = new URL(url).pathname
    if (/\/(api|auth|assets)\/|\.(svg|png|woff2)$/.test(path)) expect(path).toMatch(new RegExp(`^${base}`))
  }
  const images = await page.locator('header img').evaluateAll((images) => images.map((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))
  expect(images.every(Boolean)).toBe(true)
})
