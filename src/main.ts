import { generateMap } from './world/mapgen'
import { placeVillages, nearestUnvisitedGolden, type Village } from './world/villages'
import { makeFog, reveal } from './world/fog'
import { makeState, tick, score, GameStatus } from './game/state'
import { makeExplorer, moveExplorer } from './game/explorer'
import { findMooring, moveShip, landingSpots, type Ship } from './game/ship'
import { makeWeather, windAt, windFactor, stormAt, applyStorm, type Weather } from './game/weather'
import { discoverVillage, resolveTrade, resolveGift, resolveAttack, effectiveTemperament } from './game/encounter'
import { makeScene, tickScene, type WalkinScene } from './game/walkin'
import { direct, ambienceFor, type AudioSnapshot, type GameEvent } from './audio/director'
import { AudioPlayer, synthesize } from './audio/player'
import { drawWalkin } from './ui/walkin'
import { defaultOutfit, adjustOutfit, remainingBudget, type Outfit } from './game/outfit'
import { serializeSave, deserializeSave, unpackBits, type SaveData } from './game/save'
import {
  addEntry,
  serializeChronicle,
  deserializeChronicle,
  type ChronicleEntry,
} from './game/chronicle'
import { buildTileset } from './art/tileset'
import { Input } from './engine/input'
import { centerCamera, type Camera } from './engine/camera'
import { startLoop } from './engine/loop'
import { renderWorld, renderMinimap, renderStorms, type RenderCtx } from './engine/renderer'
import { drawHud, drawWindIndicator } from './ui/hud'
import { drawStartScreen, drawOutfitScreen, drawEncounter, drawGameOver, drawResult } from './ui/panels'
import { seedFromString } from './world/rng'

const REVEAL_RADIUS = 7
const BOARD_DIST = 2.0
const VILLAGE_COUNT = 28
const INTERACT_DIST = 1.4
const RUMOR_RADIUS = 4
const AUTOSAVE_EVERY = 5 // seconds
const SAVE_KEY = 'seven-cities-save'
const CHRONICLE_KEY = 'seven-cities-chronicle'

type Screen = 'start' | 'outfit' | 'playing' | 'walkin' | 'over'

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
  ship: Ship
  sailing: boolean
  weather: Weather
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
let walkin: WalkinScene | null = null
let walkinVillage: Village | null = null
const player = new AudioPlayer()
let audioEvents: GameEvent[] = []
let prevSnap: AudioSnapshot | null = null
window.addEventListener('keydown', () => player.unlock())

function snapshot(): AudioSnapshot {
  const underfoot =
    world.map.tiles[Math.floor(world.explorer.y) * world.map.width + Math.floor(world.explorer.x)]
  return {
    screen,
    sailing: world.sailing,
    inStorm:
      world.sailing &&
      stormAt(world.weather, world.state.elapsed, world.map.width, world.map.height, world.explorer.x, world.explorer.y),
    onRiver: !world.sailing && underfoot === 8,
    citiesFound: world.state.citiesFound,
    won: world.state.status === GameStatus.Won,
    lost: world.state.status === GameStatus.Lost,
  }
}

function pumpAudio(): void {
  const snap = snapshot()
  if (prevSnap) player.play(direct(prevSnap, snap, audioEvents))
  else player.play([{ id: ambienceFor(snap) }])
  prevSnap = snap
  audioEvents = []
}

function newWorld(seedStr: string): World {
  const seed = seedFromString(seedStr)
  const map = generateMap(seed)
  const villages = placeVillages(map, VILLAGE_COUNT)
  const fog = makeFog(map.width, map.height)
  const explorer = makeExplorer(map)
  const ship = findMooring(map)
  reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), REVEAL_RADIUS)
  return {
    seedStr, map, villages, fog, state: makeState(), explorer,
    ship, sailing: false, weather: makeWeather(seed, map),
    cam: { x: explorer.x, y: explorer.y },
  }
}

