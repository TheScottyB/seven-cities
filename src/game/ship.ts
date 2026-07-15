import { GameMap } from '../world/mapgen'
import { TILE, isWalkable } from '../world/tiles'

export interface Ship {
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
  const { landing } = map
  for (let r = 1; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue // ring only
        const x = landing.x + dx
        const y = landing.y + dy
        if (isOcean(map, x, y)) return { x: x + 0.5, y: y + 0.5 }
      }
    }
  }
  // no ocean near the landing would mean a landlocked landing — mapgen prevents it
  return { x: landing.x + 0.5, y: landing.y + 0.5 }
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
  if (vx === 0 && vy === 0) return
  const nx = ship.x + vx * dt
  const ny = ship.y + vy * dt
  if (isOcean(map, nx, ship.y)) ship.x = nx
  if (isOcean(map, ship.x, ny)) ship.y = ny
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
