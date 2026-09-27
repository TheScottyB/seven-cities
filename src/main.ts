/**
 * The app shell: owns the canvas, input, audio player and the one mutable
 * World, and wires the pure rules (src/game, src/world) to the renderer.
 *
 * Screen state machine:
 *   start -> outfit -> playing <-> walkin
 *   playing -> spain -> outfit (the next voyage, same New World)
 *   playing -> over -> outfit (a fresh world)
 *   Esc from playing saves and returns to start with the world kept live
 *   (resumable); C on the title resumes it, else restores the save. A save
 *   taken on the way to Spain is marked 'refit' and resumes on the outfit screen.
 *
 * Two states sit over any screen. Paused: blur or hide mid-expedition holds
 * the simulation until the next key or click, which is swallowed. Crashed: a
 * throw from the loop leaves only a recovery card (Esc reloads, X discards the
 * save). A hidden tab also saves and suspends audio.
 *
 * Persistence is localStorage only: 'seven-cities-save' holds the running
 * expedition, 'seven-cities-chronicle' the record of finished ones and
 * 'seven-cities-audio' the mute choice. Only the tab that last wrote the save,
 * or claimed it through 'seven-cities-save-owner', keeps saving (see saveOwner).
 *
 * Drawing: the backing store is in device pixels. The world is drawn at an
 * integer device zoom, interpolated between the last two 60Hz ticks; every UI
 * layer is drawn in CSS pixels under the device-pixel-ratio transform, and hit
 * regions and pointer coordinates use CSS pixels too.
 *
 * The window.__dbg hook at the bottom exists in DEV builds only.
 */
import { generateMap } from './world/mapgen'
import { placeVillages, nearestUnvisitedGolden, CITIES_OF_GOLD, type Village } from './world/villages'
import { nearestLandDist } from './world/coast'
import { makeFog, reveal } from './world/fog'
import { makeState, tick, score, scoreParts, GameStatus, LOW_FOOD } from './game/state'
import { makeExplorer, moveExplorer } from './game/explorer'
import { Facing } from './game/gait'
import { findMoorings, moveShip, type Ship } from './game/ship'
import {
  foundOutpost,
  tickOutposts,
  resupply,
  canFound,
  tooCloseToVillage,
  OUTPOST_COST,
  OUTPOST_CREW,
  OUTPOST_MIN_CREW,
  type Outpost,
} from './game/outposts'
import { interactionTarget, RUMOR_RADIUS, type InteractionTarget } from './game/interact'
import { makeWeather, windAt, windFactor, stormAt, applyStorm, type Weather } from './game/weather'
import {
  discoverVillage,
  resolveTrade,
  resolveGift,
  resolveAttack,
  effectiveTemperament,
  moodOf,
  applyDrivenOff,
  HOSTILE_BELOW,
} from './game/encounter'
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
import { font } from './ui/font'
import { seedFromString } from './world/rng'
import { TILE } from './world/tiles'
import type { Screen } from './game/screen'

const REVEAL_RADIUS = 7
const VILLAGE_COUNT = 28
const AUTOSAVE_EVERY = 5 // seconds
const SAVE_KEY = 'seven-cities-save'
const CHRONICLE_KEY = 'seven-cities-chronicle'
/** A fresh token written when a tab takes over the save; storage events only fire on a changed value. */
const OWNER_KEY = 'seven-cities-save-owner'
const AUDIO_KEY = 'seven-cities-audio'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const input = new Input()

/** Device pixels per CSS pixel; the backing store is sized in device px. */
let dpr = 1
/** The view in CSS px: every UI layer and hit region is laid out in these. */
let cssW = 0
let cssH = 0
/** Device px per art px for the world: always an integer, so tiles stay crisp at any dpr. */
let devZoom = 2

/**
 * Where the camera and explorer stood at the start of the last playing tick;
 * render draws between here and the current state. False after a jump
 * (restore, landfall, resize, ...) so the next frame shows the new spot as is.
 */
let prevCam: Camera = { x: 0, y: 0 }
let prevPos = { x: 0, y: 0 }
let interpValid = false
const resetInterp = () => {
  interpValid = false
}

