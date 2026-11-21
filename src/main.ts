/**
 * The app shell: owns the canvas, input, audio player and the one mutable
 * World, and wires the pure rules (src/game, src/world) to the renderer.
 * Its seams live in src/app/: storage.ts (every localStorage access),
 * viewport.ts (canvas sizing, the UI transform, the panels' clock),
 * lifecycle.ts (pure, DOM-free: the pause, crash, gesture and swallow rules)
 * and devhooks.ts (the DEV-only window.__dbg audio probes).
 *
 * Screen state machine:
 *   start -> outfit -> playing <-> walkin
 *   playing -> spain -> outfit (the next voyage, same New World)
 *   playing -> over -> outfit (a fresh world)
 *   Esc from playing saves and returns to start with the world kept live
 *   (resumable); C on the title resumes it, else restores the save. A save
 *   taken on the way to Spain is marked 'refit' and resumes on the outfit screen.
 * Each screen has its own update and render function (updateStart,
 * renderStart, ...); update() and render() only do the shared work and dispatch.
 *
 * Two states sit over any screen. Paused: blur or hide mid-expedition holds
 * the simulation until the next key or click, which is swallowed. Crashed: a
 * throw from the loop leaves only a recovery card (Esc reloads, X discards the
 * save). A hidden tab also saves and suspends audio.
 *
 * Persistence is localStorage only, through src/app/storage.ts:
 * 'seven-cities-save' holds the running expedition, 'seven-cities-chronicle'
 * the record of finished ones and 'seven-cities-audio' the mute choice. Only
 * the tab that last wrote the save, or claimed it through
 * 'seven-cities-save-owner', keeps saving (see saveOwner).
 *
 * Drawing: the backing store is in device pixels. The world is drawn at an
 * integer device zoom, interpolated between the last two 60Hz ticks; every UI
 * layer is drawn in CSS pixels under the device-pixel-ratio transform, and hit
 * regions and pointer coordinates use CSS pixels too.
 *
 * The window.__dbg hook is installed at the bottom, in DEV builds only.
 */
import { generateMap } from './world/mapgen'
import { placeVillages, nearestUnvisitedGolden, type Village } from './world/villages'
import { nearestLandDist } from './world/coast'
import { makeFog, reveal } from './world/fog'
import { makeState, tick, score, scoreParts, canCamp, makeCamp, GameStatus, LOW_FOOD, CAMP_FOOD } from './game/state'
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
  resolveAmaze,
  effectiveTemperament,
  moodOf,
  applyDrivenOff,
  HOSTILE_BELOW,
  type EncounterAction,
} from './game/encounter'
import { villageName, rumorLine, cityFoundToast } from './game/lore'
import { findLandmarks, checkDiscoveries, DISCOVERY_BONUS, type Landmark } from './game/discoveries'
import { DEFAULT_SEED, parseSeedQuery, nextSeedPreset } from './game/seeds'
import { makeScene, tickScene, type WalkinScene } from './game/walkin'
import { makeCareer, bankGold, budgetFor, rankIndex, type Career } from './game/career'
import { direct, ambienceFor, type AudioSnapshot, type GameEvent } from './audio/director'
import { AudioPlayer } from './audio/player'
import { musicFor } from './audio/score'
import { sceneControls, type SceneInput } from './audio/scene'
import { drawWalkin } from './ui/walkin'
import { defaultOutfit, adjustOutfit, remainingBudget, type Outfit } from './game/outfit'
import { unpackBits, mapFingerprint, validateSaveForWorld, type SaveData, type SavePhase } from './game/save'
import type { ChronicleEntry } from './game/chronicle'
import { buildTileset } from './art/tileset'
import { Input } from './engine/input'
import { centerCamera, type Camera } from './engine/camera'
import { beginHits, hitAt, setHover } from './ui/hit'
import { startLoop } from './engine/loop'
import { renderWorld, renderMinimap, renderStorms, invalidateMinimap, type RenderCtx, type WorldArt } from './engine/renderer'
import { buildRelief } from './art/relief'
import { buildEdges, buildEdgeKeys } from './art/edges'
import { buildDeckles } from './art/paper'
import { buildSpriteBank } from './art/spritebank'
import { drawHud, drawWindIndicator } from './ui/hud'
import { drawStartScreen, drawOutfitScreen, drawSpainScreen, drawEncounter, drawGameOver, drawResult, drawHelpOverlay } from './ui/panels'
import { drawWorldChart, invalidateChart } from './ui/chart'
import { font } from './ui/font'
import { seedFromString } from './world/rng'
import { TILE } from './world/tiles'
import type { Screen } from './game/screen'
import {
  SAVE_KEY,
  OWNER_KEY,
  loadMuted,
  storeMuted,
  announceOwner,
  writeSave,
  loadSave,
  unreadableSave,
  removeSave,
  loadChronicle,
  appendChronicle,
} from './app/storage'
import { createViewport } from './app/viewport'
import { makeLifecycle, isIgnoredKey, routeKey, routeClick, pauseForFocus, takeFirstUnlock, standAside } from './app/lifecycle'
import { audioProbes } from './app/devhooks'

