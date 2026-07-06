import { makeNoise2D } from './noise'
import { TILE, isWalkable } from './tiles'

export interface GameMap {
  width: number
  height: number
  tiles: Uint8Array
  landing: { x: number; y: number }
  seed: number
}

export function generateMap(seed: number, width = 192, height = 192): GameMap {
  const elev = makeNoise2D(seed, 12)
  const moist = makeNoise2D(seed ^ 0x9e3779b9, 10)
  const tiles = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width,
        ny = y / height
      // radial-ish falloff keeps the continent off the map borders
      const edge = Math.min(nx, ny, 1 - nx, 1 - ny)
      let e = elev(x, y) * 0.85 + edge * 0.6 - 0.15
      // push the west margin firmly into ocean so there's a coastline to land on
      if (nx < 0.12) e -= (0.12 - nx) * 3
      tiles[y * width + x] = classify(e, moist(x, y))
    }
  }

  const landing = findLanding(tiles, width, height)
  return { width, height, tiles, landing, seed }
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
