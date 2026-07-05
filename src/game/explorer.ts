import { GameMap } from '../world/mapgen'
import { tileInfo, isWalkable } from '../world/tiles'

export interface Explorer {
  x: number
  y: number
  baseSpeed: number
}

export function makeExplorer(map: GameMap): Explorer {
  return { x: map.landing.x + 0.5, y: map.landing.y + 0.5, baseSpeed: 6 }
}

function walkableAt(map: GameMap, x: number, y: number): boolean {
  const xi = Math.floor(x),
    yi = Math.floor(y)
  if (xi < 0 || yi < 0 || xi >= map.width || yi >= map.height) return false
  return isWalkable(map.tiles[yi * map.width + xi])
}

/**
 * Move the explorer by a normalized direction, scaled by the current tile's
 * speed. Axes are resolved independently so the player slides along walls
 * instead of sticking to them, and never enters impassable tiles.
 */
export function moveExplorer(map: GameMap, e: Explorer, dx: number, dy: number, dt: number): void {
  if (dx === 0 && dy === 0) return
  const len = Math.hypot(dx, dy)
  dx /= len
  dy /= len

  const here = tileInfo(map.tiles[Math.floor(e.y) * map.width + Math.floor(e.x)])
  const step = e.baseSpeed * (here.speed || 1) * dt
  const nx = e.x + dx * step,
    ny = e.y + dy * step

  if (walkableAt(map, nx, e.y)) e.x = nx
  if (walkableAt(map, e.x, ny)) e.y = ny
}
