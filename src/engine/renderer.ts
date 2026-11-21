import type { GameMap } from '../world/mapgen'
import { stormCenter, type Weather } from '../game/weather'
import { isSeen, type Fog } from '../world/fog'
import type { Explorer } from '../game/explorer'
import type { Village } from '../world/villages'
import type { Camera } from './camera'
import { TILE_PX, DEPTH_RAMP, type Tileset } from '../art/tileset'
import { drawVillage, drawCanoe, drawFort, drawShadow } from '../art/sprites'
import { drawExplorerSprite, drawShipSprite, type SpriteBank } from '../art/spritebank'
import type { Outpost } from '../game/outposts'
import { TILE } from '../world/tiles'
import { tileHash } from '../world/rng'
import { PHASES, SHADES, type Relief } from '../art/relief'
import type { EdgeSet } from '../art/edges'
import { paperPattern, type DeckleSet } from '../art/paper'
import { addHit } from '../ui/hit'

export interface RenderCtx {
  ctx: CanvasRenderingContext2D
  /** the world pass: device px, drawn under the identity transform; the minimap: CSS px */
  viewW: number
  viewH: number
  tileset: Tileset
  /**
   * Viewport pixels per art pixel. The world pass gets an integer in device px;
   * the minimap, drawn with the UI in CSS px, gets that zoom divided by the
   * device pixel ratio so its view rectangle still covers the same tiles.
   */
  zoom: number
}

/** Everything precomputed for the current world, handed to the draw loop. */
export interface WorldArt {
  relief: Relief
  edges: EdgeSet
  edgeKeys: Uint16Array
  deckles: DeckleSet
  sprites: SpriteBank
}

/**
 * The OS reduced-motion preference. Read per frame so a change applies live;
 * guarded because node tests import this module.
 */
const reduceMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

/** How close (in tiles) the explorer must be for a tile to count as "in view". */
const VIEW_RADIUS = 5

/**
 * A 256-entry sine table. The wind and the surf both want a sine of something
 * linear in (x, y, t) on a lot of tiles per frame; this turns that into an
 * integer index and an array read.
 */
const SIN_LUT = new Float32Array(256)
for (let i = 0; i < 256; i++) SIN_LUT[i] = Math.sin((i / 256) * Math.PI * 2)
const SIN_SCALE = 256 / (Math.PI * 2)
function fastSin(a: number): number {
  return SIN_LUT[(a * SIN_SCALE) & 255]
}

/**
 * The screen origin, snapped to a whole device pixel.
 *
 * This matters more than it looks. The camera tracks a float position moving
 * at eight tiles a second, so without snapping every drawImage lands on a
 * fractional pixel and nearest-neighbour rounding flips tile by tile as you
 * walk — the entire terrain field quietly boils. Snapping the ORIGIN (not the
 * camera) also handles odd canvas widths, where viewW/2 is itself fractional.
 */
export function originFor(cam: Camera, viewW: number, viewH: number) {
  return {
    ox: Math.round(viewW / 2 - cam.x * TILE_PX),
    oy: Math.round(viewH / 2 - cam.y * TILE_PX),
  }
}

