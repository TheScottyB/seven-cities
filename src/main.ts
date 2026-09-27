/**
 * The app shell: owns the canvas, input, audio player and the one mutable
 * World, and wires the pure rules (src/game, src/world) to the renderer.
 *
 * Screen state machine:
 *   start -> outfit -> playing <-> walkin
 *   playing -> spain -> outfit (the next voyage, same New World)
 *   playing -> over -> outfit (a fresh world)
 *   Esc from playing saves and returns to start; Continue resumes the live
 *   world if there is one, else the save.
 *
 * Persistence is localStorage only: SAVE_KEY holds the running expedition,
 * CHRONICLE_KEY the record of finished ones. A save taken on the way to Spain
 * is marked 'refit' and resumes on the outfit screen. Only the tab that last
 * wrote SAVE_KEY (or claimed it through OWNER_KEY) keeps saving (see saveOwner).
 *
 * Lifecycle: a throw from the loop leaves only a recovery card (Esc reloads,
 * X discards the save); blur or hide mid-expedition pauses until the next key
 * or click, which is swallowed; a hidden tab saves and suspends audio.
 *
 * The window.__dbg hook at the bottom exists in DEV builds only.
 */
import { generateMap } from './world/mapgen'
import { placeVillages, nearestUnvisitedGolden, type Village } from './world/villages'
import { makeFog, reveal } from './world/fog'
import { makeState, tick, score, GameStatus } from './game/state'
import { makeExplorer, moveExplorer } from './game/explorer'
import { findMoorings, moveShip, landingSpots, type Ship } from './game/ship'
import { foundOutpost, tickOutposts, resupply, canFound, OUTPOST_COST, OUTPOST_CREW, type Outpost } from './game/outposts'
import { makeWeather, windAt, windFactor, stormAt, applyStorm, type Weather } from './game/weather'
import { discoverVillage, resolveTrade, resolveGift, resolveAttack, effectiveTemperament } from './game/encounter'
import { makeScene, tickScene, type WalkinScene } from './game/walkin'
import { makeCareer, bankGold, budgetFor, rankIndex, type Career } from './game/career'
import { direct, ambienceFor, type AudioSnapshot, type GameEvent } from './audio/director'
import { AudioPlayer, synthesize } from './audio/player'
import { musicFor, buildTheme, type ThemeId } from './audio/score'
import { scheduleThemeWindow } from './audio/music'
import { sceneControls, type SceneInput } from './audio/scene'
import { synthTexture, type TextureKind } from './audio/texture'
import { drawWalkin } from './ui/walkin'
import { defaultOutfit, adjustOutfit, remainingBudget, type Outfit } from './game/outfit'
import { serializeSave, deserializeSave, unpackBits, mapFingerprint, type SaveData, type SavePhase } from './game/save'
import {
  addEntry,
  serializeChronicle,
  deserializeChronicle,
  type ChronicleEntry,
} from './game/chronicle'
import { buildTileset } from './art/tileset'
import { Input } from './engine/input'
import { centerCamera, zoomFor, type Camera } from './engine/camera'
import { beginHits, hitAt, setHover } from './ui/hit'
import { startLoop } from './engine/loop'
import { renderWorld, renderMinimap, renderStorms, invalidateMinimap, type RenderCtx, type WorldArt } from './engine/renderer'
import { buildRelief } from './art/relief'
import { buildEdges, buildEdgeKeys } from './art/edges'
import { buildDeckles } from './art/paper'
import { buildSpriteBank } from './art/spritebank'
import { drawHud, drawWindIndicator } from './ui/hud'
import { drawStartScreen, drawOutfitScreen, drawSpainScreen, drawEncounter, drawGameOver, drawResult } from './ui/panels'
import { seedFromString } from './world/rng'
import { TILE } from './world/tiles'
import type { Screen } from './game/screen'

const REVEAL_RADIUS = 7
const BOARD_DIST = 2.0
const VILLAGE_COUNT = 28
const INTERACT_DIST = 1.4
const RUMOR_RADIUS = 4
const AUTOSAVE_EVERY = 5 // seconds
const SAVE_KEY = 'seven-cities-save'
const CHRONICLE_KEY = 'seven-cities-chronicle'
/** A fresh token written when a tab takes over the save; storage events only fire on a changed value. */
const OWNER_KEY = 'seven-cities-save-owner'
const AUDIO_KEY = 'seven-cities-audio'

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
  ships: Ship[]
  activeShip: number
  sailing: boolean
  outposts: Outpost[]
  weather: Weather
  cam: Camera
  /** renderer precomputation; non-enumerable so World serializes as before */
  readonly art: WorldArt
}

const tileset = buildTileset()
// the fringe overlays, torn paper edges and sprite cells are world-independent
const edgeSet = buildEdges()
const deckleSet = buildDeckles()
const spriteBank = buildSpriteBank()

