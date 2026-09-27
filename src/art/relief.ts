/**
 * Everything that varies per tile POSITION, computed once when a world is
 * built. Pure arithmetic over typed arrays — no canvas, no DOM — so it is
 * unit-testable and costs the per-frame draw loop nothing but an array read.
 *
 * The renderer never asks "how deep is this water" or "which way does this
 * slope face" while drawing. It asks once, here, and remembers.
 */
import { TILE } from '../world/tiles'
import type { GameMap } from '../world/mapgen'

/** How far offshore the depth ramp keeps counting before it is all abyss. */
const MAX_DEPTH = 12

/**
 * Levels on each terrain's shade axis. For water this is depth (carried as
 * HUE, so it survives the parchment wash); for the cordillera it is
 * hillshade (carried as luminance). Everything else is unshaded — darkening
 * grass would make it read as forest, and grass-vs-forest is a walking-speed
 * decision the player makes every step.
 */
export const SHADES: Record<number, number> = {
  [TILE.OCEAN]: 4,
  [TILE.HIGHLAND]: 3,
  [TILE.MOUNTAIN]: 3,
  [TILE.RIVER]: 1,
  [TILE.BEACH]: 1,
  [TILE.GRASS]: 1,
  [TILE.FOREST]: 1,
  [TILE.JUNGLE]: 1,
  [TILE.DESERT]: 1,
}

/** Animated frames per terrain: water shimmers, foliage leans in the wind. */
export const PHASES: Record<number, number> = {
  [TILE.OCEAN]: 4,
  [TILE.RIVER]: 4,
  [TILE.FOREST]: 3,
  [TILE.JUNGLE]: 3,
  [TILE.BEACH]: 1,
  [TILE.GRASS]: 1,
  [TILE.DESERT]: 1,
  [TILE.HIGHLAND]: 1,
  [TILE.MOUNTAIN]: 1,
}

/** How many dressings each terrain can wear. Impassable ground stays uniform. */
export const DECORS: Record<number, number> = {
  [TILE.OCEAN]: 1,
  [TILE.RIVER]: 1,
  [TILE.BEACH]: 4,
  [TILE.GRASS]: 4,
  [TILE.FOREST]: 4,
  [TILE.JUNGLE]: 4,
  [TILE.DESERT]: 4,
  [TILE.HIGHLAND]: 4,
  [TILE.MOUNTAIN]: 2,
}

/** Frames in one terrain's slice of the atlas. */
export function framesFor(t: number): number {
  return (DECORS[t] ?? 1) * (PHASES[t] ?? 1) * (SHADES[t] ?? 1)
}

/** Where a given (decor, phase, shade) lands inside a terrain's slice. */
export function tileIndex(t: number, decor: number, phase: number, shade: number): number {
  return (decor * (PHASES[t] ?? 1) + phase) * (SHADES[t] ?? 1) + shade
}

/**
 * Distance-to-shore for every ocean tile, bucketed into four bands.
 * A multi-source BFS seeded from every piece of land at once — each cell is
 * enqueued exactly once, so the queue can be a fixed Int32Array.
 *
 * Four bands, not five: discrete steps read as a nautical chart, where a
 * smooth gradient reads as a photograph.
 */
export function buildDepthBands(map: GameMap): Uint8Array {
  const { width: w, height: h, tiles } = map
  const n = w * h
  const dist = new Int16Array(n).fill(-1)
  const q = new Int32Array(n)
  let head = 0
  let tail = 0
  for (let i = 0; i < n; i++) {
    if (tiles[i] !== TILE.OCEAN) {
      dist[i] = 0
      q[tail++] = i
    }
  }
  while (head < tail) {
    const i = q[head++]
    const d = dist[i]
    if (d >= MAX_DEPTH) continue
    const x = i % w
    const y = (i / w) | 0
    if (x > 0 && dist[i - 1] < 0) { dist[i - 1] = d + 1; q[tail++] = i - 1 }
    if (x < w - 1 && dist[i + 1] < 0) { dist[i + 1] = d + 1; q[tail++] = i + 1 }
    if (y > 0 && dist[i - w] < 0) { dist[i - w] = d + 1; q[tail++] = i - w }
    if (y < h - 1 && dist[i + w] < 0) { dist[i + w] = d + 1; q[tail++] = i + w }
  }
  const band = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (tiles[i] !== TILE.OCEAN) continue
    const d = dist[i] < 0 ? MAX_DEPTH : dist[i]
    // The deepest band starts far out, so open ocean reads as one uniform
    // field. Bands that change every few tiles quilt the sea into patches.
    band[i] = d <= 1 ? 0 : d <= 4 ? 1 : d <= 9 ? 2 : 3
  }
  return band
}

