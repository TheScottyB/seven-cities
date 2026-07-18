import { GameMap } from '../world/mapgen'
import { TILE, isWalkable } from '../world/tiles'
import { Facing, updateMover, type PartialMover } from './explorer'

// Facing/Mover live in explorer.ts and are re-exported here so there is exactly
// ONE definition — two copies would drift the moment either one is edited.
export { Facing, updateMover, GAIT_CYCLE, GAIT_RATE } from './explorer'
export type { Mover, PartialMover, FacingValue } from './explorer'

/**
 * The sprite fields are OPTIONAL on a ship. Saves persist bare {x, y} and the
 * fleet is rebuilt from those literals on load; requiring the fields would
 * break that restore path for nothing, since moveShip fills them in on the
 * first step anyway.
 */
export interface Ship extends PartialMover {
  x: number
  y: number
}

export const SHIP_SPEED = 12 // tiles/sec — the sea is fast but eats the same food

function isOcean(map: GameMap, x: number, y: number): boolean {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  if (xi < 0 || yi < 0 || xi >= map.width || yi >= map.height) return false
  return map.tiles[yi * map.width + xi] === TILE.OCEAN
}

/** The ocean tile nearest the landing beach — where the expedition's ship waits. */
export function findMooring(map: GameMap): Ship {
  return findMoorings(map, 1)[0]
}

/** Anchorage for a fleet: the n ocean tiles nearest the landing beach. */
export function findMoorings(map: GameMap, n: number): Ship[] {
  const { landing } = map
  const moorings: Ship[] = []
  for (let r = 1; r < 12 && moorings.length < n; r++) {
    for (let dy = -r; dy <= r && moorings.length < n; dy++) {
      for (let dx = -r; dx <= r && moorings.length < n; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue // ring only
        const x = landing.x + dx
        const y = landing.y + dy
        if (isOcean(map, x, y)) moorings.push({ x: x + 0.5, y: y + 0.5, facing: Facing.E, gait: 0, moving: false })
      }
    }
  }
  // no ocean near the landing would mean a landlocked landing — mapgen prevents it
  while (moorings.length < n)
    moorings.push({ x: landing.x + 0.5, y: landing.y + 0.5, facing: Facing.E, gait: 0, moving: false })
  return moorings
}

/**
 * Sail: same axis-sliding movement as walking, but the water is the road —
 * only ocean tiles are passable, so the ship can never run aground.
 * `windMul` scales the helm speed (tailwind > 1, headwind < 1); `driftX/Y`
 * is uncommanded velocity (a storm shoving the hull) applied even when the
 * player gives no input.
 */
export function moveShip(
  map: GameMap,
  ship: Ship,
  dx: number,
  dy: number,
  dt: number,
  windMul = 1,
  driftX = 0,
  driftY = 0,
): void {
  let vx = 0
  let vy = 0
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy)
    vx = (dx / len) * SHIP_SPEED * windMul
    vy = (dy / len) * SHIP_SPEED * windMul
  }
  vx += driftX
  vy += driftY
  if (vx === 0 && vy === 0) {
    ship.moving = false
    return
  }
  const x0 = ship.x
  const y0 = ship.y
  const nx = ship.x + vx * dt
  const ny = ship.y + vy * dt
  if (isOcean(map, nx, ship.y)) ship.x = nx
  if (isOcean(map, ship.x, ny)) ship.y = ny
  // Derived from the displacement, so a coast-scrape or a squall turns the
  // hull the way it actually went — not the way the helm asked.
  updateMover(ship, x0, y0)
}

/** Walkable land tiles adjacent (8-way) to the ship — places you can step ashore. */
export function landingSpots(map: GameMap, sx: number, sy: number): [number, number][] {
  const xi = Math.floor(sx)
  const yi = Math.floor(sy)
  const spots: [number, number][] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const x = xi + dx
      const y = yi + dy
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue
      if (isWalkable(map.tiles[y * map.width + x])) spots.push([x, y])
    }
  }
  return spots
}
