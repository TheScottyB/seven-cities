/**
 * Outfitting in Spain: before sailing, the Crown grants a budget (BUDGET base,
 * more with each rank; see budgetFor in career.ts) which the player splits
 * between food (rations), trade goods (needed to trade and gift in the New
 * World), crew, and ships (at least one caravel). Whatever is left over sails
 * with you as starting gold.
 */
export interface Outfit {
  food: number
  goods: number
  crew: number
  ships: number
}

/** the base grant, before rank; budgetFor adds to it */
export const BUDGET = 500

/** gold per unit */
export const PRICES: Record<keyof Outfit, number> = { food: 0.5, goods: 2, crew: 5, ships: 100 }

export const LIMITS: Record<keyof Outfit, [number, number]> = {
  food: [0, 800],
  goods: [0, 200],
  crew: [10, 100],
  ships: [1, 4],
}

/** how much one keypress adjusts each line item */
export const STEPS: Record<keyof Outfit, number> = { food: 20, goods: 10, crew: 5, ships: 1 }

export function defaultOutfit(): Outfit {
  return { food: 180, goods: 80, crew: 25, ships: 1 }
}

export function outfitCost(o: Outfit): number {
  return o.food * PRICES.food + o.goods * PRICES.goods + o.crew * PRICES.crew + o.ships * PRICES.ships
}

export function remainingBudget(o: Outfit, budget = BUDGET): number {
  return budget - outfitCost(o)
}

/** Returns the adjusted outfit, or the original unchanged if the change would
 *  bust a limit or the budget. */
export function adjustOutfit(o: Outfit, field: keyof Outfit, dir: 1 | -1, budget = BUDGET): Outfit {
  const [lo, hi] = LIMITS[field]
  const value = Math.max(lo, Math.min(hi, o[field] + dir * STEPS[field]))
  const next = { ...o, [field]: value }
  return outfitCost(next) <= budget ? next : o
}
