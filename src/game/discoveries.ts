/**
 * 1984-style geographic landmark discoveries: major peaks, rivers, capes, bays
 * and islands derived deterministically from the generated map. Charting them
 * awards Royal Fame (+DISCOVERY_BONUS score each) and fills the World Chart.
 * Pure, DOM-free logic — unit-testable in Node.
 */
import type { GameMap } from '../world/mapgen'
import { makeRng } from '../world/rng'
import { TILE, isWalkable } from '../world/tiles'

export type LandmarkKind = 'peak' | 'river' | 'cape' | 'bay' | 'island'

export interface Landmark {
  readonly id: number
  readonly kind: LandmarkKind
  readonly name: string
  readonly x: number
  readonly y: number
}

/** Distance (in tiles) at which the explorer charts a landmark. */
export const DISCOVERY_RADIUS = 6

/** Fame score awarded for each charted geographic landmark. */
export const DISCOVERY_BONUS = 50

const NAMES = {
  peak: [
    'Mt. Slightly-Gilded',
    'Peak of the Six-Seven Winds',
    'Cordillera of Questionable Karat',
    'Mount Mild Peril',
  ],
  river: [
    'Rio de los Coconut Shells',
    'River of Suspiciously Shiny Silt',
    'Rio del Ni',
    'Stream of Certified Brass',
  ],
  cape: [
    'Cape Six-Seven',
    'Point Wet Kipper',
    'Promontory of the Shrubbery',
  ],
  bay: [
    'Bay of Mostly Gold-Tone',
    'Cove of Silly Walks',
    'Harbor of Mild Peril',
  ],
  island: [
    'Isle of Foolish Alloy',
    'Cayo 6-7',
    'Atoll of the Ex-Parrot',
  ],
} as const satisfies Record<LandmarkKind, readonly string[]>

const MIN_SPACING = 18

/**
 * Derive 5–7 well-spaced, deterministic geographic landmarks from `map`.
 * Same map seed always yields the exact same landmark ids, kinds, names and positions.
 */