const REVEAL_RADIUS = 7
const VILLAGE_COUNT = 28
const AUTOSAVE_EVERY = 5 // seconds

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const announcer = document.getElementById('announcer')
let lastAnnounced = ''
/** Mirror important canvas notices into the visually hidden aria-live region. */
function announce(text: string) {
  if (!announcer || !text || text === lastAnnounced) return
  lastAnnounced = text
  announcer.textContent = text
}
const input = new Input()

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

let worldReady = false
/** Centre and clamp a world's camera to the current canvas dimensions and zoom. */
function centerWorldCam(w: World) {
  centerCamera(w.cam, w.explorer.x, w.explorer.y, canvas.width, canvas.height, w.map.width, w.map.height, view.devZoom)
}

/** dpr, the CSS-px view and the world's device zoom; a resize also drops interpolation and re-clamps the camera. */
const view = createViewport(canvas, ctx, () => {
  resetInterp()
  if (worldReady) centerWorldCam(world)
})
view.resize()
// a browser zoom changes devicePixelRatio and fires this too
window.addEventListener('resize', view.resize)

const uiTransform = view.uiTransform
const uiClock = view.uiClock

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
  landmarks: Landmark[]
  discovered: Set<number>
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
  invalidateChart()
  return {
    relief: buildRelief(map),
    edges: edgeSet,
    edgeKeys: buildEdgeKeys(map.tiles, map.width, map.height),
    deckles: deckleSet,
    sprites: spriteBank,
  }
}
let screen: Screen = 'start'
let world: World = newWorld(parseSeedQuery(location.search) ?? DEFAULT_SEED)
worldReady = true
centerWorldCam(world)
let outfit: Outfit = defaultOutfit()
let outfitRow = 0
let encounter: Village | null = null
let chartOpen = false
let helpOpen = false
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

/** Crashed, paused, first gesture, swallowed start press, touch-only, bot-driven: see src/app/lifecycle.ts. */
const life = makeLifecycle(
  typeof matchMedia === 'function' &&
    matchMedia('(pointer: coarse)').matches &&
    !matchMedia('(any-pointer: fine)').matches &&
    navigator.maxTouchPoints > 0,
)
/** Every key or click offers the browser audio through this. */
const unlockAudio = () => player.unlock()

let muted = loadMuted()
player.setMuted(muted)

/** The key or click that ends a pause (routeKey/routeClick cleared it) does nothing else. */
function unpause() {
  input.swallowHeld() // a movement key held to resume must not walk the explorer off
  clicks.length = 0
}

function saveIfPlaying() {
  if (life.crashed) return // the state that threw is not worth keeping
  if (screen === 'playing' || screen === 'walkin') saveGame()
}