/** Everything the renderer needs precomputed for a freshly generated world. */
function buildWorldArt(map: ReturnType<typeof generateMap>): WorldArt {
  invalidateMinimap()
  return {
    relief: buildRelief(map),
    edges: edgeSet,
    edgeKeys: buildEdgeKeys(map.tiles, map.width, map.height),
    deckles: deckleSet,
    sprites: spriteBank,
  }
}
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
let career: Career = makeCareer()
let nextVoyage = false // outfit screen: fresh career vs. re-outfitting in Spain
let justBanked = 0
let promoted = false
/** Esc from 'playing' left a live world that C can return to without storage. */
let resumable = false
/** The outfit screen warns that setting sail overwrites the single save slot. */
let outfitReplacesSave = false
/** Title-screen storage reads, cached until the next storage write or screen change. */
let titleInfo: { hasSave: boolean; chronicle: ChronicleEntry[] } | null = null
/** False once another tab has written the save; this tab then stops saving. */
let saveOwner = true
let ownerWarned = false
let storageOk = true
let storageWarned = false
const player = new AudioPlayer()
let audioEvents: GameEvent[] = []
let prevSnap: AudioSnapshot | null = null

/** Set by the loop's error handler; the canvas shows only the recovery card from then on. */
let crashed = false
/** Blur or hide during play: the simulation holds until the next key or click. */
let paused = false
/** Any key or click so far; the title stops asking for one. */
let gestured = false
/** The first unlock has happened (or a bot primed audio); only that one is swallowed. */
let audioPrimed = false
/** The pending gesture struck up the title theme; a start action it carried is dropped. */
let swallowStart = false
/** A phone or tablet with no keyboard: the title asks for one before offering a run. */
let touchOnly =
  typeof matchMedia === 'function' &&
  matchMedia('(pointer: coarse)').matches &&
  !matchMedia('(any-pointer: fine)').matches &&
  navigator.maxTouchPoints > 0
/** DEV: a bot drives through __dbg, so blur/hide pauses would only eat its keys. */
let driven = false

function loadMuted(): boolean {
  try {
    return localStorage.getItem(AUDIO_KEY) === 'true'
  } catch {
    return false
  }
}

function storeMuted(m: boolean) {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(m))
  } catch {
    /* the choice lasts for this tab only */
  }
}

let muted = loadMuted()
player.setMuted(muted)

/** Every key or click offers the browser audio; the first success is remembered. */
function onGesture() {
  gestured = true
  askPersist()
  if (crashed) return // the card keeps audio silent
  if (player.unlock() && !audioPrimed) {
    audioPrimed = true
    swallowStart = true
  }
}

/** Pause for blur/hide, only mid-expedition; true when this call paused. */
function pauseForFocus(): boolean {
  if (paused || crashed || driven) return false
  if (screen !== 'playing' && screen !== 'walkin') return false
  paused = true
  return true
}

/** The key or click that ends a pause does nothing else. */
function unpause() {
  paused = false
  input.endFrame()
  clicks.length = 0
}

function saveIfPlaying() {
  if (crashed) return // the state that threw is not worth keeping
  if (screen === 'playing' || screen === 'walkin') saveGame()
}

let persistAsked = false
/** Ask once, on the first gesture, that the browser not evict our saves. */
function askPersist() {
  if (persistAsked) return
  persistAsked = true
  try {
    navigator.storage?.persist?.().catch(() => {})
  } catch {
    /* unsupported: saves still work, just evictable */
  }
}
// registered after Input's own listener, so the key is already queued when a pause drops it
window.addEventListener('keydown', (e) => {
  touchOnly = false
  onGesture()
  if (crashed) {
    // update() no longer runs; the recovery card's two keys are read here
    if (e.key === 'Escape') location.reload()
    else if (e.key?.toLowerCase() === 'x') {
      clearSave()
      location.reload()
    }
    return
  }
  if (paused) unpause()
})
window.addEventListener('blur', () => {
  if (pauseForFocus() && screen === 'playing') saveGame()
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseForFocus()
    saveIfPlaying()
    player.suspend()
  } else if (!crashed) {
    player.resume()
  }
})
window.addEventListener('pagehide', saveIfPlaying)
window.addEventListener('storage', (e) => {
  if (e.key === SAVE_KEY || e.key === OWNER_KEY) {
    saveOwner = false
    titleInfo = null
  }
})