export function renderWorld(
  rc: RenderCtx,
  cam: Camera,
  map: GameMap,
  fog: Fog,
  villages: Village[],
  explorer: Explorer,
  ships: { x: number; y: number; facing?: number }[],
  activeShip: number,
  sailing: boolean,
  outposts: Outpost[],
  art: WorldArt,
): void {
  const { ctx, zoom, tileset } = rc

  const viewW = rc.viewW / zoom
  const viewH = rc.viewH / zoom
  const { ox, oy } = originFor(cam, viewW, viewH)
  const still = reduceMotion?.matches === true

  // the unexplored world is blank chart paper, not a void. The fill stays in
  // screen space; the pattern is shifted to the world origin so the grain
  // travels with the chart instead of sliding under it.
  ctx.imageSmoothingEnabled = false
  const paper = paperPattern(ctx, zoom)
  paper.setTransform(new DOMMatrix([1, 0, 0, 1, ox * zoom, oy * zoom]))
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, rc.viewW, rc.viewH)

  ctx.save()
  ctx.scale(zoom, zoom)
  ctx.imageSmoothingEnabled = false

  const cols = Math.ceil(viewW / TILE_PX) + 2
  const rows = Math.ceil(viewH / TILE_PX) + 2
  const startX = Math.floor(cam.x - cols / 2)
  const startY = Math.floor(cam.y - rows / 2)

  const now = performance.now()
  const t = now / 1000
  const W = map.width
  const H = map.height
  const tiles = map.tiles
  const { base } = art.relief
  const { edges, edgeKeys, deckles } = art

  const landAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false
    const tl = tiles[y * W + x]
    return tl !== TILE.OCEAN && tl !== TILE.RIVER
  }
  const at = (x: number, y: number, fallback: number) =>
    x < 0 || y < 0 || x >= W || y >= H ? fallback : tiles[y * W + x]
  // out of bounds counts as unexplored, so the map border deckles too. The
  // bounds check must come first: isSeen does not range-check, and a negative
  // x would silently read the previous row.
  const unseen = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || !isSeen(fog, x, y)

  const R2 = VIEW_RADIUS * VIEW_RADIUS

  for (let ty = startY; ty < startY + rows; ty++) {
    for (let tx = startX; tx < startX + cols; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue
      if (!isSeen(fog, tx, ty)) continue // paper already covers it
      const i = ty * W + tx
      const sx = ox + tx * TILE_PX
      const sy = oy + ty * TILE_PX
      const tl = tiles[i]
      const frames = tileset.get(tl)!
      const nPhase = PHASES[tl] ?? 1
      let phase = 0
      if (still) {
        // reduced motion: a fixed frame per tile, keeping the variety of the
        // per-tile hash without the shimmer
        if (tl === TILE.OCEAN || tl === TILE.RIVER) phase = tileHash(tx, ty) % nPhase
      } else if (tl === TILE.OCEAN || tl === TILE.RIVER) {
        // keep the per-tile hash: it is what stops the whole sea moving in
        // lockstep. Without it the ocean marches in vertical stripes.
        phase = (tileHash(tx, ty) + Math.floor(now / 450 + tx * 0.7)) % nPhase
      } else if (nPhase > 1) {
        // one wind wave rolling diagonally across the continent
        const s = fastSin(t * 0.9 + (tx + ty) * 0.35)
        phase = s > 0.33 ? 2 : s < -0.33 ? 1 : 0
      }
      ctx.drawImage(frames[base[i] + phase * (SHADES[tl] ?? 1)], sx, sy)

      // dithered fringe where a higher-ranked terrain bleeds in
      const ek = edgeKeys[i]
      if (ek) {
        const ov = edges.get(ek)
        if (ov) ctx.drawImage(ov, sx, sy)
      }

      if (tl === TILE.OCEAN) {
        // rolling surf: the band swells and brightens on the crest, but never
        // thins below 2px — the foam stripe is how landfall is read at 2x.
        const n = landAt(tx, ty - 1)
        const e = landAt(tx + 1, ty)
        const s = landAt(tx, ty + 1)
        const w = landAt(tx - 1, ty)
        if (n || e || s || w) {
          // slaved to the same clock and per-column offset as the water
          // shimmer; a second rhythm on the same tiles reads as noise.
          const crest = fastSin((still ? 0 : now / 450) + tx * 0.7)
          const band = crest > 0.35 ? 3 : 2
          ctx.fillStyle = crest > 0.35 ? 'rgba(236,244,252,0.52)' : 'rgba(232,240,248,0.4)'
          if (n) ctx.fillRect(sx, sy, TILE_PX, band)
          if (s) ctx.fillRect(sx, sy + TILE_PX - band, TILE_PX, band)
          if (w) ctx.fillRect(sx, sy, band, TILE_PX)
          if (e) ctx.fillRect(sx + TILE_PX - band, sy, band, TILE_PX)
          // spray where the sea hits rock — highland coast reads violent,
          // beach coast reads calm, so a landing beach is spottable at a glance
          const rock =
            (n && at(tx, ty - 1, 0) >= TILE.HIGHLAND) ||
            (e && at(tx + 1, ty, 0) >= TILE.HIGHLAND) ||
            (s && at(tx, ty + 1, 0) >= TILE.HIGHLAND) ||
            (w && at(tx - 1, ty, 0) >= TILE.HIGHLAND)
          if (rock && crest > 0.1) {
            ctx.fillStyle = '#ffffff'
            const hsh = tileHash(tx, ty)
            for (let d = 0; d < 3; d++) {
              const px = sx + ((hsh >> (d * 3)) % TILE_PX)
              const py = sy + ((hsh >> (d * 3 + 5)) % TILE_PX)
              // mix the wave phase in, or a straight cliff shows identical
              // droplets in lockstep and reads as a bug
              ctx.fillRect(px, py - Math.round(crest * 2), 1, 1)
            }
          }
        }
      } else if (tl !== TILE.RIVER && !ek) {
        // the cartographic ink line, kept where no fringe was drawn
        ctx.fillStyle = 'rgba(10,14,10,0.16)'
        const e = at(tx + 1, ty, tl)
        const so = at(tx, ty + 1, tl)
        if (e !== tl && e !== TILE.OCEAN && e !== TILE.RIVER) ctx.fillRect(sx + TILE_PX - 1, sy, 1, TILE_PX)
        if (so !== tl && so !== TILE.OCEAN && so !== TILE.RIVER) ctx.fillRect(sx, sy + TILE_PX - 1, TILE_PX, 1)
      }

      // torn edge where charted country meets blank paper
      let dm = 0
      if (unseen(tx, ty - 1)) dm |= 1
      if (unseen(tx + 1, ty)) dm |= 2
      if (unseen(tx, ty + 1)) dm |= 4
      if (unseen(tx - 1, ty)) dm |= 8
      if (dm) {
        const d = deckles.get(dm * 2 + (tileHash(tx, ty) & 1))
        if (d) ctx.drawImage(d, sx, sy)
      }

      // Charted but out of sight: dried ink on the same sheet. One wash, kept
      // light — it stacks on top of the depth bands, and at full strength the
      // two together quilt the open sea into blotches.
      const dx = tx + 0.5 - explorer.x
      const dy = ty + 0.5 - explorer.y
      if (dx * dx + dy * dy > R2) {
        ctx.fillStyle = 'rgba(44,36,24,0.28)'
        ctx.fillRect(sx, sy, TILE_PX, TILE_PX)
      }
    }
  }

  // entities snap to whole device pixels too — a fractional destination makes
  // nearest-neighbour drop or double source rows, so the figure deforms as it
  // walks. A rock-solid world under a shimmering explorer looks detached.
  const snap = (v: number) => Math.round(v * zoom) / zoom
  const ex = (wx: number) => snap(ox + wx * TILE_PX)
  const ey = (wy: number) => snap(oy + wy * TILE_PX)

  for (const v of villages) {
    if (!isSeen(fog, v.x, v.y)) continue
    const sx = ex(v.x + 0.5)
    const sy = ey(v.y + 0.5)
    ctx.globalAlpha = v.depleted ? 0.55 : 1
    drawShadow(ctx, sx + 1, sy + TILE_PX * 0.32 + 1, TILE_PX * 0.46)
    drawVillage(ctx, sx, sy, v.golden, v.visited, v.depleted || still ? -1 : t + (v.x * 7 + v.y) * 0.61)
    ctx.globalAlpha = 1
  }

  for (const o of outposts) {
    if (!isSeen(fog, Math.floor(o.x), Math.floor(o.y))) continue
    const sx = ex(o.x + 0.5)
    const sy = ey(o.y + 0.5)
    drawShadow(ctx, sx + 1, sy + TILE_PX * 0.3 + 1, TILE_PX * 0.45)
    drawFort(ctx, sx, sy, still ? -1 : t + o.x * 0.37)
  }

  ships.forEach((sh, i) => {
    if (sailing && i === activeShip) return // the flagship is under you
    if (!isSeen(fog, Math.floor(sh.x), Math.floor(sh.y))) return
    drawShipSprite(ctx, art.sprites, ex(sh.x), ey(sh.y) + TILE_PX * 0.3, sh.facing, still ? -1 : t + i * 1.3)
  })

  const psx = ex(explorer.x)
  const psy = ey(explorer.y)
  const underfoot = tiles[Math.floor(explorer.y) * W + Math.floor(explorer.x)]
  if (sailing) {
    // While sailing the explorer IS the helm: moveShip writes facing onto the
    // explorer, and only x/y are copied back to the moored fleet. Reading the
    // ship's own facing here would show it frozen at its mooring heading.
    drawShipSprite(ctx, art.sprites, psx, psy + TILE_PX * 0.3, explorer.facing, still ? -1 : t)
  } else if (underfoot === TILE.RIVER) {
    drawShadow(ctx, psx + 1, psy + TILE_PX * 0.34 + 1, TILE_PX * 0.34)
    drawCanoe(ctx, psx, psy)
  } else {
    drawExplorerSprite(ctx, art.sprites, psx, psy + TILE_PX * 0.42, explorer.facing, explorer.moving ? explorer.gait : 0)
  }

  ctx.restore()
}

