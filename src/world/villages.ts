import { GameMap } from './mapgen'
import { isWalkable, TILE } from './tiles'
import { makeRng } from './rng'

export interface Village {
  x: number
  y: number
  wealth: number
  /** 0 = hostile … 1 = friendly */
  temperament: number
  population: number
  golden: boolean
  visited: boolean
  depleted: boolean
}

/**
 * Tiles the expedition can actually reach with its ONE ship (4-connected).
 * You may walk any walkable land and sail only the ship's own sea — the
 * ocean component beside the landing where the caravel moors. Land and that
 * sea interchange freely at any coast (board / step ashore), but the ship
 * can never portage into a separate basin, so other ocean components are
 * off-limits. Villages are placed on this set: islands in the home sea are
 * fair game, but nothing hides behind water the ship cannot enter.
 */
export function reachableAmphibious(map: GameMap): Uint8Array {
  const { width: w, height: h, tiles, landing } = map
  const idx = (x: number, y: number) => y * w + x

  // flood the ship's sea from the ocean tile nearest the landing (the mooring)
  const mainSea = new Uint8Array(w * h)
  let mooring = -1
  outer: for (let r = 1; r < 24; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = landing.x + dx
        const y = landing.y + dy
        if (x < 0 || y < 0 || x >= w || y >= h) continue
        if (tiles[idx(x, y)] === TILE.OCEAN) {
          mooring = idx(x, y)
          break outer
        }
      }
    }
  }
  if (mooring !== -1) {
    const q = [mooring]
    mainSea[mooring] = 1
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi]
      const x = i % w
      const y = (i / w) | 0
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = idx(nx, ny)
        if (!mainSea[j] && tiles[j] === TILE.OCEAN) {
          mainSea[j] = 1
          q.push(j)
        }
      }
    }
  }

  const passable = (i: number) => isWalkable(tiles[i]) || mainSea[i] === 1
  const seen = new Uint8Array(w * h)
  const start = idx(landing.x, landing.y)
  const queue = [start]
  seen[start] = 1
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi]
    const x = i % w
    const y = (i / w) | 0
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = idx(nx, ny)
      if (seen[j] || !passable(j)) continue
      seen[j] = 1
      queue.push(j)
    }
  }
  return seen
}

export function placeVillages(map: GameMap, count: number, minDist = 8): Village[] {
  const rng = makeRng(map.seed ^ 0x5bd1e995)
  const reachable = reachableAmphibious(map)
  const vs: Village[] = []
  let attempts = 0

  while (vs.length < count && attempts < count * 200) {
    attempts++
    const x = Math.floor(rng() * map.width)
    const y = Math.floor(rng() * map.height)
    const t = map.tiles[y * map.width + x]
    if (!isWalkable(t) || t === TILE.BEACH) continue
    if (!reachable[y * map.width + x]) continue
    if (nearCoast(map, x, y)) continue
    if (vs.some((v) => Math.hypot(v.x - x, v.y - y) < minDist)) continue
    vs.push({
      x,
      y,
      wealth: Math.floor(rng() * 400) + 50,
      temperament: rng(),
      population: Math.floor(rng() * 300) + 50,
      golden: false,
      visited: false,
      depleted: false,
    })
  }

  // the seven wealthiest settlements become the fabled Cities of Gold
  vs.slice()
    .sort((a, b) => b.wealth - a.wealth)
    .slice(0, 7)
    .forEach((v) => {
      v.golden = true
      v.wealth += 500
    })

  return vs
}

/** The closest City of Gold the player has not yet reached — used for rumors. */
export function nearestUnvisitedGolden(vs: Village[], x: number, y: number): Village | null {
  let best: Village | null = null
  let bestD = Infinity
  for (const v of vs) {
    if (!v.golden || v.visited) continue
    const d = Math.hypot(v.x - x, v.y - y)
    if (d < bestD) {
      bestD = d
      best = v
    }
  }
  return best
}

function nearCoast(map: GameMap, x: number, y: number): boolean {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx,
        yy = y + dy
      if (xx < 0 || yy < 0 || xx >= map.width || yy >= map.height) continue
      if (map.tiles[yy * map.width + xx] === TILE.OCEAN) return true
    }
  }
  return false
}