// registered after Input's own listener, so the key is already queued when a pause drops it
window.addEventListener('keydown', (e) => {
  if (isIgnoredKey(e)) return
  const route = routeKey(life, e.isTrusted, unlockAudio)
  if (route === 'recovery') {
    // update() no longer runs; the recovery card's two keys are read here
    if (e.key === 'Escape') location.reload()
    else if (e.key?.toLowerCase() === 'x') {
      removeSave()
      location.reload()
    }
    return
  }
  if (route === 'unpause') unpause()
})
window.addEventListener('blur', () => {
  if (pauseForFocus(life, screen)) {
    saveIfPlaying()
    player.suspend()
  }
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseForFocus(life, screen)
    saveIfPlaying()
    player.suspend()
  } else if (!life.crashed && !life.paused) {
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
  const route = routeClick(life, e.isTrusted, unlockAudio)
  if (route === 'ignore') return
  if (route === 'unpause') {
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
    landmarks: findLandmarks(map), discovered: new Set<number>(),
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
  centerWorldCam(world)
  resetInterp()
  screen = 'playing'
}

/** A later voyage: the same New World, a fresh expedition off the same coast. */
function embarkVoyage() {
  const { map } = world
  world.explorer.x = map.landing.x + 0.5
  world.explorer.y = map.landing.y + 0.5
  world.explorer.facing = Facing.S
  world.explorer.gait = 0
  world.explorer.moving = false
  world.sailing = false
  world.state.morale = 100 // a fresh crew signs on
  applyOutfit()
  reveal(world.fog, Math.floor(world.explorer.x), Math.floor(world.explorer.y), REVEAL_RADIUS)
  centerWorldCam(world)
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
  chartOpen = false
  helpOpen = false
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

// --- save / load (the storage calls themselves are in src/app/storage.ts) ---

/** This tab becomes the one that saves; `announce` tells any other tab to stop now. */
function claimSave(announce: boolean) {
  saveOwner = true
  ownerWarned = false
  if (!announce) return
  announceOwner()
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
  const written = writeSave({
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
    discovered: [...world.discovered],
  })
  if (written) {
    storageOk = true
    return true
  }
  // storage full/blocked: the game plays on without saves, and says so once
  storageOk = false
  if (!storageWarned && screen === 'playing') {
    storageWarned = true
    flash = { text: 'Saving is unavailable in this browser: progress lasts only until you close the tab.', t: 4 }
  }
  return false
}

// reported on the title; the next expedition's save replaces it
if (unreadableSave()) flash = { text: 'Your saved expedition could not be read.', t: 3.5 }

/** The expedition's final tally: score() is the sum of scoreParts, plus the gold banked in Spain. */
function finalScore(): number {
  return score(world.state, world.fog.revealedCount, world.discovered.size) + career.banked
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
  appendChronicle(entry)
}

function clearSave() {
  if (!ownsSave()) return
  titleInfo = null
  removeSave()
}

/**
 * Rebuild the saved expedition on a freshly generated world. Throws when the
 * save does not fit that world; nothing module-level changes until it succeeds.
 */
function restoreWorld(save: SaveData): { world: World; career: Career } {
  const w = newWorld(save.seedStr)
  const mismatch = validateSaveForWorld(save, w.map, w.villages, w.fog.seen.length)
  if (mismatch) throw new Error(mismatch)

  w.state = { ...save.state }
  w.explorer.x = save.explorer.x
  w.explorer.y = save.explorer.y
  w.ships = save.ships.map((sh) => ({ x: sh.x, y: sh.y }))
  w.activeShip = save.activeShip
  w.sailing = save.sailing
  w.outposts = save.outposts.map((o) => ({ ...o }))
  w.fog.seen = unpackBits(save.fogSeenB64, w.fog.seen.length)
  w.fog.revealedCount = w.fog.seen.reduce((a, b) => a + b, 0)
  w.discovered = new Set(save.discovered.filter((id) => id >= 0 && id < w.landmarks.length))
  invalidateMinimap() // the restored fog reveals far more than the fresh world did
  invalidateChart()
  // placement (x, y, golden) regenerates from the seed and is covered by
  // mapHash; only the fields play changes are restored
  save.villages.forEach((sv, i) => {
    const v = w.villages[i]
    v.visited = sv.visited === true
    v.depleted = sv.depleted === true
    if (Number.isFinite(sv.temperament)) v.temperament = Math.max(0, Math.min(1, sv.temperament))
  })
  w.cam = { x: w.explorer.x, y: w.explorer.y }
  centerWorldCam(w)
  return { world: w, career: { ...save.career } }
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
    const restored = restoreWorld(save)
    world = restored.world
    career = restored.career
  } catch {
    clearSave()
    flash = { text: 'Your saved expedition could not be read.', t: 3.5 }
    return
  }
  prevSnap = null // ambience bed only: no cues for what the restored world "changed"
  flash = { text: '', t: 0 }
  encounter = null
  chartOpen = false
  helpOpen = false
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

/** One 60Hz tick: the shared M key and toast clock, then the current screen's update. */
function update(dt: number) {
  const click = clicks.shift() ?? null
  const firstUnlock = takeFirstUnlock(life)
  // the press that struck up the title theme does nothing else, M included
  if (input.pressed('m') && !(firstUnlock && screen === 'start')) {
    muted = player.toggleMute()
    storeMuted(muted)
    flash = { text: muted ? 'Sound muted (M to unmute)' : 'Sound on', t: 1.5 }
  }
  // the one place a toast ages, whatever screen shows it
  if (flash.t > 0) {
    flash.t -= dt * timeScale
    announce(flash.text)
  }

  if (screen === 'walkin' && walkin && walkinVillage) updateWalkin(dt, walkin, walkinVillage)
  else if (screen === 'start') updateStart(click, firstUnlock)
  else if (screen === 'outfit') updateOutfit(click)
  else if (screen === 'spain') updateSpain(click)
  else if (screen === 'over') updateOver(click)
  else updatePlaying(dt, click)
  input.endFrame()
  pumpAudio()
}

function updateWalkin(dt: number, scene: WalkinScene, village: Village) {
  const { dx, dy } = input.axis()
  const status = tickScene(scene, dx, dy, dt * timeScale)
  if (input.pressed('esc') || status === 'left') {
    screen = 'playing'
    walkin = null
  } else if (status === 'chief') {
    encounter = village
    screen = 'playing'
    walkin = null
  } else if (status === 'driven-off') {
    applyDrivenOff(world.state)
    flash = { text: 'Run away! The villagers drive you out with pointy sticks!', t: 2.8 }
    audioEvents.push('driven-off')
    screen = 'playing'
    walkin = null
  }
  if (screen !== 'walkin') resetInterp()
}

function updateStart(click: string | null, firstUnlock: boolean) {
  // while a touch-only device is gated, taps on the (unregistered) start lines are ignored
  const startNew = input.pressed('enter') || (!life.touchOnly && click === 'start-new')
  const startContinue = !startNew && (input.pressed('c') || (!life.touchOnly && click === 'start-continue'))
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
  } else if (input.pressed('p') || click === 'start-preset') {
    const preset = nextSeedPreset(world.seedStr)
    world = newWorld(preset.seed)
    resumable = false
    flash = { text: `World preset: ${preset.label}`, t: 2 }
  } else if (click === 'start-keyboard') {
    life.touchOnly = false
  }
}

function updateOutfit(click: string | null) {
  const fields: (keyof Outfit)[] = ['food', 'goods', 'crew', 'ships']
  if (input.pressed('up')) outfitRow = (outfitRow + fields.length - 1) % fields.length
  if (input.pressed('down')) outfitRow = (outfitRow + 1) % fields.length
  const budget = budgetFor(career.banked)
  const parseRow = (prefix: string): number | null => {
    if (!click?.startsWith(prefix)) return null
    const idx = Number(click.slice(prefix.length))
    return Number.isInteger(idx) && idx >= 0 && idx < fields.length ? idx : null
  }
  const hitRow = parseRow('outfit-row-')
  if (hitRow !== null) outfitRow = hitRow
  const decRow = parseRow('outfit-dec-')
  if (decRow !== null) {
    outfitRow = decRow
    outfit = adjustOutfit(outfit, fields[outfitRow], -1, budget)
  }
  const incRow = parseRow('outfit-inc-')
  if (incRow !== null) {
    outfitRow = incRow
    outfit = adjustOutfit(outfit, fields[outfitRow], 1, budget)
  }
  if (input.pressedOrRepeat('left')) outfit = adjustOutfit(outfit, fields[outfitRow], -1, budget)
  if (input.pressedOrRepeat('right')) outfit = adjustOutfit(outfit, fields[outfitRow], 1, budget)
  if (input.pressed('enter') || (!life.touchOnly && click === 'outfit-go')) {
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
}

function updateSpain(click: string | null) {
  if (input.pressed('enter') || click === 'spain-go') {
    outfit = defaultOutfit()
    outfitRow = 0
    nextVoyage = true
    screen = 'outfit'
  }
}

function updateOver(click: string | null) {
  if (input.pressed('enter') || click === 'over-restart') {
    resetSession()
    world = newWorld(String(1492 + (Math.floor(performance.now()) % 9999)))
    outfitReplacesSave = false
    outfit = defaultOutfit()
    outfitRow = 0
    encounter = null
    screen = 'outfit'
  }
}

/** 'playing' (and a 'walkin' with no scene, which falls through to here as it always has). */
function updatePlaying(dt: number, click: string | null) {
  const sdt = dt * timeScale
  const { map, fog, state, explorer } = world
  const fromCam = { x: world.cam.x, y: world.cam.y }
  const fromPos = { x: explorer.x, y: explorer.y }

  if (encounter) {
    if (input.pressed('1') || click === 'enc-1') chooseEncounter('trade')
    else if (input.pressed('2') || click === 'enc-2') chooseEncounter('gift')
    else if (input.pressed('3') || click === 'enc-3') chooseEncounter('attack')
    else if (input.pressed('4') || click === 'enc-4') chooseEncounter('amaze')
    else if (input.pressed('esc') || click === 'enc-esc') encounter = null
  } else if (chartOpen) {
    if (input.pressed('tab') || input.pressed('esc') || click === 'chart-close') chartOpen = false
  } else if (helpOpen) {
    if (input.pressed('h') || input.pressed('?') || input.pressed('esc') || click === 'help-close') helpOpen = false
  } else if (input.pressed('tab') || click === 'open-chart') {
    chartOpen = true
  } else if (input.pressed('h') || input.pressed('?')) {
    helpOpen = true
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
        if (flash.t <= 0) flash = { text: 'A squall batters the ship — the helm answers like a wet kipper!', t: 1.5 }
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
    const newLandmarks = checkDiscoveries(world.landmarks, world.discovered, explorer.x, explorer.y)
    if (newLandmarks.length > 0) {
      audioEvents.push('discover')
      flash = { text: `Charted ${newLandmarks[0].name}! (+${DISCOVERY_BONUS} fame)`, t: 3.4 }
    }
    tick(state, sdt)
    tickOutposts(world.outposts, sdt)
    if (foodBefore >= LOW_FOOD && state.food < LOW_FOOD) {
      flash = { text: "Provisions low — the crew eyes the ship's parrot. Find a fort, trade, or sail WEST!", t: 3.8 }
    }
    // an expedition that ended this tick takes no further action
    if (state.status !== GameStatus.Playing) {
      clearSave()
      recordExpedition()
      resumable = false
      screen = 'over'
      announce(
        state.status === GameStatus.Won
          ? `Victory! All 7 Cities of Gold-Tone Metal found. Final score ${finalScore()}.`
          : `Expedition lost. Final score ${finalScore()}.`,
      )
    }

    if (screen === 'playing' && !world.sailing && input.pressed('f')) {
      // raise a mission fort here
      const tx = Math.floor(explorer.x)
      const ty = Math.floor(explorer.y)
      if (tooCloseToVillage(world.villages, tx, ty)) flash = { text: 'The people already dwell here.', t: 2 }
      else if (!canFound(state)) {
        flash = { text: `A fort needs ${OUTPOST_COST} gold-tone and ${OUTPOST_MIN_CREW} men (${OUTPOST_CREW} stay as garrison).`, t: 2.8 }
      }
      else if (foundOutpost(state, world.outposts, tx, ty)) {
        flash = { text: 'A mission fort rises. It is only a model, yet the garrison gathers provisions.', t: 3.2 }
        saveGame()
      } else flash = { text: 'Too close to another outpost.', t: 2 }
    }

    if (screen === 'playing' && !world.sailing && input.pressed('b')) {
      // classic 1984 expedition camp: trade provisions & half a day for morale
      if (makeCamp(state)) {
        audioEvents.push('camp')
        flash = { text: 'Camp pitched. Morale rises over questionable stew and coconut-shell percussion.', t: 3 }
        saveGame()
      } else if (state.food < CAMP_FOOD) {
        flash = { text: `Camping needs ${CAMP_FOOD} provisions — not even enough for gruel.`, t: 2.5 }
      } else if (!canCamp(state)) {
        flash = { text: 'Spirits are already high; the crew declines a nap.', t: 2 }
      }
    }

    const target = screen === 'playing' && input.pressed('action') ? currentTarget() : null
    if (target) actOn(target)

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

  centerWorldCam(world)
  // after a jump this tick, the next frame starts from where things landed
  prevCam = interpValid ? fromCam : { x: world.cam.x, y: world.cam.y }
  prevPos = interpValid ? fromPos : { x: explorer.x, y: explorer.y }
  interpValid = true
}

/** E on the current target; drawActionPrompt() words the same choice. */
function actOn(target: InteractionTarget) {
  const { state, explorer } = world
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
        flash = { text: cityFoundToast(villageName(v, world.villages), state.citiesFound), t: 3.5 }
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
    default: {
      const _exhaustive: never = target
      return _exhaustive
    }
  }
}

function chooseEncounter(action: EncounterAction) {
  const v = encounter!
  const { state, villages, fog } = world
  const goldBefore = state.gold
  const crewBefore = state.crew
  const goodsBefore = state.goods

  if (action === 'amaze') {
    const outcome = resolveAmaze(state, v)
    audioEvents.push('amaze')
    if (outcome === 'amazed') {
      flash = { text: 'Your shiny gold-tone spectacle amazes the crowd! Goodwill rises.', t: 3 }
    } else if (outcome === 'mocked') {
      flash = { text: 'They mock your gleaming helmet! ("Your mother was a hamster!")', t: 3 }
    } else {
      flash = { text: 'They applaud politely. "It is only a model," murmurs an elder.', t: 2.8 }
    }
    encounter = null
    if (state.crew > 0 && state.morale > 0) saveGame()
    return
  }

  if (action === 'trade') resolveTrade(state, v)
  else if (action === 'gift') resolveGift(state, v)
  else resolveAttack(state, v)
  audioEvents.push(action)

  if (action === 'gift') {
    if (state.goods < goodsBefore) {
      // natives share rumors: compass bearing + chart the land around the nearest unfound city
      const target = nearestUnvisitedGolden(villages, v.x, v.y)
      if (target) {
        reveal(fog, target.x, target.y, RUMOR_RADIUS)
        invalidateMinimap() // a few dozen tiles would not trip the chart's own refresh
        flash = { text: rumorLine(v, target), t: 4 }
      } else {
        flash = { text: 'You offer gifts. Goodwill rises (a very nice shrubbery).', t: 2.5 }
      }
    } else {
      flash = { text: 'You have no goods left to give.', t: 2.5 }
    }
  } else if (action === 'trade') {
    const gained = state.gold - goldBefore
    flash =
      gained > 0
        ? { text: `Traded for ${gained} gold-tone doubloons. (Guaranteed 67% shiny.)`, t: 2.8 }
        : { text: 'No goods to trade with!', t: 2.5 }
  } else {
    const lost = crewBefore - state.crew
    flash = { text: `Raid! +${state.gold - goldBefore} gold-tone, ${lost} crew lost. ('Tis but a scratch!)`, t: 2.8 }
  }
  encounter = null
  if (state.crew > 0 && state.morale > 0) saveGame()
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
    renderStart()
    return
  }
  titleInfo = null
  if (screen === 'outfit') renderOutfit()
  else if (screen === 'spain') renderSpain()
  else if (screen === 'walkin' && walkin && walkinVillage) renderWalkin(walkin, walkinVillage)
  else {
    // the game-over card is drawn over the world it ended in
    renderPlaying(alpha)
    if (screen === 'over') renderOver()
  }
}

function renderStart() {
  titleInfo ??= { hasSave: loadSave() !== null, chronicle: loadChronicle() }
  const soundLine = life.touchOnly ? undefined : muted ? 'M to unmute' : life.gestured ? 'M to mute' : 'Press any key for sound'
  drawStartScreen(ctx, view.cssW, view.cssH, world.seedStr, resumable || titleInfo.hasSave, titleInfo.chronicle, {
    ...(soundLine ? { soundLine } : {}),
    needKeyboard: life.touchOnly,
  })
  if (flash.t > 0) drawResult(ctx, view.cssW, flash.text, 28)
}

function renderOutfit() {
  drawOutfitScreen(ctx, view.cssW, view.cssH, outfit, outfitRow, budgetFor(career.banked), !nextVoyage && outfitReplacesSave)
  if (flash.t > 0) drawResult(ctx, view.cssW, flash.text, 28)
}

function renderSpain() {
  drawSpainScreen(
    ctx,
    view.cssW,
    view.cssH,
    career,
    world.state,
    justBanked,
    promoted,
    uiClock(),
    { found: world.discovered.size, total: world.landmarks.length },
  )
  if (flash.t > 0) drawResult(ctx, view.cssW, flash.text, 28)
}

function renderWalkin(scene: WalkinScene, village: Village) {
  let note: string
  if (scene.hostile) {
    // hostile even with no fear to blame: the village's own nature, not your deeds
    note =
      village.temperament < HOSTILE_BELOW
        ? 'This people wants no strangers. "Run away! Run away!" advise your knees.'
        : 'Word of your deeds arrived first. They fetch the pointy sticks...'
  } else {
    note =
      moodOf(scene.mood) === 'friendly'
        ? 'The people marvel at your shiny gold-tone hat.'
        : 'The people watch you warily, unconvinced by your silly walk.'
  }
  drawWalkin(ctx, view.cssW, view.cssH, scene, tileset, note, spriteBank, uiClock())
  if (flash.t > 0) drawResult(ctx, view.cssW, flash.text, 8)
}

/** The world, HUD, minimap and prompts: 'playing', and under the 'over' card. */
function renderPlaying(alpha: number) {
  const { cssW, cssH, dpr, devZoom } = view
  // the world pass works in device px at an integer zoom, so the snaps in the
  // renderer land on whole device pixels
  let cam = world.cam
  let explorer = world.explorer
  if (screen === 'playing' && interpValid && !life.paused && alpha < 1) {
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
  const modalOpen = !!encounter || chartOpen || helpOpen
  if (!modalOpen && screen === 'playing') drawActionPrompt()

  // quiet key reference in the corner
  if (screen === 'playing' && !modalOpen) {
    const hint = world.sailing
      ? 'E act · Tab chart · H help · M sound · Esc menu'
      : 'E act · F fort · B camp · Tab chart · H help · M sound · Esc menu'
    ctx.font = font(12)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    // a 1px dark copy keeps it legible over bright terrain without a plate
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.fillText(hint, 13, cssH - 11)
    ctx.fillStyle = '#b4b4be'
    ctx.fillText(hint, 12, cssH - 12)
  }

  // the banner yields while a decision panel or overlay is up — no overlapping chrome
  if (flash.t > 0 && screen === 'playing' && !modalOpen) drawResult(ctx, cssW, flash.text, hudH + 10)
  if (encounter)
    drawEncounter(ctx, cssW, cssH, encounter, world.state.goods, world.state.fear, uiClock(), villageName(encounter, world.villages))
  else if (chartOpen && screen === 'playing')
    drawWorldChart(
      ctx,
      cssW,
      cssH,
      world.map,
      world.fog,
      explorer,
      world.villages,
      world.ships,
      world.outposts,
      world.landmarks,
      world.discovered,
      world.art.relief,
      world.state.citiesFound,
    )
  else if (helpOpen && screen === 'playing') drawHelpOverlay(ctx, cssW, cssH)
}

/** The plate naming what E would do; actOn() does it. */
function drawActionPrompt() {
  const { cssW, cssH } = view
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

function renderOver() {
  const won = world.state.status === GameStatus.Won
  drawGameOver(
    ctx,
    view.cssW,
    view.cssH,
    won,
    finalScore(),
    career,
    {
      cities: world.state.citiesFound,
      day: world.state.day,
      parts: scoreParts(world.state, world.fog.revealedCount, world.discovered.size),
    },
    uiClock(),
  )
  if (flash.t > 0) drawResult(ctx, view.cssW, flash.text, 28)
}

/** The loop's frame: the recovery card after a crash, else the game plus any pause banner. */
function present(alpha: number) {
  if (life.crashed) {
    drawCrashCard()
    return
  }
  render(alpha)
  uiTransform()
  if (life.paused) drawResult(ctx, view.cssW, 'Paused — press any key', Math.round(view.cssH / 2) - 17)
}

/** Drawn from nothing but the canvas: no world, HUD or state that might be what broke. */
function drawCrashCard() {
  const w = view.cssW
  const h = view.cssH
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

// window.__dbg: the automated playthrough bots drive and inspect the game
// through this. A STABLE API: add entries, never rename or remove one, and keep
// every signature and behaviour. The state-free audio probes come from
// src/app/devhooks.ts; the DEV guard keeps both out of production builds.
if (import.meta.env.DEV) {
  /** A bot is driving: clear every lifecycle gate so no key it sends is eaten. */
  const standAsideForBot = () => {
    standAside(life)
    input.keepOnBlur = true
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
      standAsideForBot()
      for (let i = 0; i < frames; i++) update(1 / 60)
      render() // keep the canvas current even when rAF is throttled
    },
    walkin: () => walkin, // the active walk-in scene, or null
    career: () => career, // banked gold and voyage count
    storage: () => ({ ok: storageOk, owner: saveOwner, resumable }), // last save write succeeded; this tab owns the save; Esc left a live world
    ...audioProbes(player, sceneInput), // audioLog, renderCue, audioScene, renderTexture, renderTheme
    setSeed: (s: string) => { // fresh world from seed s, back on the title ready for Enter
      standAsideForBot()
      resetInterp()
      world = newWorld(s)
      resetSession()
      encounter = null
      chartOpen = false
      helpOpen = false
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
    life.crashed = true
    player.suspend()
  },
  isPaused: () => life.paused || life.crashed,
})