// --- mouse: canvas UI elements are clickable -------------------------------
const clicks: string[] = []
function canvasPoint(e: MouseEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect()
  return {
    x: ((e.clientX - r.left) * canvas.width) / r.width,
    y: ((e.clientY - r.top) * canvas.height) / r.height,
  }
}
canvas.addEventListener('click', (e) => {
  onGesture()
  if (crashed) return
  if (paused) {
    unpause()
    return
  }
  const p = canvasPoint(e)
  const id = hitAt(p.x, p.y)
  if (id) clicks.push(id)
})
canvas.addEventListener('mousemove', (e) => {
  const p = canvasPoint(e)
  const id = hitAt(p.x, p.y)
  setHover(id)
  canvas.style.cursor = id ? 'pointer' : 'default'
})

/** Is the explorer (or the ship under him) inside a storm right now? */
const stormHere = () =>
  stormAt(world.weather, world.state.elapsed, world.map.width, world.map.height, world.explorer.x, world.explorer.y)

function snapshot(): AudioSnapshot {
  const underfoot =
    world.map.tiles[Math.floor(world.explorer.y) * world.map.width + Math.floor(world.explorer.x)]
  return {
    screen,
    sailing: world.sailing,
    inStorm: world.sailing && stormHere(),
    onRiver: !world.sailing && underfoot === TILE.RIVER,
    lowFood: world.state.food < 80 && world.state.status === GameStatus.Playing,
    citiesFound: world.state.citiesFound,
    won: world.state.status === GameStatus.Won,
    lost: world.state.status === GameStatus.Lost,
  }
}

/** Tiles from the ship to the nearest land — how loud the coast's gulls are. */
function nearestLandDist(maxR = 14): number {
  const { map, explorer } = world
  const ex = Math.floor(explorer.x)
  const ey = Math.floor(explorer.y)
  const land = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && map.tiles[y * map.width + x] !== TILE.OCEAN
  if (land(ex, ey)) return 0
  for (let r = 1; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) if (land(ex + dx, ey - r) || land(ex + dx, ey + r)) return r
    for (let dy = -r + 1; dy <= r - 1; dy++) if (land(ex - r, ey + dy) || land(ex + r, ey + dy)) return r
  }
  return Infinity
}

function sceneInput(): SceneInput {
  const s = world.state
  const famine = s.food < 80 ? 1 - s.food / 80 : 0
  let hostility = 0
  if (screen === 'walkin' && walkin) {
    hostility = walkin.hostile ? 1 : 0
  } else if (!world.sailing) {
    for (const v of world.villages) {
      if (v.depleted) continue
      if (effectiveTemperament(v.temperament, s.fear) >= 0.35) continue
      const d = Math.hypot(v.x + 0.5 - world.explorer.x, v.y + 0.5 - world.explorer.y)
      hostility = Math.max(hostility, 1 - d / 12)
    }
  }
  const wind = windAt(world.weather, s.elapsed)
  return {
    screen,
    sailing: world.sailing,
    inStorm: world.sailing && stormHere(),
    wind: wind.strength,
    distToLand: world.sailing ? nearestLandDist() : 0,
    hostility: Math.max(0, Math.min(1, hostility)),
    famine,
  }
}

function pumpAudio(): void {
  const snap = snapshot()
  if (prevSnap) player.play(direct(prevSnap, snap, audioEvents))
  else player.play([{ id: ambienceFor(snap) }])
  player.setTheme(musicFor(snap.screen))
  player.setScene(sceneControls(sceneInput()))
  prevSnap = snap
  audioEvents = []
}

function newWorld(seedStr: string): World {
  const seed = seedFromString(seedStr)
  const map = generateMap(seed)
  const villages = placeVillages(map, VILLAGE_COUNT)
  const fog = makeFog(map.width, map.height)
  const explorer = makeExplorer(map)
  reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), REVEAL_RADIUS)
  const w: Omit<World, 'art'> = {
    seedStr, map, villages, fog, state: makeState(), explorer,
    ships: findMoorings(map, 1), activeShip: 0, sailing: false,
    outposts: [], weather: makeWeather(seed, map),
    cam: { x: explorer.x, y: explorer.y },
  }
  // non-enumerable: __dbg.world() and any serializer see the same payload as before
  return Object.defineProperty(w, 'art', { value: buildWorldArt(map), enumerable: false }) as World
}

function embark() {
  world = newWorld(world.seedStr)
  claimSave(true) // a fresh expedition takes the slot even if another tab wrote meanwhile
  applyOutfit()
  screen = 'playing'
}

/** A later voyage: the same New World, a fresh expedition off the same coast. */
function embarkVoyage() {
  const { map } = world
  world.explorer.x = map.landing.x + 0.5
  world.explorer.y = map.landing.y + 0.5
  world.sailing = false
  world.state.morale = 100 // a fresh crew signs on
  applyOutfit()
  reveal(world.fog, Math.floor(world.explorer.x), Math.floor(world.explorer.y), REVEAL_RADIUS)
  screen = 'playing'
}

