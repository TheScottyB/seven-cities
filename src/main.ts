import { generateMap } from './world/mapgen'
import { placeVillages, type Village } from './world/villages'
import { makeFog, reveal } from './world/fog'
import { makeState, tick, score, GameStatus } from './game/state'
import { makeExplorer, moveExplorer } from './game/explorer'
import { resolveTrade, resolveGift, resolveAttack } from './game/encounter'
import { buildTileset } from './art/tileset'
import { Input } from './engine/input'
import { centerCamera, type Camera } from './engine/camera'
import { startLoop } from './engine/loop'
import { renderWorld, renderMinimap, type RenderCtx } from './engine/renderer'
import { drawHud } from './ui/hud'
import { drawStartScreen, drawEncounter, drawGameOver, drawResult } from './ui/panels'
import { seedFromString } from './world/rng'

const REVEAL_RADIUS = 5
const VILLAGE_COUNT = 22
const INTERACT_DIST = 1.4

type Screen = 'start' | 'playing' | 'over'

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
// UI: active encounter + transient result flash
let encounter: Village | null = null
let flash = { text: '', t: 0 }

function newWorld(seedStr: string): World {
  const seed = seedFromString(seedStr)
  const map = generateMap(seed)
  const villages = placeVillages(map, VILLAGE_COUNT)
  const fog = makeFog(map.width, map.height)
  const explorer = makeExplorer(map)
  reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), REVEAL_RADIUS)
  return { seedStr, map, villages, fog, state: makeState(), explorer, cam: { x: explorer.x, y: explorer.y } }
}

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
      world = newWorld(world.seedStr)
      screen = 'playing'
    }
    input.endFrame()
    return
  }

  if (screen === 'over') {
    if (input.pressed('enter')) {
      // new expedition with a fresh seed derived from the elapsed clock
      world = newWorld(String(1492 + Math.floor(performance.now()) % 9999))
      encounter = null
      screen = 'playing'
    }
    input.endFrame()
    return
  }

  // playing
  const { map, fog, state, explorer } = world
  if (flash.t > 0) flash.t -= dt

  if (encounter) {
    // encounter panel is modal — movement frozen
    if (input.pressed('1')) chooseEncounter('trade')
    else if (input.pressed('2')) chooseEncounter('gift')
    else if (input.pressed('3')) chooseEncounter('attack')
    else if (input.pressed('esc')) encounter = null
  } else {
    const { dx, dy } = input.axis()
    moveExplorer(map, explorer, dx, dy, dt)
    reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), REVEAL_RADIUS)
    tick(state, dt)

    if (input.pressed('action')) {
      const v = nearestVillage()
      if (v) encounter = v
    }
    if (state.status === GameStatus.Won || state.status === GameStatus.Lost) {
      screen = 'over'
    }
  }

  centerCamera(world.cam, explorer.x, explorer.y, canvas.width, canvas.height, map.width, map.height)
  input.endFrame()
}

function chooseEncounter(action: 'trade' | 'gift' | 'attack') {
  const v = encounter!
  const { state } = world
  const goldBefore = state.gold
  const crewBefore = state.crew
  if (action === 'trade') resolveTrade(state, v)
  else if (action === 'gift') resolveGift(state, v)
  else resolveAttack(state, v)

  if (action === 'gift') flash = { text: 'You offer gifts. Goodwill rises.', t: 2.5 }
  else if (action === 'trade') flash = { text: `Traded for ${state.gold - goldBefore} gold.`, t: 2.5 }
  else {
    const lost = crewBefore - state.crew
    flash = { text: `Raid! +${state.gold - goldBefore} gold, ${lost} crew lost.`, t: 2.5 }
  }
  encounter = null
}

function render() {
  const rc: RenderCtx = { ctx, viewW: canvas.width, viewH: canvas.height, tileset }

  if (screen === 'start') {
    drawStartScreen(ctx, canvas.width, canvas.height, world.seedStr)
    return
  }

  renderWorld(rc, world.cam, world.map, world.fog, world.villages, world.explorer)
  renderMinimap(rc, world.map, world.fog, world.explorer)
  drawHud(ctx, canvas.width, world.state)

  const prompt = nearestVillage()
  if (prompt && !encounter) {
    ctx.font = "16px 'Courier New', monospace"
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(canvas.width / 2 - 150, canvas.height - 56, 300, 32)
    ctx.fillStyle = '#f4c430'
    ctx.textAlign = 'center'
    ctx.fillText('Press E to approach the village', canvas.width / 2, canvas.height - 34)
    ctx.textAlign = 'left'
  }

  if (flash.t > 0) drawResult(ctx, canvas.width, canvas.height, flash.text)
  if (encounter) drawEncounter(ctx, canvas.width, canvas.height, encounter)

  if (screen === 'over') {
    const won = world.state.status === GameStatus.Won
    drawGameOver(ctx, canvas.width, canvas.height, won, score(world.state, world.fog.revealedCount))
  }
}

startLoop(update, render)
