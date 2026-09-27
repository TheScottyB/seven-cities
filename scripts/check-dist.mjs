// Fails the build if the dev-only window.__dbg hook survived into the production bundle.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assets = fileURLToPath(new URL('../dist/assets/', import.meta.url))
const MARKERS = ['__dbg', 'teleportToVillage', 'renderTexture']

if (!existsSync(assets)) {
  console.error(`check-dist: ${assets} is missing; run vite build first`)
  process.exit(1)
}

let failed = false
for (const name of readdirSync(assets)) {
  if (!name.endsWith('.js')) continue
  const src = readFileSync(join(assets, name), 'utf8')
  for (const marker of MARKERS) {
    if (src.includes(marker)) {
      console.error(`check-dist: dist/assets/${name} contains '${marker}'`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log('check-dist: OK')