function applyOutfit() {
  world.ships = findMoorings(world.map, outfit.ships)
  world.activeShip = 0
  world.state.food = outfit.food
  world.state.goods = outfit.goods
  world.state.crew = outfit.crew
  world.state.gold = remainingBudget(outfit, budgetFor(career.banked))
  encounter = null
  walkin = null
  flash = { text: '', t: 0 } // no toast carried over from a previous run
  saveGame('at-sea')
}

/** A fresh career: start-new, restart after game over, and the dev hook's setSeed. */
function resetSession() {
  career = makeCareer()
  nextVoyage = false
  justBanked = 0
  promoted = false
  resumable = false
}

// --- save / load ---------------------------------------------------------

/** This tab becomes the one that saves; `announce` tells any other tab to stop now. */
function claimSave(announce: boolean) {
  saveOwner = true
  ownerWarned = false
  if (!announce) return
  try {
    localStorage.setItem(OWNER_KEY, `${Date.now()}-${Math.random()}`)
  } catch {
    /* no storage, nothing to contend for */
  }
}

/** Can this tab write SAVE_KEY? Warns once when another tab has taken it over. */
function ownsSave(): boolean {
  if (saveOwner) return true
  if (!ownerWarned && screen === 'playing') {
    ownerWarned = true
    flash = { text: 'This expedition is open in another tab. Progress here is not being saved.', t: 4 }
  }
  return false
}

/** Write the running expedition; true once it is in storage. */
function saveGame(phase: SavePhase = 'at-sea'): boolean {
  if (world.state.status !== GameStatus.Playing) return false
  if (!ownsSave()) return false
  titleInfo = null
  const { map } = world
  try {
    localStorage.setItem(
      SAVE_KEY,
      serializeSave({
        seedStr: world.seedStr,
        mapHash: mapFingerprint(map.tiles, map.width, map.height, world.villages),
        phase,
        state: world.state,
        explorer: { x: world.explorer.x, y: world.explorer.y },
        ships: world.ships.map((sh) => ({ x: sh.x, y: sh.y })),
        activeShip: world.activeShip,
        sailing: world.sailing,
        career,
        outposts: world.outposts,
        fogSeen: world.fog.seen,
        villages: world.villages,
      }),
    )
    storageOk = true
    return true
  } catch {
    // storage full/blocked: the game plays on without saves, and says so once
    storageOk = false
    if (!storageWarned && screen === 'playing') {
      storageWarned = true
      flash = { text: 'Saving is unavailable in this browser: progress lasts only until you close the tab.', t: 4 }
    }
    return false
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
    score: score(s, world.fog.revealedCount) + career.banked,
    gold: Math.floor(s.gold) + career.banked,
    day: s.day,
    cities: s.citiesFound,
  }
  titleInfo = null
  try {
    localStorage.setItem(CHRONICLE_KEY, serializeChronicle(addEntry(loadChronicle(), entry)))
  } catch {
    /* chronicle is a nicety — never let storage failures break the game */
  }
}

function clearSave() {
  if (!ownsSave()) return
  titleInfo = null
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}

const inMap = (map: World['map'], p: { x: number; y: number }) =>
  p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height

/**
 * Rebuild the saved expedition on a freshly generated world. Throws when the
 * save does not fit that world; nothing module-level changes until it succeeds.
 */
function restoreWorld(save: SaveData): World {
  const w = newWorld(save.seedStr)
  const { map } = w
  if (
    save.villages.length !== w.villages.length ||
    mapFingerprint(map.tiles, map.width, map.height, w.villages) !== save.mapHash
  ) {
    throw new Error('save was taken on a different world')
  }
  if (atob(save.fogSeenB64).length !== Math.ceil(w.fog.seen.length / 8)) throw new Error('fog size mismatch')
  if (!inMap(map, save.explorer) || !save.ships.every((sh) => inMap(map, sh))) throw new Error('position off the map')

  w.state = { ...save.state }
  w.explorer.x = save.explorer.x
  w.explorer.y = save.explorer.y
  w.ships = save.ships.map((sh) => ({ x: sh.x, y: sh.y }))
  w.activeShip = save.activeShip
  w.sailing = save.sailing
  w.outposts = save.outposts.map((o) => ({ ...o }))
  w.fog.seen = unpackBits(save.fogSeenB64, w.fog.seen.length)
  w.fog.revealedCount = w.fog.seen.reduce((a, b) => a + b, 0)
  invalidateMinimap() // the restored fog reveals far more than the fresh world did
  // placement (x, y, golden) regenerates from the seed and is covered by
  // mapHash; only the fields play changes are restored
  save.villages.forEach((sv, i) => {
    const v = w.villages[i]
    v.visited = sv.visited === true
    v.depleted = sv.depleted === true
    if (Number.isFinite(sv.temperament)) v.temperament = sv.temperament
  })
  w.cam = { x: w.explorer.x, y: w.explorer.y }
  career = { ...save.career }
  return w
}

