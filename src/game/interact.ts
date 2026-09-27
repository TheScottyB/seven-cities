import type { GameMap } from '../world/mapgen'
import type { Village } from '../world/villages'
import type { Outpost } from './outposts'
import { landingSpots, type Ship } from './ship'

/** Sailing west of this column puts Spain within reach. */
export const SPAIN_EDGE_X = 4
/** How close, in tiles, the explorer must stand to a village or outpost to use it. */
export const INTERACT_DIST = 1.4
/** How close, in tiles, the explorer must stand to a moored ship to board it. */
export const BOARD_DIST = 2.0
/** Radius, in tiles, of the fog a village's rumor lifts. */
export const RUMOR_RADIUS = 4

export type LandingSpot = ReturnType<typeof landingSpots>[number]

export type InteractionTarget =
  | { kind: 'spain' }
  | { kind: 'landfall'; spot: LandingSpot }
  | { kind: 'village'; village: Village }
  | { kind: 'outpost'; outpost: Outpost }
  | { kind: 'ship'; index: number }

// Ties go to the later entry (<=).

/** Index of the nearest ship within BOARD_DIST, or -1. */
export function nearestShipIndex(ships: readonly Ship[], x: number, y: number): number {
  let best = -1
  let bestD = BOARD_DIST
  ships.forEach((sh, i) => {
    const d = Math.hypot(sh.x - x, sh.y - y)
    if (d <= bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

/** The nearest outpost within INTERACT_DIST, regardless of its stock. */
export function nearestOutpost(outposts: readonly Outpost[], x: number, y: number): Outpost | null {
  let best: Outpost | null = null
  let bestD = INTERACT_DIST
  for (const o of outposts) {
    const d = Math.hypot(o.x + 0.5 - x, o.y + 0.5 - y)
    if (d <= bestD) {
      bestD = d
      best = o
    }
  }
  return best
}

/** The nearest non-depleted village within INTERACT_DIST. */
export function nearestVillage(villages: readonly Village[], x: number, y: number): Village | null {
  let best: Village | null = null
  let bestD = INTERACT_DIST
  for (const v of villages) {
    if (v.depleted) continue
    const d = Math.hypot(v.x + 0.5 - x, v.y + 0.5 - y)
    if (d <= bestD) {
      bestD = d
      best = v
    }
  }
  return best
}

/**
 * What E would act on right now. The one priority chain behind both the
 * action and its on-screen prompt: at sea, Spain then landfall; ashore,
 * village, then a stocked outpost, then a ship.
 */
export function interactionTarget(args: {
  map: GameMap
  sailing: boolean
  explorer: { x: number; y: number }
  villages: readonly Village[]
  outposts: readonly Outpost[]
  ships: readonly Ship[]
}): InteractionTarget | null {
  const { map, sailing, explorer, villages, outposts, ships } = args
  const { x, y } = explorer
  if (sailing) {
    if (x < SPAIN_EDGE_X) return { kind: 'spain' }
    const spots = landingSpots(map, x, y)
    return spots.length ? { kind: 'landfall', spot: spots[0] } : null
  }
  const village = nearestVillage(villages, x, y)
  if (village) return { kind: 'village', village }
  // only the nearest outpost counts; a bare one does not defer to a farther one
  const outpost = nearestOutpost(outposts, x, y)
  if (outpost && outpost.stock >= 1) return { kind: 'outpost', outpost }
  const index = nearestShipIndex(ships, x, y)
  if (index >= 0) return { kind: 'ship', index }
  return null
}
