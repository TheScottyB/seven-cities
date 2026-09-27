import type { GameMap } from '../world/mapgen'
import { tileInfo, isWalkable } from '../world/tiles'
import { Facing, GAIT_CYCLE } from './gait'

/** Anything that moves across the map and wants a facing-aware sprite. */
export interface Mover {
  x: number
  y: number
  facing: number
  gait: number
  moving: boolean
}

/**
 * A mover whose sprite fields may be absent. Saves store bare {x, y} and
 * rebuild ships from them, so the ship type has to tolerate the gap.
 */
export type PartialMover = { x: number; y: number } & Partial<Mover>

/** The facing for a displacement; the dominant axis wins, and ties face S/N. */
export function facingFrom(ddx: number, ddy: number): number {
  return Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? Facing.E : Facing.W) : ddy > 0 ? Facing.S : Facing.N
}

/**
 * Derive facing and gait from the DISPLACEMENT actually achieved, not from the
 * input that was requested.
 *
 * This matters more than it looks. Both movers resolve their axes
 * independently so they slide along walls, and the ship also takes storm drift
 * with zero player input — so input-derived facing lies every time the hull
 * scrapes a coast, and freezes outright when the player is being pushed
 * rather than steering.
 */
export function updateMover(m: PartialMover, x0: number, y0: number): void {
  const ddx = m.x - x0
  const ddy = m.y - y0
  m.moving = ddx !== 0 || ddy !== 0
  if (!m.moving) return
  m.facing = facingFrom(ddx, ddy)
  m.gait = ((m.gait ?? 0) + Math.hypot(ddx, ddy)) % GAIT_CYCLE
}

export interface Explorer extends Mover {
  baseSpeed: number
}

export function makeExplorer(map: GameMap): Explorer {
  return {
    x: map.landing.x + 0.5,
    y: map.landing.y + 0.5,
    baseSpeed: 8,
    facing: Facing.S,
    gait: 0,
    moving: false,
  }
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
  if (dx === 0 && dy === 0) {
    e.moving = false
    return
  }
  const len = Math.hypot(dx, dy)
  dx /= len
  dy /= len

  const x0 = e.x
  const y0 = e.y
  const here = tileInfo(map.tiles[Math.floor(e.y) * map.width + Math.floor(e.x)])
  const step = e.baseSpeed * (here.speed || 1) * dt
  const nx = e.x + dx * step,
    ny = e.y + dy * step

  if (walkableAt(map, nx, e.y)) e.x = nx
  if (walkableAt(map, e.x, ny)) e.y = ny

  updateMover(e, x0, y0)
}
