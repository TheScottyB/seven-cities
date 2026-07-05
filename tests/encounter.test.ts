import { makeState } from '../src/game/state'
import { resolveTrade, resolveGift, resolveAttack } from '../src/game/encounter'
import type { Village } from '../src/world/villages'

function village(over: Partial<Village> = {}): Village {
  return {
    x: 0,
    y: 0,
    wealth: 200,
    temperament: 0.8,
    population: 100,
    golden: false,
    visited: false,
    depleted: false,
    ...over,
  }
}

test('friendly trade gains gold and food, depletes village', () => {
  const s = makeState()
  const v = village({ temperament: 0.9, wealth: 200 })
  resolveTrade(s, v, () => 0.5)
  expect(s.gold).toBeGreaterThan(0)
  expect(v.depleted).toBe(true)
  expect(s.villagesContacted).toBe(1)
})

test('gift raises temperament and morale, no gold', () => {
  const s = makeState()
  const v = village({ temperament: 0.3 })
  const before = v.temperament,
    goldBefore = s.gold
  resolveGift(s, v)
  expect(v.temperament).toBeGreaterThan(before)
  expect(s.morale).toBeGreaterThanOrEqual(100)
  expect(s.gold).toBe(goldBefore)
})

test('attack on hostile village can cost crew', () => {
  const s = makeState()
  const v = village({ temperament: 0.05, population: 300, wealth: 300 })
  resolveAttack(s, v, () => 0.99)
  expect(s.crew).toBeLessThan(100)
  expect(v.depleted).toBe(true)
})

test('golden city trade increments citiesFound', () => {
  const s = makeState()
  const v = village({ golden: true })
  resolveTrade(s, v, () => 0.5)
  expect(s.citiesFound).toBe(1)
})

test('depleted village cannot be re-traded', () => {
  const s = makeState()
  const v = village({ depleted: true })
  const g = s.gold
  resolveTrade(s, v, () => 0.5)
  expect(s.gold).toBe(g)
})
