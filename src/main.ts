import { generateMap } from './world/mapgen'
import { placeVillages, nearestUnvisitedGolden, type Village } from './world/villages'
import { makeFog, reveal } from './world/fog'
import { makeState, tick, score, GameStatus } from './game/state'
import { makeExplorer, moveExplorer } from './game/explorer'
import { discoverVillage, resolveTrade, resolveGift, resolveAttack } from './game/encounter'
import { defaultOutfit, adjustOutfit, remainingBudget, type Outfit } from './game/outfit'
import { serializeSave, deserializeSave, unpackBits, type SaveData } from './game/save'
import { buildTileset } from './art/tileset'
import { Input } from './engine/input'
import { centerCamera, type Camera } from './engine/camera'
import { startLoop } from './engine/loop'
import { renderWorld, renderMinimap, type RenderCtx } from './engine/renderer'
import { drawHud } from './ui/hud'
import { drawStartScreen, drawOutfitScreen, drawEncounter, drawGameOver, drawResult } from './ui/panels'
import { seedFromString } from './world/rng'

const REVEAL_RADIUS = 7
const VILLAGE_COUNT = 28
const INTERACT_DIST = 1.4
const RUMOR_RADIUS = 4
const AUTOSAVE_EVERY = 5 // seconds
const SAVE_KEY = 'seven-cities-save'

type Screen = 'start' | 'outfit' | 'playing' | 'over'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const input = new Input()

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}
resize()
window.addEventListener('resize', resize)

interface World {
  seedStr: string
  map: ReturnType<typeof generateMap>
  villages: Village[]
  fog: ReturnType<typeof makeFog>
  state: ReturnType<typeof makeState>
  explorer: ReturnType<typeof makeExplorer>
  cam: Camera
}

const tileset = buildTileset()
let screen: Screen = 'start'
let world: World = newWorld('1492')
let outfit: Outfit = defaultOutfit()
let outfitRow = 0
let encounter: Village | null = null
let flash = { text: '', t: 0 }
let autosaveIn = AUTOSAVE_EVERY
let timeScale = 1 // dev hook can raise this for fast playtests

function newWorld(seedStr: string): World {
  const seed = seedFromString(seedStr)
  const map = generateMap(seed)
  const villages = placeVillages(map, VILLAGE_COUNT)
  const fog = makeFog(map.width, map.height)
  const explorer = makeExplorer(map)
  reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), REVEAL_RADIUS)
  return { seedStr, map, villages, fog, state: makeState(), explorer, cam: { x: explorer.x, y: explorer.y } }
}

function embark() {
  world = newWorld(world.seedStr)
  world.state.food = outfit.food
  world.state.goods = outfit.goods
  world.state.crew = outfit.crew
  world.state.gold = remainingBudget(outfit)
  encounter = null
  screen = 'playing'
}

// --- save / load ---------------------------------------------------------

function saveGame() {
  if (world.state.status !== GameStatus.Playing) return
  try {
    localStorage.setItem(
      SAVE_KEY,
      serializeSave({
        seedStr: world.seedStr,
        state: world.state,
        explorer: { x: world.explorer.x, y: world.explorer.y },
        fogSeen: world.fog.seen,
        villages: world.villages,
      }),
    )
  } catch {
    // storage full/blocked — the game just plays without saves
  }
}

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? deserializeSave(raw) : null
  } catch {
    return null
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}

function restoreWorld(save: SaveData): World {
  const w = newWorld(save.seedStr)
  w.state = { ...save.state }
  w.explorer.x = save.explorer.x
  w.explorer.y = save.explorer.y
  w.fog.seen = unpackBits(save.fogSeenB64, w.fog.seen.length)
  w.fog.revealedCount = w.fog.seen.reduce((a, b) => a + b, 0)
  // the map (and thus village placement) regenerates identically from the
  // seed; only the mutable per-village fields need restoring
  if (save.villages.length === w.villages.length) {
    save.villages.forEach((sv, i) => Object.assign(w.villages[i], sv))
  }
  w.cam = { x: w.explorer.x, y: w.explorer.y }
  return w
}

// --- update --------------------------------------------------------------

function nearestVillage(): Village | null {
  let best: Village | null = null
  let bestD = INTERACT_DIST
  for (const v of world.villages) {
    if (v.depleted) continue
    const d = Math.hypot(v.x + 0.5 - world.explorer.x, v.y + 0.5 - world.explorer.y)
    if (d <= bestD) {
      bestD = d
      best = v
    }
  }
  return best
}

