/**
 * Headless Chromium E2E smoke test.
 *
 * Requires `playwright-core` resolvable via NODE_PATH (kept isolated from
 * package.json so the repository stays zero-runtime-dep and lockfile-lean).
 *
 * Env:
 *   PROD_URL  Vite preview URL for the built dist/ bundle (default http://127.0.0.1:4173)
 *   DEV_URL   Optional Vite dev server URL for deep __dbg playthrough verification
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')

const PROD_URL = process.env.PROD_URL ?? 'http://127.0.0.1:4173'
const DEV_URL = process.env.DEV_URL ?? ''

function assert(cond, msg) {
  if (!cond) throw new Error(`Smoke assertion failed: ${msg}`)
}

async function runProdSmoke(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto(`${PROD_URL}/?seed=6767`, { waitUntil: 'networkidle' })
  await page.waitForSelector('canvas#game')

  const box = await page.locator('canvas#game').boundingBox()
  assert(box && box.width >= 1200 && box.height >= 700, `Canvas failed to size: ${JSON.stringify(box)}`)

  const liveAttr = await page.locator('#announcer').getAttribute('aria-live')
  assert(liveAttr === 'polite', `Expected #announcer aria-live="polite", got ${liveAttr}`)

  const hasDbg = await page.evaluate(() => '__dbg' in window)
  assert(!hasDbg, 'window.__dbg leaked into production build')

  // First press unlocks audio, second enters outfit, tweak supplies, third begins voyage
  await page.keyboard.press('Enter')
  await page.waitForTimeout(100)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(100)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)

  // Click the corner minimap hit-region to open the World Chart, then close with Tab
  await page.mouse.click(1220, 112)
  await page.waitForTimeout(120)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(100)

  // Toggle Help overlay
  await page.keyboard.press('h')
  await page.waitForTimeout(100)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)

  // Press Make Camp (on land at full morale -> announces feedback)
  await page.keyboard.press('b')
  await page.waitForTimeout(150)
  const announced = (await page.locator('#announcer').textContent())?.trim() ?? ''
  assert(announced.length > 0, 'Expected #announcer to receive camp feedback in production build')

  // Escape saves to localStorage and returns to title; reload and verify save persisted
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  const saved = await page.evaluate(() => localStorage.getItem('seven-cities-save'))
  assert(typeof saved === 'string' && saved.length > 0, 'Expected seven-cities-save in localStorage')

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('canvas#game')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(100)
  await page.keyboard.press('c') // Continue saved expedition
  await page.waitForTimeout(150)

  assert(errors.length === 0, `Prod console/page errors: ${errors.join('; ')}`)
  await context.close()
  console.log('Prod smoke OK (dist/, minimap click, overlays, announcer, autosave reload, __dbg stripped)')
}

async function runDevDeepSmoke(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto(`${DEV_URL}/?seed=6767`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => '__dbg' in window)

  // Reset deterministically to seed 6767 and advance start -> outfit -> playing
  await page.evaluate(() => window.__dbg.setSeed('6767'))
  await page.keyboard.press('Enter')
  await page.evaluate(() => window.__dbg.step(2))
  assert((await page.evaluate(() => window.__dbg.screen())) === 'outfit', 'Expected outfit screen')

  await page.keyboard.press('Enter')
  await page.evaluate(() => window.__dbg.step(2))
  assert((await page.evaluate(() => window.__dbg.screen())) === 'playing', 'Expected playing screen')

  // 1. Click minimap hit-region -> Escape should close chart and stay on 'playing' (not jump to 'start')
  await page.mouse.click(1220, 112)
  await page.evaluate(() => window.__dbg.step(2))
  await page.keyboard.press('Escape')
  await page.evaluate(() => window.__dbg.step(2))
  assert(
    (await page.evaluate(() => window.__dbg.screen())) === 'playing',
    'Minimap click did not open World Chart (Escape left playing screen)',
  )

  // 2. Make Camp ('b') restores morale, logs 'camp' audio cue, and updates #announcer
  await page.evaluate(() => {
    const st = window.__dbg.world().state
    st.morale = 50
    st.food = Math.max(st.food, 80)
  })
  await page.keyboard.press('b')
  await page.evaluate(() => window.__dbg.step(2))
  const campResult = await page.evaluate(() => ({
    morale: window.__dbg.world().state.morale,
    hasCampCue: window.__dbg.audioLog().some((e) => e.id === 'camp'),
    announcer: document.querySelector('#announcer')?.textContent ?? '',
  }))
  assert(campResult.morale > 50, `Expected camp to raise morale above 50, got ${campResult.morale}`)
  assert(campResult.hasCampCue, 'Expected camp audio cue in audioLog')
  assert(campResult.announcer.includes('Camp pitched'), `Unexpected camp announcement: ${campResult.announcer}`)

  // 3. Landmark discovery logs 'discover' cue and updates #announcer
  const landmarkName = await page.evaluate(() => {
    const w = window.__dbg.world()
    const lm = w.landmarks[0]
    w.explorer.x = lm.x + 0.5
    w.explorer.y = lm.y + 0.5
    window.__dbg.step(2)
    return {
      name: lm.name,
      discovered: w.discovered.has(lm.id),
      hasCue: window.__dbg.audioLog().some((e) => e.id === 'discover'),
      announcer: document.querySelector('#announcer')?.textContent ?? '',
    }
  })
  assert(landmarkName.discovered, `Expected landmark ${landmarkName.name} to be discovered`)
  assert(landmarkName.hasCue, 'Expected discover audio cue in audioLog')
  assert(
    landmarkName.announcer.includes(landmarkName.name),
    `Expected #announcer to mention ${landmarkName.name}, got: ${landmarkName.announcer}`,
  )

  // 4. Enter walk-in village scene, walk up to chief, trigger encounter, use [4] Amaze, then leave
  const villageIdx = await page.evaluate(() => {
    const w = window.__dbg.world()
    w.state.fear = 0
    const active = w.villages.filter((v) => !v.depleted)
    let best = 0
    for (let i = 1; i < active.length; i++) {
      if (active[i].temperament > active[best].temperament) best = i
    }
    window.__dbg.teleportToVillage(best)
    return best
  })
  assert(villageIdx >= 0, 'Expected at least one active village')
  await page.keyboard.press('e')
  await page.evaluate(() => window.__dbg.step(2))
  assert((await page.evaluate(() => window.__dbg.screen())) === 'walkin', 'Expected walkin screen after pressing e')
  assert(await page.evaluate(() => window.__dbg.walkin() !== null), 'Expected active walkin scene')

  // Walk north toward the chief inside the walk-in plaza (exercises drawWalkin + tickScene)
  await page.keyboard.down('ArrowUp')
  let reachedEncounter = false
  for (let i = 0; i < 40; i++) {
    reachedEncounter = await page.evaluate(() => {
      window.__dbg.step(10)
      return window.__dbg.encounter() !== null
    })
    if (reachedEncounter) break
  }
  await page.keyboard.up('ArrowUp')
  assert(reachedEncounter, 'Expected walking north in walk-in to reach chief encounter')

  // Use [4] Amaze during parley, then Esc to close encounter
  await page.keyboard.press('4')
  await page.evaluate(() => window.__dbg.step(2))
  await page.keyboard.press('Escape')
  await page.evaluate(() => window.__dbg.step(2))
  assert(await page.evaluate(() => window.__dbg.encounter() === null), 'Expected Escape to close encounter')
  assert((await page.evaluate(() => window.__dbg.storage().ok)) === true, 'Expected save storage ok')

  // 5. Offline WebAudio synthesis probes (src/app/devhooks.ts)
  const audioCheck = await page.evaluate(async () => {
    const discover = await window.__dbg.renderCue('discover')
    const camp = await window.__dbg.renderCue('camp')
    const theme = await window.__dbg.renderTheme('title', 1)
    const scene = window.__dbg.audioScene()
    return { discoverRms: discover.rms, campRms: camp.rms, themeRms: theme.rms, hasControls: !!scene?.controls }
  })
  assert(audioCheck.discoverRms > 0, `Expected discover cue rms > 0, got ${audioCheck.discoverRms}`)
  assert(audioCheck.campRms > 0, `Expected camp cue rms > 0, got ${audioCheck.campRms}`)
  assert(audioCheck.themeRms > 0, `Expected title theme rms > 0, got ${audioCheck.themeRms}`)
  assert(audioCheck.hasControls, 'Expected audioScene() controls')

  assert(errors.length === 0, `Dev deep smoke console/page errors: ${errors.join('; ')}`)
  await context.close()
  console.log('Dev deep smoke OK (minimap, camp, landmark, walk-in, chief encounter, [4] Amaze, offline audio)')
}

;(async () => {
  const browser = await chromium.launch()
  try {
    await runProdSmoke(browser)
    if (DEV_URL) await runDevDeepSmoke(browser)
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