/** Roaming storm cells: a dark squall with animated rain, once its waters are charted. */
export function renderStorms(
  rc: RenderCtx,
  cam: Camera,
  weather: Weather,
  t: number,
  map: GameMap,
  fog: Fog,
): void {
  const { ctx, zoom } = rc
  ctx.save()
  ctx.scale(zoom, zoom)
  const viewW = rc.viewW / zoom
  const viewH = rc.viewH / zoom
  const { ox, oy } = originFor(cam, viewW, viewH)
  for (const s of weather.storms) {
    const c = stormCenter(s, t, map.width, map.height)
    const cx = Math.max(0, Math.min(map.width - 1, Math.floor(c.x)))
    const cy = Math.max(0, Math.min(map.height - 1, Math.floor(c.y)))
    if (!isSeen(fog, cx, cy)) continue
    const px = ox + c.x * TILE_PX
    const py = oy + c.y * TILE_PX
    const rp = s.r * TILE_PX
    if (px < -rp || py < -rp || px > viewW + rp || py > viewH + rp) continue
    const grad = ctx.createRadialGradient(px, py, rp * 0.2, px, py, rp)
    grad.addColorStop(0, 'rgba(16,20,38,0.55)')
    grad.addColorStop(1, 'rgba(16,20,38,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(px, py, rp, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(210,222,240,0.35)'
    ctx.lineWidth = 1
    const anim = reduceMotion?.matches === true ? 0 : (performance.now() / 60) % TILE_PX
    ctx.beginPath()
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const rr = rp * (0.25 + ((i * 37) % 60) / 100)
      const x = px + Math.cos(a) * rr
      const y = py + Math.sin(a) * rr + anim
      ctx.moveTo(x, y)
      ctx.lineTo(x - 3, y + 6)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// --- minimap -------------------------------------------------------------

/**
 * The charted terrain layer, redrawn only when meaningfully more of the world
 * has been revealed. Rebuilding it every frame cost nine thousand fillRects.
 */
let miniCache: { canvas: HTMLCanvasElement; revealed: number; seed: number } | null = null

const MINI_SIZE = 120

export function miniColor(t: number, band: number, hill: number): string {
  if (t === TILE.OCEAN) return DEPTH_RAMP[band]
  if (t === TILE.RIVER) return '#3a7ac0'
  if (t === TILE.BEACH) return '#d8c88a'
  if (t === TILE.MOUNTAIN) return hill >= 2 ? '#8a8a8a' : hill === 1 ? '#6d6d6d' : '#4e4e4e'
  if (t === TILE.HIGHLAND) return hill >= 2 ? '#9a8a62' : '#7a6c48'
  if (t === TILE.DESERT) return '#c9a850'
  if (t === TILE.JUNGLE) return '#1f5230'
  if (t === TILE.FOREST) return '#2f6b2a'
  return '#3f6b34'
}

function buildMini(map: GameMap, fog: Fog, relief: Relief): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = MINI_SIZE
  c.height = MINI_SIZE
  const g = c.getContext('2d')!
  const scale = MINI_SIZE / map.width
  const step = 2
  for (let y = 0; y < map.height; y += step) {
    for (let x = 0; x < map.width; x += step) {
      if (!isSeen(fog, x, y)) continue
      const i = y * map.width + x
      g.fillStyle = miniColor(map.tiles[i], relief.depth[i], relief.hill[i])
      g.fillRect(x * scale, y * scale, step * scale + 0.5, step * scale + 0.5)
    }
  }
  return c
}

/** Small charted-territory chart in the corner, with the current view marked. */
export function renderMinimap(
  rc: RenderCtx,
  map: GameMap,
  fog: Fog,
  explorer: Explorer,
  villages: Village[],
  ships: { x: number; y: number }[],
  outposts: Outpost[],
  top: number,
  cam: Camera,
  relief: Relief,
): void {
  const { ctx, viewW } = rc
  const size = MINI_SIZE
  const px = viewW - size - 12
  const py = top
  const scale = size / map.width

  // vellum ground, matching the chart the world is drawn on
  ctx.fillStyle = '#221c13'
  ctx.fillRect(px - 2, py - 2, size + 4, size + 4)

  if (!miniCache || miniCache.seed !== map.seed || fog.revealedCount - miniCache.revealed > 256) {
    miniCache = { canvas: buildMini(map, fog, relief), revealed: fog.revealedCount, seed: map.seed }
  }
  ctx.drawImage(miniCache.canvas, px, py)

  ctx.strokeStyle = 'rgba(244,196,48,0.5)'
  ctx.lineWidth = 1
  ctx.strokeRect(px - 2.5, py - 2.5, size + 5, size + 5)

  // charted villages: gold squares for Cities of Gold, brown for the rest
  for (const v of villages) {
    if (!isSeen(fog, v.x, v.y)) continue
    ctx.fillStyle = v.golden ? '#f4c430' : v.depleted ? '#6a5138' : '#b07840'
    ctx.fillRect(px + v.x * scale - 1, py + v.y * scale - 1, 3, 3)
  }
  ctx.fillStyle = '#ff5555'
  ctx.fillRect(px + explorer.x * scale - 1, py + explorer.y * scale - 1, 3, 3)
  ctx.fillStyle = '#cfe6ff'
  for (const sh of ships) ctx.fillRect(px + sh.x * scale - 1, py + sh.y * scale - 1, 3, 3)
  ctx.fillStyle = '#e8d8a0'
  for (const o of outposts) ctx.fillRect(px + o.x * scale - 1, py + o.y * scale - 1, 3, 3)

  const vwTiles = rc.viewW / (TILE_PX * rc.zoom)
  const vhTiles = rc.viewH / (TILE_PX * rc.zoom)
  ctx.strokeStyle = 'rgba(232,232,238,0.65)'
  ctx.lineWidth = 1
  ctx.strokeRect(
    px + (cam.x - vwTiles / 2) * scale,
    py + (cam.y - vhTiles / 2) * scale,
    vwTiles * scale,
    vhTiles * scale,
  )
  // clicking the minimap opens the full Cartographer's World Chart
  addHit('open-chart', px - 2, py - 2, size + 4, size + 4)
}

/** Drop the cached chart when a new world is generated. */
export function invalidateMinimap(): void {
  miniCache = null
}