/** C on the title: the live world after Esc, else the stored save. */
function continueExpedition() {
  if (resumable) {
    resumable = false
    screen = 'playing'
    return
  }
  const save = loadSave()
  if (!save) return
  claimSave(true)
  try {
    world = restoreWorld(save)
  } catch {
    clearSave()
    flash = { text: 'Your saved expedition could not be read.', t: 3.5 }
    return
  }
  prevSnap = null // ambience bed only: no cues for what the restored world "changed"
  flash = { text: '', t: 0 }
  encounter = null
  walkin = null
  if (save.phase === 'refit') {
    // saved on the way to Spain; the court screen's figures aren't persisted
    nextVoyage = true
    outfit = defaultOutfit()
    outfitRow = 0
    screen = 'outfit'
  } else {
    screen = 'playing'
  }
}

// --- update --------------------------------------------------------------

function nearestShipIndex(): number {
  let best = -1
  let bestD = BOARD_DIST
  world.ships.forEach((sh, i) => {
    const d = Math.hypot(sh.x - world.explorer.x, sh.y - world.explorer.y)
    if (d <= bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

function nearestOutpost(): Outpost | null {
  let best: Outpost | null = null
  let bestD = INTERACT_DIST
  for (const o of world.outposts) {
    const d = Math.hypot(o.x + 0.5 - world.explorer.x, o.y + 0.5 - world.explorer.y)
    if (d <= bestD) {
      bestD = d
      best = o
    }
  }
  return best
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
  const click = clicks.shift() ?? null
  const firstUnlock = swallowStart
  swallowStart = false
  if (input.pressed('m')) {
    muted = player.toggleMute()
    storeMuted(muted)
    flash = { text: muted ? 'Sound muted (M to unmute)' : 'Sound on', t: 1.5 }
  }
  // the one place a toast ages, whatever screen shows it
  if (flash.t > 0) flash.t -= dt * timeScale

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
    // while a touch-only device is gated, taps on the (unregistered) start lines are ignored
    const startNew = input.pressed('enter') || (!touchOnly && click === 'start-new')
    const startContinue = !startNew && (input.pressed('c') || (!touchOnly && click === 'start-continue'))
    if ((startNew || startContinue) && firstUnlock) {
      // this press struck up the title theme; stay so it is heard, the next press proceeds
    } else if (startNew) {
      outfitReplacesSave = titleInfo?.hasSave ?? loadSave() !== null
      resetSession()
      claimSave(false)
      outfit = defaultOutfit()
      outfitRow = 0
      flash = { text: '', t: 0 }
      screen = 'outfit'
    } else if (startContinue) {
      continueExpedition()
    } else if (input.pressed('r') || click === 'start-reroll') {
      // roll a new world to explore
      world = newWorld(String(1 + (Math.floor(performance.now() * 7) % 99999)))
      resumable = false
    } else if (click === 'start-keyboard') {
      touchOnly = false
    }
    input.endFrame()
    pumpAudio()
    return
  }

  if (screen === 'outfit') {
    const fields: (keyof Outfit)[] = ['food', 'goods', 'crew', 'ships']
    if (input.pressed('up')) outfitRow = (outfitRow + fields.length - 1) % fields.length
    if (input.pressed('down')) outfitRow = (outfitRow + 1) % fields.length
    const budget = budgetFor(career.banked)
    if (click?.startsWith('outfit-row-')) outfitRow = Number(click.slice('outfit-row-'.length))
    if (click?.startsWith('outfit-dec-')) {
      outfitRow = Number(click.slice('outfit-dec-'.length))
      outfit = adjustOutfit(outfit, fields[outfitRow], -1, budget)
    }
    if (click?.startsWith('outfit-inc-')) {
      outfitRow = Number(click.slice('outfit-inc-'.length))
      outfit = adjustOutfit(outfit, fields[outfitRow], 1, budget)
    }
    if (input.pressedOrRepeat('left')) outfit = adjustOutfit(outfit, fields[outfitRow], -1, budget)
    if (input.pressedOrRepeat('right')) outfit = adjustOutfit(outfit, fields[outfitRow], 1, budget)
    if (input.pressed('enter') || (!touchOnly && click === 'outfit-go')) {
      if (nextVoyage) embarkVoyage()
      else embark()
    } else if (input.pressed('esc') && !nextVoyage) screen = 'start'
    input.endFrame()
    pumpAudio()
    return
  }

  if (screen === 'spain') {
    if (input.pressed('enter') || click === 'spain-go') {
      outfit = defaultOutfit()
      outfitRow = 0
      nextVoyage = true
      screen = 'outfit'
    }
    input.endFrame()
    pumpAudio()
    return
  }

  if (screen === 'over') {
    if (input.pressed('enter') || click === 'over-restart') {
      resetSession()
      world = newWorld(String(1492 + (Math.floor(performance.now()) % 9999)))
      outfitReplacesSave = false
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

  if (encounter) {
    if (input.pressed('1') || click === 'enc-1') chooseEncounter('trade')
    else if (input.pressed('2') || click === 'enc-2') chooseEncounter('gift')
    else if (input.pressed('3') || click === 'enc-3') chooseEncounter('attack')
    else if (input.pressed('esc') || click === 'enc-esc') encounter = null
  } else {
    const { dx, dy } = input.axis()
    if (world.sailing) {
      // while sailing, the explorer IS the ship — and the sky has opinions
      const wind = windAt(world.weather, state.elapsed)
      const inStorm = stormHere() // sampled at the pre-move position
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
      world.ships[world.activeShip].x = explorer.x
      world.ships[world.activeShip].y = explorer.y
    } else {
      moveExplorer(map, explorer, dx, dy, sdt)
    }
    const foodBefore = state.food
    reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), REVEAL_RADIUS)
    tick(state, sdt)
    tickOutposts(world.outposts, sdt)
    if (foodBefore >= 80 && state.food < 80) {
      flash = { text: 'Provisions run low — find a fort, a trade, or sail for Spain!', t: 3.5 }
    }

    if (!world.sailing && input.pressed('f')) {
      // raise a mission fort here
      const tx = Math.floor(explorer.x)
      const ty = Math.floor(explorer.y)
      const nearVillage = world.villages.some((v) => Math.hypot(v.x - tx, v.y - ty) < 4)
      if (nearVillage) flash = { text: 'The people already dwell here.', t: 2 }
      else if (!canFound(state)) flash = { text: `A fort needs ${OUTPOST_COST} gold and ${OUTPOST_CREW} men to garrison.`, t: 2.5 }
      else if (foundOutpost(state, world.outposts, tx, ty)) {
        flash = { text: 'A mission fort rises. The garrison will gather provisions.', t: 3 }
        saveGame()
      } else flash = { text: 'Too close to another outpost.', t: 2 }
    }

    if (input.pressed('action')) {
      if (world.sailing && explorer.x < 4) {
        // set course for Spain: bank the gold, count the voyage
        const before = rankIndex(career.banked)
        justBanked = Math.floor(state.gold)
        career = bankGold(career, state.gold)
        state.gold = 0
        promoted = rankIndex(career.banked) > before
        flash = { text: '', t: 0 } // the court screen shows toasts now; none from the voyage
        screen = 'spain'
        saveGame('refit')
      } else if (world.sailing) {
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
        const outpost = nearestOutpost()
        const shipIdx = nearestShipIndex()
        if (v) {
          const firstGolden = v.golden && !v.visited
          discoverVillage(state, v)
          if (firstGolden) {
            flash = { text: `A City of Gold — ${state.citiesFound} of 7 found!`, t: 3 }
          }
          walkin = makeScene(v, state.fear)
          walkinVillage = v
          screen = 'walkin'
        } else if (outpost && outpost.stock >= 1) {
          const taken = resupply(state, outpost)
          flash = { text: `The garrison shares its stores: +${taken} provisions.`, t: 2.5 }
          saveGame()
        } else if (shipIdx >= 0) {
          world.activeShip = shipIdx
          world.sailing = true
          explorer.x = world.ships[shipIdx].x
          explorer.y = world.ships[shipIdx].y
          flash = { text: 'You board your ship. The coast is yours to follow.', t: 2 }
          saveGame()
        }
      }
    }

    // the action above may already have left 'playing' (walk-in, Spain) this frame
    if (screen === 'playing' && input.pressed('esc')) {
      // save and return to the title screen; Continue picks it right back up.
      // The flash clears first so a save warning carries to the title.
      flash = { text: '', t: 0 }
      saveGame()
      resumable = true
      screen = 'start'
    }

    if (screen === 'playing') {
      autosaveIn -= sdt
      if (autosaveIn <= 0) {
        autosaveIn = AUTOSAVE_EVERY
        saveGame()
      }

      if (state.status !== GameStatus.Playing) {
        clearSave()
        recordExpedition()
        resumable = false
        screen = 'over'
      }
    }
  }

  centerCamera(world.cam, explorer.x, explorer.y, canvas.width, canvas.height, map.width, map.height, zoomFor(canvas.width))
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
  beginHits()
  const rc: RenderCtx = { ctx, viewW: canvas.width, viewH: canvas.height, tileset, zoom: zoomFor(canvas.width) }

  if (screen === 'start') {
    titleInfo ??= { hasSave: loadSave() !== null, chronicle: loadChronicle() }
    const soundLine = touchOnly ? undefined : muted ? 'M to unmute' : gestured ? 'M to mute' : 'Press any key for sound'
    drawStartScreen(ctx, canvas.width, canvas.height, world.seedStr, resumable || titleInfo.hasSave, titleInfo.chronicle, {
      soundLine,
      needKeyboard: touchOnly,
    })
    if (flash.t > 0) drawResult(ctx, canvas.width, canvas.height, flash.text, 28)
    return
  }
  titleInfo = null
  if (screen === 'outfit') {
    drawOutfitScreen(ctx, canvas.width, canvas.height, outfit, outfitRow, budgetFor(career.banked), !nextVoyage && outfitReplacesSave)
    if (flash.t > 0) drawResult(ctx, canvas.width, canvas.height, flash.text, 28)
    return
  }
  if (screen === 'spain') {
    drawSpainScreen(ctx, canvas.width, canvas.height, career, world.state, justBanked, promoted, performance.now() / 1000)
    if (flash.t > 0) drawResult(ctx, canvas.width, canvas.height, flash.text, 28)
    return
  }
  if (screen === 'walkin' && walkin && walkinVillage) {
    const eff = effectiveTemperament(walkinVillage.temperament, world.state.fear)
    const note = walkin.hostile
      ? 'The people remember what your kind has done. They close in...'
      : eff > 0.66
        ? 'The people watch you with open curiosity.'
        : 'The people keep their distance, wary of the stranger.'
    drawWalkin(ctx, canvas.width, canvas.height, walkin, tileset, note, performance.now() / 1000, spriteBank)
    if (flash.t > 0) drawResult(ctx, canvas.width, canvas.height, flash.text, 12)
    return
  }

  renderWorld(rc, world.cam, world.map, world.fog, world.villages, world.explorer, world.ships, world.activeShip, world.sailing, world.outposts, world.art)
  renderStorms(rc, world.cam, world.weather, world.state.elapsed, world.map, world.fog)
  const hudH = drawHud(ctx, canvas.width, world.state, career.banked)
  renderMinimap(rc, world.map, world.fog, world.explorer, world.villages, world.ships, world.outposts, hudH + 12, world.cam, world.art.relief)
  if (world.sailing) {
    const wind = windAt(world.weather, world.state.elapsed)
    drawWindIndicator(ctx, canvas.width, wind.angle, wind.strength, hudH + 12)
    // storm vignette: the sky presses down while you ride one out
    if (stormHere()) {
      const g = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.3,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.7,
      )
      g.addColorStop(0, 'rgba(20,12,16,0)')
      g.addColorStop(1, 'rgba(30,10,14,0.5)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }
  if (!encounter && screen === 'playing') {
    let text = ''
    let color = '#e8e8ee'
    if (world.sailing) {
      if (world.explorer.x < 4) {
        text = 'Press E to sail home to Spain'
        color = '#f4c430'
      } else if (landingSpots(world.map, world.explorer.x, world.explorer.y).length) {
        text = 'Press E to make landfall'
      }
    } else {
      const prompt = nearestVillage()
      const outpost = nearestOutpost()
      if (prompt) {
        text = `Press E to approach ${prompt.golden ? 'the golden city' : 'the village'}`
        if (prompt.golden) color = '#f4c430'
      } else if (outpost && outpost.stock >= 1) {
        text = `Press E to resupply (${Math.floor(outpost.stock)} in stores)`
      } else if (nearestShipIndex() >= 0) {
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

  // quiet key reference in the corner
  if (screen === 'playing' && !encounter) {
    ctx.font = "12px 'Courier New', monospace"
    ctx.fillStyle = 'rgba(154,154,166,0.55)'
    ctx.textAlign = 'left'
    ctx.fillText('E interact · F fort · M sound · Esc menu', 12, canvas.height - 12)
  }

  // the banner yields while a decision panel is up — no overlapping chrome
  if (flash.t > 0 && screen === 'playing' && !encounter) drawResult(ctx, canvas.width, canvas.height, flash.text, hudH + 10)
  if (encounter)
    drawEncounter(ctx, canvas.width, canvas.height, encounter, world.state.goods, world.state.fear, performance.now() / 1000)

  if (screen === 'over') {
    const won = world.state.status === GameStatus.Won
    drawGameOver(
      ctx,
      canvas.width,
      canvas.height,
      won,
      score(world.state, world.fog.revealedCount) + career.banked,
      career,
      {
        cities: world.state.citiesFound,
        day: world.state.day,
        villages: world.state.villagesContacted,
        gold: Math.floor(world.state.gold) + career.banked,
        charted: world.fog.revealedCount,
      },
      performance.now() / 1000,
    )
    if (flash.t > 0) drawResult(ctx, canvas.width, canvas.height, flash.text, 28)
  }
}

/** The loop's frame: the recovery card after a crash, else the game plus any pause banner. */
function present() {
  if (crashed) {
    drawCrashCard()
    return
  }
  render()
  if (paused) drawResult(ctx, canvas.width, canvas.height, 'Paused — press any key', Math.round(canvas.height / 2) - 17)
}

/** Drawn from nothing but the canvas: no world, HUD or state that might be what broke. */
function drawCrashCard() {
  const w = canvas.width
  const h = canvas.height
  // a throw may have left a save(), clip or transform open
  if (typeof ctx.reset === 'function') ctx.reset()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, w, h)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = "bold 22px 'Courier New', monospace"
  ctx.fillStyle = '#e8e8ee'
  ctx.fillText('Something went wrong.', Math.round(w / 2), Math.round(h / 2) - 12)
  ctx.font = "16px 'Courier New', monospace"
  ctx.fillStyle = '#9a9aa6'
  ctx.fillText('Esc: reload to title   X: discard save and reload', Math.round(w / 2), Math.round(h / 2) + 20)
  ctx.textAlign = 'left'
}

// window.__dbg: the automated playthrough bots drive and inspect the game through
// this hook. It is a STABLE API: add entries, never rename or remove one, and keep
// every signature and behaviour. DEV builds only; production strips it.
if (import.meta.env.DEV) {
  /** A bot is driving: clear every lifecycle gate so no key it sends is eaten. */
  const standAside = () => {
    driven = true
    paused = false
    audioPrimed = true
    gestured = true
    swallowStart = false
    touchOnly = false
  }
  ;(window as unknown as { __dbg: unknown }).__dbg = {
    world: () => world, // the live World object (art is non-enumerable)
    screen: () => screen, // current Screen name
    encounter: () => encounter, // village whose encounter panel is open, or null
    setTimeScale: (s: number) => { // multiplies simulated time per update
      timeScale = s
    },
    step: (frames = 1) => { // N synchronous 60Hz update()s, then one render(); ignores rAF throttling
      // bypasses pause, crash, audio and touch gates; exceptions reach the caller
      standAside()
      for (let i = 0; i < frames; i++) update(1 / 60)
      render() // keep the canvas current even when rAF is throttled
    },
    walkin: () => walkin, // the active walk-in scene, or null
    career: () => career, // banked gold and voyage count
    storage: () => ({ ok: storageOk, owner: saveOwner, resumable }), // last save write succeeded; this tab owns the save; Esc left a live world
    audioLog: () => player.getLog(), // copy of the capped cue/music log: { id, at }[]
    renderCue: async (id: string) => { // offline-render a cue: rms plus Goertzel energies
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
    audioScene: () => ({ // soundscape inputs, derived controls and texture firing counts
      input: sceneInput(),
      controls: sceneControls(sceneInput()),
      stats: player.getTextureStats(),
    }),
    renderTexture: async (kind: string, seconds = 3) => { // offline-render a texture: { rms, peak }
      const off = new OfflineAudioContext(1, Math.floor(seconds * 44100), 44100)
      synthTexture(off, off.destination, kind as TextureKind, 0.1, { midi: 57, dur: 1.6 })
      const buf = await off.startRendering()
      const d = buf.getChannelData(0)
      let sum = 0
      let peak = 0
      for (let i = 0; i < d.length; i++) {
        sum += d[i] * d[i]
        peak = Math.max(peak, Math.abs(d[i]))
      }
      return { rms: Math.sqrt(sum / d.length), peak }
    },
    renderTheme: async (id: string, seconds = 4) => { // offline-render a theme's opening: { rms, peak }
      const off = new OfflineAudioContext(1, Math.floor(seconds * 44100), 44100)
      scheduleThemeWindow(off, off.destination, buildTheme(id as ThemeId), 0, 0, seconds)
      const buf = await off.startRendering()
      const d = buf.getChannelData(0)
      let sum = 0
      let peak = 0
      for (let i = 0; i < d.length; i++) {
        sum += d[i] * d[i]
        peak = Math.max(peak, Math.abs(d[i]))
      }
      return { rms: Math.sqrt(sum / d.length), peak }
    },
    setSeed: (s: string) => { // fresh world from seed s, back on the title ready for Enter
      standAside()
      world = newWorld(s)
      resetSession()
      encounter = null
      walkin = null
      flash = { text: '', t: 0 }
      titleInfo = null
      screen = 'start'
    },
    teleportToVillage: (i = 0) => { // move explorer onto the i-th undepleted village; returns it
      const v = world.villages.filter((x) => !x.depleted)[i]
      if (v) {
        world.explorer.x = v.x + 0.5
        world.explorer.y = v.y + 0.5
      }
      return v
    },
  }
}

startLoop(update, present, {
  onError: (err) => {
    console.error(err)
    crashed = true
    player.suspend()
  },
  isPaused: () => paused || crashed,
})
