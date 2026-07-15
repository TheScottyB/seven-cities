/**
 * The career: gold banked with the Crown across voyages buys rank, and rank
 * buys bigger outfitting budgets. The New World persists between voyages —
 * returning to Spain is how an expedition resupplies its trade goods.
 */
export interface Career {
  banked: number
  voyages: number
}

export const RANKS = [
  { title: 'Adventurer', min: 0 },
  { title: 'Captain', min: 1500 },
  { title: 'Commodore', min: 3500 },
  { title: 'Governor', min: 6000 },
  { title: 'Admiral of the Ocean Sea', min: 9000 },
  { title: 'Viceroy of the Indies', min: 13000 },
] as const

export function makeCareer(): Career {
  return { banked: 0, voyages: 0 }
}

export function rankIndex(banked: number): number {
  let idx = 0
  for (let i = 0; i < RANKS.length; i++) if (banked >= RANKS[i].min) idx = i
  return idx
}

export function rankTitle(banked: number): string {
  return RANKS[rankIndex(banked)].title
}

/** The Crown funds proven men: base 500, +200 per rank earned. */
export function budgetFor(banked: number): number {
  return 500 + rankIndex(banked) * 200
}

export function bankGold(c: Career, gold: number): Career {
  return { banked: c.banked + Math.max(0, Math.floor(gold)), voyages: c.voyages + 1 }
}
