import { GameState } from './state'
import type { Village } from '../world/villages'

type Roll = () => number

/** goods consumed by a full-strength trade / gift */
export const TRADE_GOODS = 25
export const GIFT_GOODS = 10

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Word travels. A village's willingness to deal is its own temperament
 * dragged down by how feared the expedition has become everywhere.
 */
export function effectiveTemperament(temperament: number, fear: number): number {
  return clamp(temperament - (fear / 100) * 0.6, 0, 1)
}

/**
 * Called when the player first reaches a village (the encounter panel opens).
 * Discovery — including counting a City of Gold — happens on arrival, not on
 * how the meeting goes, and only ever once per village.
 */
export function discoverVillage(s: GameState, v: Village): void {
  if (v.visited) return
  v.visited = true
  s.villagesContacted++
  if (v.golden) s.citiesFound++
}

export function resolveTrade(s: GameState, v: Village, roll: Roll = Math.random): void {
  if (v.depleted || s.goods <= 0) return
  const spent = Math.min(TRADE_GOODS, s.goods)
  const strength = spent / TRADE_GOODS // trading with a thin pack earns less
  const rate = 0.3 + effectiveTemperament(v.temperament, s.fear) * 0.7
  const gold = Math.floor(v.wealth * rate * (0.6 + roll() * 0.4) * strength)
  s.goods -= spent
  s.gold += gold
  // a token of provisions alongside the gold — real food comes from Spain
  // and the mission forts, not from trading
  s.food += Math.floor(gold * 0.05)
  s.morale = clamp(s.morale + 3, 0, 100)
  v.depleted = true
}

export function resolveGift(s: GameState, v: Village): void {
  if (v.depleted || s.goods <= 0) return
  const spent = Math.min(GIFT_GOODS, s.goods)
  s.goods -= spent
  v.temperament = clamp(v.temperament + 0.25 * (spent / GIFT_GOODS), 0, 1)
  s.morale = clamp(s.morale + 6, 0, 100)
  s.fear = clamp(s.fear - 2, 0, 100) // kindness is news too, but it travels slowly
  // a gift does not deplete the village — it can still be traded with later
}

export function resolveAttack(s: GameState, v: Village, roll: Roll = Math.random): void {
  if (v.depleted) return
  const defense = (1 - v.temperament) * 0.5 + (v.population / 400) * 0.5
  const losses = Math.floor(roll() * defense * 40)
  s.crew = clamp(s.crew - losses, 0, 100)
  s.gold += v.wealth
  s.morale = clamp(s.morale - 8, 0, 100)
  // massacres echo across the whole New World
  s.fear = clamp(s.fear + 10 + Math.floor(v.population / 40), 0, 100)
  v.depleted = true
}
