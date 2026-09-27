import { defineConfig } from 'vitest/config'

export default defineConfig({
  // relative asset URLs so the build runs from any subpath (Pages project site, itch.io)
  base: './',
  test: { globals: true },
})
