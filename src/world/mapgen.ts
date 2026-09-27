import { makeNoise2D } from './noise'
import { makeRng } from './rng'
import { TILE, isWalkable } from './tiles'

export interface GameMap {
  width: number
  height: number
  tiles: Uint8Array
  landing: { x: number; y: number }
  seed: number
  /** Raw height field the terrain was classified from; drives relief shading. */
  elevation: Float32Array
}

export function generateMap(seed: number, width = 192, height = 192): GameMap {
  // The New World in the original's image: one tall continent spanning the
  // map north-south, a wandering mountain cordillera down its spine, and an
  // arc of islands off the arrival coast — a Caribbean between the Atlantic
  // (the far west, where Spain lies) and the mainland.
  const elev = makeNoise2D(seed, 12)
  const moist = makeNoise2D(seed ^ 0x9e3779b9, 10)
  const islandNoise = makeNoise2D(seed ^ 0x77777777, 6)
  const spineNoise = makeNoise2D(seed ^ 0x13571357, 48)
  const tiles = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width,
        ny = y / height
      // continent mask: a tall band centered east of middle, thinning at the poles
      const bandDx = (nx - 0.6) / 0.3
      let mask = Math.max(0, 1 - bandDx * bandDx)
      const polar = Math.min(ny, 1 - ny)
      if (polar < 0.05) mask *= polar / 0.05
      let e = elev(x, y) * 0.5 + mask * 0.42 - 0.1
      // the cordillera: a ridge wandering north-south through the interior
      const ridgeX = 0.66 + (spineNoise(0, y) - 0.5) * 0.18
      const rd = (nx - ridgeX) / 0.05
      e += Math.exp(-rd * rd) * 0.32 * Math.min(1, mask * 3)
      // island arc between the Atlantic and the coast
      if (nx > 0.1 && nx < 0.32) e += Math.max(0, islandNoise(x, y) - 0.62) * 1.1
      // the far west is the open Atlantic — the road home to Spain
      if (nx < 0.08) e -= (0.08 - nx) * 4
      elevation[y * width + x] = e
      tiles[y * width + x] = classify(e, moist(x, y))
    }
  }

  carveRivers(seed, tiles, elevation, width, height)

  const landing = findLanding(tiles, width, height)
  return { width, height, tiles, landing, seed, elevation }
}

/**
 * Rivers rise in the highlands and run downhill to the sea, joining any
 * river they meet. They are canoe routes: fast inland highways for the
 * expedition (and a course only carved if it actually reaches water).
 */
function carveRivers(
  seed: number,
  tiles: Uint8Array,
  elevation: Float32Array,
  w: number,
  h: number,
  count = 9,
): void {
  const rng = makeRng(seed ^ 0x27d4eb2f)
  let carved = 0
  let attempts = 0

  while (carved < count && attempts < count * 60) {
    attempts++
    const sx = Math.floor(rng() * w)
    const sy = Math.floor(rng() * h)
    const si = sy * w + sx
    if (tiles[si] === TILE.OCEAN || tiles[si] === TILE.RIVER || tiles[si] === TILE.MOUNTAIN) continue
    if (elevation[si] < 0.6) continue // sources rise in the highlands

    // descend: always step to the lowest neighbor not already in the course
    let cx = sx
    let cy = sy
    const course: number[] = []
    let reachedWater = false
    for (let steps = 0; steps < 400; steps++) {
      const ci = cy * w + cx
      if (tiles[ci] === TILE.OCEAN || tiles[ci] === TILE.RIVER) {
        reachedWater = true
        break
      }
      course.push(ci)
      let best = -1
      let bestE = Infinity
      for (const [nx, ny] of [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const ni = ny * w + nx
        if (course.includes(ni)) continue
        if (elevation[ni] < bestE) {
          bestE = elevation[ni]
          best = ni
        }
      }
      if (best === -1) break
      cx = best % w
      cy = (best / w) | 0
    }

    if (reachedWater && course.length >= 6) {
      for (const ci of course) {
        if (tiles[ci] !== TILE.MOUNTAIN) tiles[ci] = TILE.RIVER
      }
      carved++
    }
  }
}

function classify(e: number, m: number): number {
  if (e < 0.3) return TILE.OCEAN
  if (e < 0.34) return TILE.BEACH
  if (e > 0.8) return TILE.MOUNTAIN
  if (e > 0.68) return TILE.HIGHLAND
  if (m < 0.3) return TILE.DESERT
  if (m > 0.72) return TILE.JUNGLE
  if (m > 0.52) return TILE.FOREST
  return TILE.GRASS
}

/**
 * Land on the LARGEST connected walkable landmass — never a tiny offshore
 * islet the expedition could be stranded on. Among the mainland's tiles,
 * pick the west-most, then most central, as the landfall beach.
 */
function findLanding(tiles: Uint8Array, w: number, h: number): { x: number; y: number } {
  const comp = new Int32Array(w * h).fill(-1)
  let bestComp = -1
  let bestSize = 0
  let nComps = 0

  for (let i = 0; i < w * h; i++) {
    if (comp[i] !== -1 || !isWalkable(tiles[i])) continue
    const queue = [i]
    comp[i] = nComps
    let size = 0
    for (let qi = 0; qi < queue.length; qi++) {
      const j = queue[qi]
      size++
      const x = j % w
      const y = (j / w) | 0
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const k = ny * w + nx
        if (comp[k] === -1 && isWalkable(tiles[k])) {
          comp[k] = nComps
          queue.push(k)
        }
      }
    }
    if (size > bestSize) {
      bestSize = size
      bestComp = nComps
    }
    nComps++
  }

  let pick = -1
  let pickKey = Infinity
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (comp[i] !== bestComp) continue
      const key = x * 1000 + Math.abs(y - h / 2) // west-most first, then central
      if (key < pickKey) {
        pickKey = key
        pick = i
      }
    }
  }
  if (pick === -1) return { x: Math.floor(w / 2), y: Math.floor(h / 2) }
  return { x: pick % w, y: (pick / w) | 0 }
}
