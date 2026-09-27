import type { GameState } from './state'

/**
 * Missions and forts: permanent outposts founded on the trail. Founding costs
 * gold and leaves men behind as garrison; in return the outpost gathers
 * provisions over time, and any expedition that visits carries them off.
 * They persist across voyages — the backbone of a long career inland.
 */
export interface Outpost {
  x: number
  y: number
  stock: number
}

export const OUTPOST_COST = 250
export const OUTPOST_CREW = 3
export const OUTPOST_MAX_STOCK = 250
export const OUTPOST_REGEN = 2 // provisions gathered per game-second
export const OUTPOST_MIN_SPACING = 12
/** the garrison stays behind, and at least two men must march on */
export const OUTPOST_MIN_CREW = OUTPOST_CREW + 2

export function canFound(state: GameState): boolean {
  return state.gold >= OUTPOST_COST && state.crew >= OUTPOST_MIN_CREW
}

/** Outposts are not founded on a village's doorstep; exactly `radius` away is allowed. */
export function tooCloseToVillage(
  villages: readonly { x: number; y: number }[],
  x: number,
  y: number,
  radius = 4,
): boolean {
  return villages.some((v) => Math.hypot(v.x - x, v.y - y) < radius)
}

/** Returns the new outpost, or null if unaffordable / too close to another. */
export function foundOutpost(
  state: GameState,
  outposts: Outpost[],
  x: number,
  y: number,
): Outpost | null {
  if (!canFound(state)) return null
  if (outposts.some((o) => Math.hypot(o.x - x, o.y - y) < OUTPOST_MIN_SPACING)) return null
  state.gold -= OUTPOST_COST
  state.crew -= OUTPOST_CREW
  const o: Outpost = { x, y, stock: 60 } // the garrison starts a stores shed
  outposts.push(o)
  return o
}

export function tickOutposts(outposts: Outpost[], dt: number): void {
  for (const o of outposts) {
    o.stock = Math.min(OUTPOST_MAX_STOCK, o.stock + OUTPOST_REGEN * dt)
  }
}

/** Carry off everything in the stores; returns the provisions taken. */
export function resupply(state: GameState, o: Outpost): number {
  const taken = Math.floor(o.stock)
  o.stock -= taken
  state.food += taken
  return taken
}
