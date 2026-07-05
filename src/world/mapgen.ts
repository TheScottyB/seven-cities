import { makeNoise2D } from './noise'
import { TILE } from './tiles'

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

/** Scan outward from the vertical centre for the first coastal land tile. */
function findLanding(tiles: Uint8Array, w: number, h: number): { x: number; y: number } {
  const cy = Math.floor(h / 2)
  for (let dy = 0; dy < h; dy++) {
    for (const y of [cy - dy, cy + dy]) {
      if (y < 0 || y >= h) continue
      for (let x = 0; x < w; x++) {
        const t = tiles[y * w + x]
        if (t === TILE.BEACH || t === TILE.GRASS) return { x, y }
      }
    }
  }
  return { x: Math.floor(w / 2), y: cy }
}