function resize() {
  dpr = window.devicePixelRatio || 1
  cssW = window.innerWidth
  cssH = window.innerHeight
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = cssW + 'px'
  canvas.style.height = cssH + 'px'
  devZoom = Math.max(2, Math.round(zoomFor(cssW) * dpr))
  resetInterp()
}
resize()
// a browser zoom changes devicePixelRatio and fires this too
window.addEventListener('resize', resize)

/** UI layers draw in CSS px; the transform maps them onto the device-px backing store. */
const uiTransform = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

const reduceMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
/** Seconds for the panels' decorative motion; held at 0 under the OS reduced-motion setting. */
const uiClock = () => (reduceMotion?.matches ? 0 : performance.now() / 1000)

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
  /** renderer precomputation; non-enumerable so World serializes as game state only */
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
/** What Enter on the title reset; Esc from the outfit screen puts it back. */
let titleReturn: {
  resumable: boolean
  career: Career
  nextVoyage: boolean
  justBanked: number
  promoted: boolean
  saveOwner: boolean
  ownerWarned: boolean
} | null = null
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

/**
 * Every key or click offers the browser audio; the first success is remembered.
 * A synthetic event cannot start audio, so it is never the press that gets swallowed.
 */
function onGesture(e: Event) {
  gestured = true
  if (crashed) return // the card keeps audio silent
  if (player.unlock() && !audioPrimed && e.isTrusted) {
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

// registered after Input's own listener, so the key is already queued when a pause drops it
window.addEventListener('keydown', (e) => {
  touchOnly = false
  onGesture(e)
  // a driving bot's keys go to Input; step() still runs update() after a crash
  if (crashed && !driven) {
    // update() no longer runs; the recovery card's two keys are read here
    if (e.ctrlKey || e.metaKey || e.altKey) return
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
/** CSS px, the space hit regions are registered in under the UI transform. */
function canvasPoint(e: MouseEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
canvas.addEventListener('click', (e) => {
  onGesture(e)
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
    lowFood: world.state.food < LOW_FOOD && world.state.status === GameStatus.Playing,
    citiesFound: world.state.citiesFound,
    won: world.state.status === GameStatus.Won,
    lost: world.state.status === GameStatus.Lost,
  }
}

function sceneInput(): SceneInput {
  const s = world.state
  const famine = s.food < LOW_FOOD ? 1 - s.food / LOW_FOOD : 0
  let hostility = 0
  if (screen === 'walkin' && walkin) {
    hostility = walkin.hostile ? 1 : 0
  } else if (!world.sailing) {
    for (const v of world.villages) {
      if (v.depleted) continue
      if (moodOf(effectiveTemperament(v.temperament, s.fear)) !== 'hostile') continue
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
    distToLand: world.sailing ? nearestLandDist(world.map, world.explorer.x, world.explorer.y) : 0,
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
  // non-enumerable: __dbg.world() and any serializer see only game state
  return Object.defineProperty(w, 'art', { value: buildWorldArt(map), enumerable: false }) as World
}

function embark() {
  titleReturn = null
  world = newWorld(world.seedStr)
  claimSave(true) // a fresh expedition takes the slot even if another tab wrote meanwhile
  applyOutfit()
  resetInterp()
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
  resetInterp()
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
  titleReturn = null
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

/** A stored save loadSave() rejects: damaged, or written in another format. */
function unreadableSave(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return !!raw && deserializeSave(raw) === null
  } catch {
    return false
  }
}
// reported on the title; the next expedition's save replaces it
if (unreadableSave()) flash = { text: 'Your saved expedition could not be read.', t: 3.5 }

function loadChronicle(): ChronicleEntry[] {
  try {
    return deserializeChronicle(localStorage.getItem(CHRONICLE_KEY) ?? '[]')
  } catch {
    return []
  }
}

/** The expedition's final tally: score() is the sum of scoreParts, plus the gold banked in Spain. */
function finalScore(): number {
  return score(world.state, world.fog.revealedCount) + career.banked
}

function recordExpedition() {
  const s = world.state
  const entry: ChronicleEntry = {
    seedStr: world.seedStr,
    won: s.status === GameStatus.Won,
    score: finalScore(),
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
  resetInterp()
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

/** What E would act on right now; the action and its prompt both read this. */
function currentTarget(): InteractionTarget | null {
  return interactionTarget({
    map: world.map,
    sailing: world.sailing,
    explorer: world.explorer,
    villages: world.villages,
    outposts: world.outposts,
    ships: world.ships,
  })
}

function update(dt: number) {
  const click = clicks.shift() ?? null
  const firstUnlock = swallowStart
  swallowStart = false
  // the press that struck up the title theme does nothing else, M included
  if (input.pressed('m') && !(firstUnlock && screen === 'start')) {
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
      applyDrivenOff(world.state)
      flash = { text: 'The villagers drive you out!', t: 2.5 }
      audioEvents.push('driven-off')
      screen = 'playing'
      walkin = null
    }
    if (screen !== 'walkin') resetInterp()
    input.endFrame()
    pumpAudio()
    return
  }

  if (screen === 'start') {
    // while a touch-only device is gated, taps on the (unregistered) start lines are ignored
    const startNew = input.pressed('enter') || (!touchOnly && click === 'start-new')
    const startContinue = !startNew && (input.pressed('c') || (!touchOnly && click === 'start-continue'))
    if (firstUnlock) {
      // this press struck up the title theme; stay so it is heard, the next press proceeds
    } else if (startNew) {
      outfitReplacesSave = titleInfo?.hasSave ?? loadSave() !== null
      const back = { resumable, career, nextVoyage, justBanked, promoted, saveOwner, ownerWarned }
      resetSession()
      titleReturn = back
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
    } else if (input.pressed('esc') && !nextVoyage) {
      if (titleReturn) {
        // a storage event since Enter still stands
        const back = titleReturn
        ;({ resumable, career, nextVoyage, justBanked, promoted, ownerWarned } = back)
        saveOwner = saveOwner && back.saveOwner
        titleReturn = null
      }
      screen = 'start'
    }
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
  const fromCam = { x: world.cam.x, y: world.cam.y }
  const fromPos = { x: explorer.x, y: explorer.y }

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
      world.ships[world.activeShip].facing = explorer.facing
    } else {
      moveExplorer(map, explorer, dx, dy, sdt)
    }
    const foodBefore = state.food
    reveal(fog, Math.floor(explorer.x), Math.floor(explorer.y), REVEAL_RADIUS)
    tick(state, sdt)
    tickOutposts(world.outposts, sdt)
    if (foodBefore >= LOW_FOOD && state.food < LOW_FOOD) {
      flash = { text: 'Provisions low — find a fort, trade, or sail WEST to Spain!', t: 3.5 }
    }
    // an expedition that ended this tick takes no further action
    if (state.status !== GameStatus.Playing) {
      clearSave()
      recordExpedition()
      resumable = false
      screen = 'over'
    }

    if (screen === 'playing' && !world.sailing && input.pressed('f')) {
      // raise a mission fort here
      const tx = Math.floor(explorer.x)
      const ty = Math.floor(explorer.y)
      if (tooCloseToVillage(world.villages, tx, ty)) flash = { text: 'The people already dwell here.', t: 2 }
      else if (!canFound(state)) {
        flash = { text: `A fort needs ${OUTPOST_COST} gold and ${OUTPOST_MIN_CREW} men (${OUTPOST_CREW} stay as garrison).`, t: 2.5 }
      }
      else if (foundOutpost(state, world.outposts, tx, ty)) {
        flash = { text: 'A mission fort rises. The garrison will gather provisions.', t: 3 }
        saveGame()
      } else flash = { text: 'Too close to another outpost.', t: 2 }
    }

    const target = screen === 'playing' && input.pressed('action') ? currentTarget() : null
    if (target) {
      switch (target.kind) {
        case 'spain': {
          // set course for Spain: bank the gold, count the voyage
          const before = rankIndex(career.banked)
          justBanked = Math.floor(state.gold)
          career = bankGold(career, state.gold)
          state.gold = 0
          promoted = rankIndex(career.banked) > before
          flash = { text: '', t: 0 } // the court screen shows toasts now; none from the voyage
          screen = 'spain'
          saveGame('refit')
          break
        }
        case 'landfall':
          // step ashore; the ship stays moored where we left it
          resetInterp()
          world.sailing = false
          explorer.x = target.spot[0] + 0.5
          explorer.y = target.spot[1] + 0.5
          flash = { text: 'You make landfall.', t: 2 }
          saveGame()
          break
        case 'village': {
          const v = target.village
          const firstGolden = v.golden && !v.visited
          discoverVillage(state, v)
          if (firstGolden) {
            flash = { text: `A City of Gold — ${state.citiesFound} of ${CITIES_OF_GOLD} found!`, t: 3 }
          }
          walkin = makeScene(v, state.fear)
          walkinVillage = v
          resetInterp()
          screen = 'walkin'
          break
        }
        case 'outpost': {
          const taken = resupply(state, target.outpost)
          flash = { text: `The garrison shares its stores: +${taken} provisions.`, t: 2.5 }
          saveGame()
          break
        }
        case 'ship': {
          const ship = world.ships[target.index]
          resetInterp()
          world.activeShip = target.index
          world.sailing = true
          explorer.x = ship.x
          explorer.y = ship.y
          // the hull keeps the heading it was moored with
          explorer.facing = ship.facing ?? Facing.E
          explorer.gait = 0
          explorer.moving = false
          flash = { text: 'You board your ship. The coast is yours to follow.', t: 2 }
          saveGame()
          break
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
    }
  }

  centerCamera(world.cam, explorer.x, explorer.y, canvas.width, canvas.height, map.width, map.height, devZoom)
  // after a jump this tick, the next frame starts from where things landed
  prevCam = interpValid ? fromCam : { x: world.cam.x, y: world.cam.y }
  prevPos = interpValid ? fromPos : { x: explorer.x, y: explorer.y }
  interpValid = true
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
        invalidateMinimap() // a few dozen tiles would not trip the chart's own refresh
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

/**
 * One frame. `alpha` (0-1) places the playing view between the last two ticks;
 * the lerp is drawn from copies, never written back to the world.
 */
function render(alpha = 1) {
  beginHits()
  uiTransform()

  if (screen === 'start') {
    titleInfo ??= { hasSave: loadSave() !== null, chronicle: loadChronicle() }
    const soundLine = touchOnly ? undefined : muted ? 'M to unmute' : gestured ? 'M to mute' : 'Press any key for sound'
    drawStartScreen(ctx, cssW, cssH, world.seedStr, resumable || titleInfo.hasSave, titleInfo.chronicle, {
      soundLine,
      needKeyboard: touchOnly,
    })
    if (flash.t > 0) drawResult(ctx, cssW, flash.text, 28)
    return
  }
  titleInfo = null
  if (screen === 'outfit') {
    drawOutfitScreen(ctx, cssW, cssH, outfit, outfitRow, budgetFor(career.banked), !nextVoyage && outfitReplacesSave)
    if (flash.t > 0) drawResult(ctx, cssW, flash.text, 28)
    return
  }
  if (screen === 'spain') {
    drawSpainScreen(ctx, cssW, cssH, career, world.state, justBanked, promoted, uiClock())
    if (flash.t > 0) drawResult(ctx, cssW, flash.text, 28)
    return
  }
  if (screen === 'walkin' && walkin && walkinVillage) {
    let note: string
    if (walkin.hostile) {
      // hostile even with no fear to blame: the village's own nature, not your deeds
      note =
        walkinVillage.temperament < HOSTILE_BELOW
          ? 'This people wants no strangers here. They close in...'
          : 'The people remember what your kind has done. They close in...'
    } else {
      note =
        moodOf(walkin.mood) === 'friendly'
          ? 'The people watch you with open curiosity.'
          : 'The people keep their distance, wary of the stranger.'
    }
    drawWalkin(ctx, cssW, cssH, walkin, tileset, note, spriteBank, uiClock())
    if (flash.t > 0) drawResult(ctx, cssW, flash.text, 12)
    return
  }

  // the world pass works in device px at an integer zoom, so the snaps in the
  // renderer land on whole device pixels
  let cam = world.cam
  let explorer = world.explorer
  if (screen === 'playing' && interpValid && !paused && alpha < 1) {
    const lerp = (a: number, b: number) => a + (b - a) * alpha
    cam = { x: lerp(prevCam.x, world.cam.x), y: lerp(prevCam.y, world.cam.y) }
    explorer = { ...world.explorer, x: lerp(prevPos.x, world.explorer.x), y: lerp(prevPos.y, world.explorer.y) }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const rc: RenderCtx = { ctx, viewW: canvas.width, viewH: canvas.height, tileset, zoom: devZoom }
  renderWorld(rc, cam, world.map, world.fog, world.villages, explorer, world.ships, world.activeShip, world.sailing, world.outposts, world.art)
  renderStorms(rc, cam, world.weather, world.state.elapsed, world.map, world.fog)

  uiTransform()
  const hudH = drawHud(ctx, cssW, world.state, career.banked)
  const uiRc: RenderCtx = { ctx, viewW: cssW, viewH: cssH, tileset, zoom: devZoom / dpr }
  renderMinimap(uiRc, world.map, world.fog, explorer, world.villages, world.ships, world.outposts, hudH + 12, cam, world.art.relief)
  if (world.sailing) {
    const wind = windAt(world.weather, world.state.elapsed)
    drawWindIndicator(ctx, cssW, wind.angle, wind.strength, hudH + 12)
    // storm vignette: the sky presses down while you ride one out
    if (stormHere()) {
      const g = ctx.createRadialGradient(
        cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.3,
        cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.7,
      )
      g.addColorStop(0, 'rgba(20,12,16,0)')
      g.addColorStop(1, 'rgba(30,10,14,0.5)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, cssW, cssH)
    }
  }
  if (!encounter && screen === 'playing') {
    let text = ''
    let color = '#e8e8ee'
    const target = currentTarget()
    switch (target?.kind) {
      case 'spain':
        text = 'Press E to sail home to Spain'
        color = '#f4c430'
        break
      case 'landfall':
        text = 'Press E to make landfall'
        break
      case 'village': {
        const golden = target.village.golden
        text = `Press E to approach ${golden ? 'the golden city' : 'the village'}`
        if (golden) color = '#f4c430'
        break
      }
      case 'outpost':
        text = `Press E to resupply (${Math.floor(target.outpost.stock)} in stores)`
        break
      case 'ship':
        text = 'Press E to board your ship'
        break
    }
    if (text) {
      ctx.font = font(16)
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(cssW / 2 - 185, cssH - 56, 370, 32)
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle' // centred in the plate
      ctx.fillText(text, cssW / 2, cssH - 40)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }
  }

  // quiet key reference in the corner
  if (screen === 'playing' && !encounter) {
    const hint = world.sailing ? 'E interact · M sound · Esc menu' : 'E interact · F fort · M sound · Esc menu'
    ctx.font = font(12)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    // a 1px dark copy keeps it legible over bright terrain without a plate
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.fillText(hint, 13, cssH - 11)
    ctx.fillStyle = '#b4b4be'
    ctx.fillText(hint, 12, cssH - 12)
  }

  // the banner yields while a decision panel is up — no overlapping chrome
  if (flash.t > 0 && screen === 'playing' && !encounter) drawResult(ctx, cssW, flash.text, hudH + 10)
  if (encounter)
    drawEncounter(ctx, cssW, cssH, encounter, world.state.goods, world.state.fear, uiClock())

  if (screen === 'over') {
    const won = world.state.status === GameStatus.Won
    drawGameOver(
      ctx,
      cssW,
      cssH,
      won,
      finalScore(),
      career,
      {
        cities: world.state.citiesFound,
        day: world.state.day,
        parts: scoreParts(world.state, world.fog.revealedCount),
      },
      uiClock(),
    )
    if (flash.t > 0) drawResult(ctx, cssW, flash.text, 28)
  }
}

/** The loop's frame: the recovery card after a crash, else the game plus any pause banner. */
function present(alpha: number) {
  if (crashed) {
    drawCrashCard()
    return
  }
  render(alpha)
  uiTransform()
  if (paused) drawResult(ctx, cssW, 'Paused — press any key', Math.round(cssH / 2) - 17)
}

/** Drawn from nothing but the canvas: no world, HUD or state that might be what broke. */
function drawCrashCard() {
  const w = cssW
  const h = cssH
  // a throw may have left a save(), clip or transform open
  if (typeof ctx.reset === 'function') ctx.reset()
  uiTransform()
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, w, h)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = font(22, true)
  ctx.fillStyle = '#e8e8ee'
  ctx.fillText('Something went wrong.', Math.round(w / 2), Math.round(h / 2) - 12)
  ctx.font = font(16)
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
    input.keepOnBlur = true
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
    audioScene: () => ({ // soundscape inputs, derived controls and texture firing counts; hostility counts moodOf-hostile villages
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
      resetInterp()
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
        resetInterp()
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