export function findLandmarks(map: GameMap): Landmark[] {
  const { width: w, height: h, tiles, elevation } = map
  const rng = makeRng(map.seed ^ 0x67671492)
  const usedNames = new Set<string>()
  const picked: Landmark[] = []

  const farEnough = (x: number, y: number) =>
    picked.every((l) => Math.hypot(l.x - x, l.y - y) >= MIN_SPACING)

  const pickName = (kind: LandmarkKind): string => {
    const pool = NAMES[kind]
    const start = Math.floor(rng() * pool.length)
    for (let k = 0; k < pool.length; k++) {
      const candidate = pool[(start + k) % pool.length]
      if (!usedNames.has(candidate)) {
        usedNames.add(candidate)
        return candidate
      }
    }
    return `${pool[0]} ${picked.length + 1}`
  }

  const add = (kind: LandmarkKind, x: number, y: number) => {
    if (!farEnough(x, y)) return false
    picked.push({ id: picked.length, kind, name: pickName(kind), x, y })
    return true
  }

  // 1. Two highest peaks (north & south halves of the cordillera)
  for (const [yLo, yHi] of [[Math.floor(h * 0.1), Math.floor(h * 0.5)], [Math.floor(h * 0.5), Math.floor(h * 0.9)]] as const) {
    let bestI = -1
    let bestE = -Infinity
    for (let y = yLo; y < yHi; y++) {
      for (let x = 2; x < w - 2; x++) {
        const i = y * w + x
        if (tiles[i] !== TILE.MOUNTAIN && tiles[i] !== TILE.HIGHLAND) continue
        if (elevation[i] > bestE && farEnough(x, y)) {
          bestE = elevation[i]
          bestI = i
        }
      }
    }
    if (bestI >= 0) add('peak', bestI % w, (bestI / w) | 0)
  }

  // 2. Two river mouths / notable river reaches (river tile adjacent to ocean, or mid-river)
  const riverMouths: [number, number][] = []
  const riverTiles: [number, number][] = []
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (tiles[y * w + x] !== TILE.RIVER) continue
      riverTiles.push([x, y])
      if (
        tiles[y * w + x - 1] === TILE.OCEAN ||
        tiles[y * w + x + 1] === TILE.OCEAN ||
        tiles[(y - 1) * w + x] === TILE.OCEAN ||
        tiles[(y + 1) * w + x] === TILE.OCEAN
      ) {
        riverMouths.push([x, y])
      }
    }
  }
  const riverPool = riverMouths.length >= 2 ? riverMouths : riverTiles
  let riversAdded = 0
  for (let i = 0; i < riverPool.length && riversAdded < 2; i++) {
    const idx = Math.floor(((i + 0.5) / Math.min(riverPool.length, 6)) * riverPool.length) % riverPool.length
    const [rx, ry] = riverPool[idx]
    if (add('river', rx, ry)) riversAdded++
  }

  // 3. A western cape (land tile jutting farthest west, away from landing)
  let cape: [number, number] | null = null
  let capeScore = Infinity
  for (let y = Math.floor(h * 0.15); y < Math.floor(h * 0.85); y++) {
    for (let x = Math.floor(w * 0.25); x < Math.floor(w * 0.65); x++) {
      const i = y * w + x
      if (!isWalkable(tiles[i])) continue
      if (tiles[i - 1] !== TILE.OCEAN) continue
      if (Math.hypot(x - map.landing.x, y - map.landing.y) < 16) continue
      if (x < capeScore && farEnough(x, y)) {
        capeScore = x
        cape = [x, y]
      }
    }
  }
  if (cape) add('cape', cape[0], cape[1])

  // 4. An offshore island in the western island arc (nx in 0.10..0.34)
  let island: [number, number] | null = null
  let islandE = -Infinity
  for (let y = Math.floor(h * 0.12); y < Math.floor(h * 0.88); y++) {
    for (let x = Math.floor(w * 0.1); x < Math.floor(w * 0.34); x++) {
      const i = y * w + x
      if (!isWalkable(tiles[i])) continue
      if (elevation[i] > islandE && farEnough(x, y)) {
        islandE = elevation[i]
        island = [x, y]
      }
    }
  }
  if (island) add('island', island[0], island[1])

  // 5. A sheltered bay (ocean tile surrounded on at least 2 cardinal sides by land)
  let bay: [number, number] | null = null
  for (let y = Math.floor(h * 0.2); y < Math.floor(h * 0.8) && !bay; y += 2) {
    for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.7) && !bay; x += 2) {
      const i = y * w + x
      if (tiles[i] !== TILE.OCEAN) continue
      const landNeighbors =
        (tiles[i - 1] !== TILE.OCEAN ? 1 : 0) +
        (tiles[i + 1] !== TILE.OCEAN ? 1 : 0) +
        (tiles[i - w] !== TILE.OCEAN ? 1 : 0) +
        (tiles[i + w] !== TILE.OCEAN ? 1 : 0)
      if (landNeighbors >= 2 && farEnough(x, y)) bay = [x, y]
    }
  }
  if (bay) add('bay', bay[0], bay[1])

  return picked
}

/**
 * Mark any landmarks within `DISCOVERY_RADIUS` of `(x, y)` as discovered.
 * Returns the newly charted landmarks (empty array when none are new).
 */
export function checkDiscoveries(
  landmarks: readonly Landmark[],
  discovered: Set<number>,
  x: number,
  y: number,
): Landmark[] {
  const found: Landmark[] = []
  for (const lm of landmarks) {
    if (discovered.has(lm.id)) continue
    if (Math.hypot(lm.x + 0.5 - x, lm.y + 0.5 - y) <= DISCOVERY_RADIUS) {
      discovered.add(lm.id)
      found.push(lm)
    }
  }
  return found
}
