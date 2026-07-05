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

export function placeVillages(map: GameMap, count: number, minDist = 8): Village[] {
  const rng = makeRng(map.seed ^ 0x5bd1e995)
  const vs: Village[] = []
  let attempts = 0

  while (vs.length < count && attempts < count * 200) {
    attempts++
    const x = Math.floor(rng() * map.width)
    const y = Math.floor(rng() * map.height)
    const t = map.tiles[y * map.width + x]
    if (!isWalkable(t) || t === TILE.BEACH) continue
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