/** How hard the slope has to lean before it reads as lit or shadowed. */
const SLOPE_GAIN = 9

/**
 * Northwest-lit relief for the cordillera. The sun never swings: a relief map
 * that re-lights itself is unstable ground, and the range must look identical
 * every time the player glances at it.
 */
export function buildHillshade(map: GameMap): Uint8Array {
  const { width: w, height: h, tiles } = map
  const n = w * h
  const out = new Uint8Array(n)
  const e = map.elevation
  // Blur before differencing. The noise runs four octaves up to frequency 8
  // over a grid of 12, so its top octave has roughly a 1.5-tile period — a raw
  // central difference would alias that into speckle instead of slope.
  const s = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0
      let cnt = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          acc += e[yy * w + xx]
          cnt++
        }
      }
      s[y * w + x] = acc / cnt
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const t = tiles[i]
      if (t !== TILE.HIGHLAND && t !== TILE.MOUNTAIN) continue
      const gx = ((x < w - 1 ? s[i + 1] : s[i]) - (x > 0 ? s[i - 1] : s[i])) * 0.5
      const gy = ((y < h - 1 ? s[i + w] : s[i]) - (y > 0 ? s[i - w] : s[i])) * 0.5
      // ground falling away to the southeast catches the northwest sun
      const lum = Math.max(-1, Math.min(1, -(gx + gy) * SLOPE_GAIN))
      out[i] = Math.round((lum + 1) * 0.5 * 2)
    }
  }
  return out
}

/**
 * Which dressing each tile wears. Density is biased by elevation, so lush
 * cluttered lowland grades into bare upland — a whole-screen composition
 * change rather than a texture change. Slot 0 is always bare ground.
 */
export function buildDecorMap(map: GameMap): Uint8Array {
  const { width: w, height: h, tiles } = map
  const n = w * h
  const out = new Uint8Array(n)
  const e = map.elevation
  for (let i = 0; i < n; i++) {
    const t = tiles[i]
    const count = DECORS[t] ?? 1
    if (count <= 1) continue
    const x = i % w
    const y = (i / w) | 0
    const hash = ((x * 73856093) ^ (y * 19349663) ^ 0x5bf03635) >>> 0
    // lush at the shoreline, bare by the time the ground reaches highland
    const lush = Math.max(0, Math.min(1, 1 - (e[i] - 0.34) / 0.34))
    const roll = (hash % 1000) / 1000
    out[i] = roll < 0.3 + lush * 0.45 ? 1 + ((hash >>> 10) % (count - 1)) : 0
  }
  return out
}

/**
 * One flat base index per tile, folding decor and the shade axis together so
 * the draw loop does a single array read plus one add for the animated phase.
 */
export function buildTileBase(map: GameMap, depth: Uint8Array, hill: Uint8Array, decor: Uint8Array): Uint16Array {
  const n = map.width * map.height
  const out = new Uint16Array(n)
  for (let i = 0; i < n; i++) {
    const t = map.tiles[i]
    const shade = t === TILE.OCEAN ? depth[i] : t === TILE.HIGHLAND || t === TILE.MOUNTAIN ? hill[i] : 0
    // phase is added per frame; this is the index at phase 0
    out[i] = decor[i] * (PHASES[t] ?? 1) * (SHADES[t] ?? 1) + shade
  }
  return out
}

export interface Relief {
  depth: Uint8Array
  hill: Uint8Array
  decor: Uint8Array
  /** tile atlas index at phase 0 */
  base: Uint16Array
}

export function buildRelief(map: GameMap): Relief {
  const depth = buildDepthBands(map)
  const hill = buildHillshade(map)
  const decor = buildDecorMap(map)
  return { depth, hill, decor, base: buildTileBase(map, depth, hill, decor) }
}
