import { defineConfig } from 'vitest/config'

// an assigned PORT (preview tooling) wins; otherwise Vite's default
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
const port = Number(env?.PORT) || undefined

export default defineConfig({
  // relative asset URLs so the build runs from any subpath (Pages project site, itch.io)
  base: './',
  ...(port ? { server: { port } } : {}),
  test: { globals: true },
})
