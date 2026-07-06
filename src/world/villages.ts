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
 * Flood-fill of tiles walkable from the landing point (4-connected — the
 * axis-sliding movement can't squeeze through diagonal gaps). Villages are
 * only placed on this set so no City of Gold is ever stranded across water.
 */
export function reachableFromLanding(map: GameMap): Uint8Array {
  const { width: w, height: h, tiles, landing } = map
  const seen = new Uint8Array(w * h)
  const start = landing.y * w + landing.x
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
      const j = ny * w + nx
      if (seen[j] || !isWalkable(tiles[j])) continue
      seen[j] = 1
      queue.push(j)
    }
  }
  return seen
}

export function placeVillages(map: GameMap, count: number, minDist = 8): Village[] {
  const rng = makeRng(map.seed ^ 0x5bd1e995)
  const reachable = reachableFromLanding(map)
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