function embark() {
  world = newWorld(world.seedStr)
  world.state.food = outfit.food
  world.state.goods = outfit.goods
  world.state.crew = outfit.crew
  world.state.gold = remainingBudget(outfit)
  encounter = null
  flash = { text: '', t: 0 } // no toast carried over from a previous run
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
        ship: { x: world.ship.x, y: world.ship.y },
        sailing: world.sailing,
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

function loadChronicle(): ChronicleEntry[] {
  try {
    return deserializeChronicle(localStorage.getItem(CHRONICLE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function recordExpedition() {
  const s = world.state
  const entry: ChronicleEntry = {
    seedStr: world.seedStr,
    won: s.status === GameStatus.Won,
    score: score(s, world.fog.revealedCount),
    gold: Math.floor(s.gold),
    day: s.day,
    cities: s.citiesFound,
  }
  try {
    localStorage.setItem(CHRONICLE_KEY, serializeChronicle(addEntry(loadChronicle(), entry)))
  } catch {
    /* chronicle is a nicety — never let storage failures break the game */
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
  w.ship = { ...save.ship }
  w.sailing = save.sailing
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
  if (input.pressed('m')) {
    const muted = player.toggleMute()
    flash = { text: muted ? 'Sound muted (M to unmute)' : 'Sound on', t: 1.5 }
  }

  if (screen === 'walkin' && walkin && walkinVillage) {
    const { dx, dy } = input.axis()
    const status = tickScene(walkin, dx, dy, dt * timeScale)
    if (input.pressed('esc') || status === 'left') {
      screen = 'playing'
      walkin = null
    } else if (status === 'chief') {
      encounter = walkinVillage
      screen = 'playing'
      walkin = null
    } else if (status === 'driven-off') {
      world.state.crew = Math.max(0, world.state.crew - 2)
      world.state.morale = Math.max(0, world.state.morale - 5)
      flash = { text: 'The villagers drive you out!', t: 2.5 }
      audioEvents.push('driven-off')
      screen = 'playing'
      walkin = null
    }
    input.endFrame()
    pumpAudio()
    return
  }

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
    pumpAudio()
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
    pumpAudio()
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
    pumpAudio()
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
    if (world.sailing) {
      // while sailing, the explorer IS the ship — and the sky has opinions
      const wind = windAt(world.weather, state.elapsed)
      const inStorm = stormAt(world.weather, state.elapsed, map.width, map.height, explorer.x, explorer.y)
      let mul = windFactor(wind.angle, wind.strength, dx, dy)
      let drX = 0
      let drY = 0
      if (inStorm) {
        mul *= 0.7 // the helm barely answers
        drX = Math.sin(state.elapsed * 2.1 + explorer.y) * 3
        drY = Math.cos(state.elapsed * 1.7 + explorer.x) * 3
        applyStorm(state, sdt)
        if (flash.t <= 0) flash = { text: 'A storm batters the ship — crew overboard!', t: 1.2 }
      }
      moveShip(map, explorer, dx, dy, sdt, mul, drX, drY)
      world.ship.x = explorer.x
      world.ship.y = explorer.y
    } else {
      moveExplorer(map, explorer, dx, dy, sdt)
    }
    reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), REVEAL_RADIUS)
    tick(state, sdt)

    if (input.pressed('action')) {
      if (world.sailing) {
        const spots = landingSpots(map, explorer.x, explorer.y)
        if (spots.length) {
          // step ashore; the ship stays moored where we left it
          world.sailing = false
          explorer.x = spots[0][0] + 0.5
          explorer.y = spots[0][1] + 0.5
          flash = { text: 'You make landfall.', t: 2 }
          saveGame()
        }
      } else {
        const v = nearestVillage()
        if (v) {
          const firstGolden = v.golden && !v.visited
          discoverVillage(state, v)
          if (firstGolden) {
            flash = { text: `A City of Gold — ${state.citiesFound} of 7 found!`, t: 3 }
          }
          walkin = makeScene(v, state.fear)
          walkinVillage = v
          screen = 'walkin'
        } else if (Math.hypot(world.ship.x - explorer.x, world.ship.y - explorer.y) <= BOARD_DIST) {
          world.sailing = true
          explorer.x = world.ship.x
          explorer.y = world.ship.y
          flash = { text: 'You board your ship. The coast is yours to follow.', t: 2 }
          saveGame()
        }
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
      recordExpedition()
      screen = 'over'
    }
  }

  centerCamera(world.cam, explorer.x, explorer.y, canvas.width, canvas.height, map.width, map.height)
  input.endFrame()
  pumpAudio()
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
  audioEvents.push(action)

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
    drawStartScreen(ctx, canvas.width, canvas.height, world.seedStr, loadSave() !== null, loadChronicle())
    return
  }
  if (screen === 'outfit') {
    drawOutfitScreen(ctx, canvas.width, canvas.height, outfit, outfitRow)
    return
  }
  if (screen === 'walkin' && walkin && walkinVillage) {
    const eff = effectiveTemperament(walkinVillage.temperament, world.state.fear)
    const note = walkin.hostile
      ? 'The people remember what your kind has done. They close in...'
      : eff > 0.66
        ? 'The people watch you with open curiosity.'
        : 'The people keep their distance, wary of the stranger.'
    drawWalkin(ctx, canvas.width, canvas.height, walkin, tileset, note)
    if (flash.t > 0) drawResult(ctx, canvas.width, canvas.height, flash.text)
    return
  }

  renderWorld(rc, world.cam, world.map, world.fog, world.villages, world.explorer, world.ship, world.sailing)
  renderStorms(rc, world.cam, world.weather, world.state.elapsed, world.map, world.fog)
  if (world.sailing) {
    const wind = windAt(world.weather, world.state.elapsed)
    drawWindIndicator(ctx, canvas.width, wind.angle, wind.strength)
  }
  renderMinimap(rc, world.map, world.fog, world.explorer, world.villages, world.ship)
  drawHud(ctx, canvas.width, world.state)

  if (!encounter && screen === 'playing') {
    let text = ''
    let color = '#e8e8ee'
    if (world.sailing) {
      if (landingSpots(world.map, world.explorer.x, world.explorer.y).length) {
        text = 'Press E to make landfall'
      }
    } else {
      const prompt = nearestVillage()
      if (prompt) {
        text = `Press E to approach ${prompt.golden ? 'the golden city' : 'the village'}`
        if (prompt.golden) color = '#f4c430'
      } else if (Math.hypot(world.ship.x - world.explorer.x, world.ship.y - world.explorer.y) <= BOARD_DIST) {
        text = 'Press E to board your ship'
      }
    }
    if (text) {
      ctx.font = "16px 'Courier New', monospace"
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(canvas.width / 2 - 185, canvas.height - 56, 370, 32)
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(text, canvas.width / 2, canvas.height - 34)
      ctx.textAlign = 'left'
    }
  }

  if (flash.t > 0 && screen === 'playing') drawResult(ctx, canvas.width, canvas.height, flash.text)
  if (encounter) drawEncounter(ctx, canvas.width, canvas.height, encounter, world.state.goods, world.state.fear)

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
    walkin: () => walkin,
    audioLog: () => player.getLog(),
    renderCue: async (id: string) => {
      const off = new OfflineAudioContext(1, 2 * 44100, 44100)
      synthesize(off, off.destination, id as never, 0)
      const buf = await off.startRendering()
      const d = buf.getChannelData(0)
      let sum = 0
      for (let i = 0; i < d.length; i++) sum += d[i] * d[i]
      const rms = Math.sqrt(sum / d.length)
      const goertzel = (freq: number) => {
        const w = (2 * Math.PI * freq) / 44100
        const c = 2 * Math.cos(w)
        let s0 = 0, s1 = 0, s2 = 0
        const n = Math.min(d.length, 44100)
        for (let i = 0; i < n; i++) {
          s0 = d[i] + c * s1 - s2
          s2 = s1
          s1 = s0
        }
        return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2) / n
      }
      return { rms, e660: goertzel(660), e880: goertzel(880), e120: goertzel(120), e3000: goertzel(3000) }
    },
    setSeed: (s: string) => {
      world = newWorld(s)
      encounter = null
      screen = 'start'
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
