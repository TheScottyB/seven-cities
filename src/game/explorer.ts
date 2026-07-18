import { GameMap } from '../world/mapgen'
import { tileInfo, isWalkable } from '../world/tiles'

/** Sprite facings, in the order the sprite bank indexes them. */
export const Facing = { S: 0, W: 1, E: 2, N: 3 } as const
export type FacingValue = (typeof Facing)[keyof typeof Facing]

/**
 * Length of the gait counter's wrap, in tiles travelled.
 *
 * This MUST stay commensurate with the walk cycle: the sprite bank picks its
 * frame with floor(gait * GAIT_RATE) & 3, so the wrap has to land on a whole
 * number of 4-frame cycles. 8 * 2.0 = 16 frame-steps = exactly 4 cycles. Pick
 * an incommensurate pair (2.2, say) and the figure visibly snaps mid-stride
 * every time the counter wraps.
 */
export const GAIT_CYCLE = 8
export const GAIT_RATE = 2.0

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
  m.facing =
    Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? Facing.E : Facing.W) : ddy > 0 ? Facing.S : Facing.N
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
