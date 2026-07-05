import { GameState } from './state'
import type { Village } from '../world/villages'

type Roll = () => number

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function contact(s: GameState, v: Village): void {
  const firstVisit = !v.visited
  if (firstVisit) {
    v.visited = true
    s.villagesContacted++
    // a City of Gold is "discovered" the first time you reach it, once
    if (v.golden) s.citiesFound++
  }
}

export function resolveTrade(s: GameState, v: Village, roll: Roll = Math.random): void {
  if (v.depleted) return
  contact(s, v)
  const rate = 0.3 + v.temperament * 0.7
  const gold = Math.floor(v.wealth * rate * (0.6 + roll() * 0.4))
  s.gold += gold
  s.food += Math.floor(gold * 0.3)
  s.morale = clamp(s.morale + 3, 0, 100)
  v.depleted = true
}

export function resolveGift(s: GameState, v: Village): void {
  if (v.depleted) return
  contact(s, v)
  v.temperament = clamp(v.temperament + 0.25, 0, 1)
  s.morale = clamp(s.morale + 6, 0, 100)
  // a gift does not deplete the village — it can still be traded with later
}

export function resolveAttack(s: GameState, v: Village, roll: Roll = Math.random): void {
  if (v.depleted) return
  contact(s, v)
  const defense = (1 - v.temperament) * 0.5 + (v.population / 400) * 0.5
  const losses = Math.floor(roll() * defense * 40)
  s.crew = clamp(s.crew - losses, 0, 100)
  s.gold += v.wealth
  s.morale = clamp(s.morale - 8, 0, 100)
  v.depleted = true
}
