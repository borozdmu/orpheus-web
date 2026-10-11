import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const target = process.env.ORPHEUS_UPSTREAM ?? 'http://127.0.0.1:8000'
const base = process.env.ORPHEUS_WEB_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: Object.fromEntries(['/api/', '/auth/', '/saml/'].map((path) => [base.slice(0, -1) + path, {
      target, rewrite: (url: string) => url.slice(base.length - 1),
    }])),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
})