function update(dt: number) {
  if (screen === 'start') {
    if (input.pressed('enter')) {
      outfit = defaultOutfit()
      outfitRow = 0
      screen = 'outfit'
    } else if (input.pressed('c')) {
      const save = loadSave()
      if (save) {
        world = restoreWorld(save)
        encounter = null
        screen = 'playing'
      }
    }
    input.endFrame()
    return
  }

  if (screen === 'outfit') {
    const fields: (keyof Outfit)[] = ['food', 'goods', 'crew']
    if (input.pressed('up')) outfitRow = (outfitRow + fields.length - 1) % fields.length
    if (input.pressed('down')) outfitRow = (outfitRow + 1) % fields.length
    if (input.pressed('left')) outfit = adjustOutfit(outfit, fields[outfitRow], -1)
    if (input.pressed('right')) outfit = adjustOutfit(outfit, fields[outfitRow], 1)
    if (input.pressed('enter')) embark()
    if (input.pressed('esc')) screen = 'start'
    input.endFrame()
    return
  }

  if (screen === 'over') {
    if (input.pressed('enter')) {
      world = newWorld(String(1492 + (Math.floor(performance.now()) % 9999)))
      outfit = defaultOutfit()
      outfitRow = 0
      encounter = null
      screen = 'outfit'
    }
    input.endFrame()
    return
  }

  // playing
  const sdt = dt * timeScale
  const { map, fog, state, explorer } = world
  if (flash.t > 0) flash.t -= sdt

  if (encounter) {
    if (input.pressed('1')) chooseEncounter('trade')
    else if (input.pressed('2')) chooseEncounter('gift')
    else if (input.pressed('3')) chooseEncounter('attack')
    else if (input.pressed('esc')) encounter = null
  } else {
    const { dx, dy } = input.axis()
    moveExplorer(map, explorer, dx, dy, sdt)
    reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), REVEAL_RADIUS)
    tick(state, sdt)

    if (input.pressed('action')) {
      const v = nearestVillage()
      if (v) {
        const firstGolden = v.golden && !v.visited
        discoverVillage(state, v)
        if (firstGolden) {
          flash = { text: `A City of Gold — ${state.citiesFound} of 7 found!`, t: 3 }
        }
        encounter = v
      }
    }

    if (input.pressed('esc')) {
      // save and return to the title screen; Continue picks it right back up
      saveGame()
      screen = 'start'
      flash = { text: '', t: 0 }
    }

    autosaveIn -= sdt
    if (autosaveIn <= 0) {
      autosaveIn = AUTOSAVE_EVERY
      saveGame()
    }

    if (state.status !== GameStatus.Playing) {
      clearSave()
      screen = 'over'
    }
  }

  centerCamera(world.cam, explorer.x, explorer.y, canvas.width, canvas.height, map.width, map.height)
  input.endFrame()
}

function chooseEncounter(action: 'trade' | 'gift' | 'attack') {
  const v = encounter!
  const { state, villages, fog } = world
  const goldBefore = state.gold
  const crewBefore = state.crew
  const goodsBefore = state.goods

  if (action === 'trade') resolveTrade(state, v)
  else if (action === 'gift') resolveGift(state, v)
  else resolveAttack(state, v)

  if (action === 'gift') {
    if (state.goods < goodsBefore) {
      // natives share rumors: chart the land around the nearest unfound city
      const target = nearestUnvisitedGolden(villages, v.x, v.y)
      if (target) {
        reveal(fog, target.x, target.y, RUMOR_RADIUS)
        flash = { text: 'The elders speak of a golden city... (see your map)', t: 3.5 }
      } else {
        flash = { text: 'You offer gifts. Goodwill rises.', t: 2.5 }
      }
    } else {
      flash = { text: 'You have no goods left to give.', t: 2.5 }
    }
  } else if (action === 'trade') {
    const gained = state.gold - goldBefore
    flash =
      gained > 0
        ? { text: `Traded for ${gained} gold.`, t: 2.5 }
        : { text: 'No goods to trade with!', t: 2.5 }
  } else {
    const lost = crewBefore - state.crew
    flash = { text: `Raid! +${state.gold - goldBefore} gold, ${lost} crew lost.`, t: 2.5 }
  }
  encounter = null
  saveGame()
}

// --- render --------------------------------------------------------------

function render() {
  const rc: RenderCtx = { ctx, viewW: canvas.width, viewH: canvas.height, tileset }

  if (screen === 'start') {
    drawStartScreen(ctx, canvas.width, canvas.height, world.seedStr, loadSave() !== null)
    return
  }
  if (screen === 'outfit') {
    drawOutfitScreen(ctx, canvas.width, canvas.height, outfit, outfitRow)
    return
  }

  renderWorld(rc, world.cam, world.map, world.fog, world.villages, world.explorer)
  renderMinimap(rc, world.map, world.fog, world.explorer, world.villages)
  drawHud(ctx, canvas.width, world.state)

  const prompt = nearestVillage()
  if (prompt && !encounter && screen === 'playing') {
    ctx.font = "16px 'Courier New', monospace"
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(canvas.width / 2 - 185, canvas.height - 56, 370, 32)
    ctx.fillStyle = prompt.golden ? '#f4c430' : '#e8e8ee'
    ctx.textAlign = 'center'
    const what = prompt.golden ? 'the golden city' : 'the village'
    ctx.fillText(`Press E to approach ${what}`, canvas.width / 2, canvas.height - 34)
    ctx.textAlign = 'left'
  }

  if (flash.t > 0 && screen === 'playing') drawResult(ctx, canvas.width, canvas.height, flash.text)
  if (encounter) drawEncounter(ctx, canvas.width, canvas.height, encounter, world.state.goods)

  if (screen === 'over') {
    const won = world.state.status === GameStatus.Won
    drawGameOver(ctx, canvas.width, canvas.height, won, score(world.state, world.fog.revealedCount))
  }
}

// Dev-only inspection hook (stripped from production builds) for manual testing.
if (import.meta.env.DEV) {
  ;(window as unknown as { __dbg: unknown }).__dbg = {
    world: () => world,
    screen: () => screen,
    encounter: () => encounter,
    setTimeScale: (s: number) => {
      timeScale = s
    },
    // hand-crank the simulation: run N fixed 60Hz updates synchronously,
    // independent of requestAnimationFrame (which throttles in hidden tabs)
    step: (frames = 1) => {
      for (let i = 0; i < frames; i++) update(1 / 60)
      render() // keep the canvas current even when rAF is throttled
    },
    teleportToVillage: (i = 0) => {
      const v = world.villages.filter((x) => !x.depleted)[i]
      if (v) {
        world.explorer.x = v.x + 0.5
        world.explorer.y = v.y + 0.5
      }
      return v
    },
  }
}

startLoop(update, render)
