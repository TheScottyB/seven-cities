import { makeState } from '../src/game/state'
import { discoverVillage, resolveTrade, resolveGift, resolveAttack } from '../src/game/encounter'
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

test('discovering a village counts contact once', () => {
  const s = makeState()
  const v = village()
  discoverVillage(s, v)
  discoverVillage(s, v)
  expect(s.villagesContacted).toBe(1)
  expect(v.visited).toBe(true)
})

test('discovering a golden city counts it exactly once', () => {
  const s = makeState()
  const v = village({ golden: true })
  discoverVillage(s, v)
  discoverVillage(s, v)
  resolveGift(s, v)
  resolveTrade(s, v, () => 0.5)
  expect(s.citiesFound).toBe(1)
})

test('friendly trade gains gold and food, consumes goods, depletes village', () => {
  const s = makeState({ goods: 100 })
  const v = village({ temperament: 0.9, wealth: 200 })
  resolveTrade(s, v, () => 0.5)
  expect(s.gold).toBeGreaterThan(0)
  expect(s.goods).toBeLessThan(100)
  expect(v.depleted).toBe(true)
})

test('trade with no goods does nothing', () => {
  const s = makeState({ goods: 0 })
  const v = village()
  resolveTrade(s, v, () => 0.5)
  expect(s.gold).toBe(0)
  expect(v.depleted).toBe(false)
})

test('partial goods scale the trade down', () => {
  const rich = makeState({ goods: 100 })
  const poor = makeState({ goods: 5 })
  const v1 = village({ temperament: 0.8, wealth: 200 })
  const v2 = village({ temperament: 0.8, wealth: 200 })
  resolveTrade(rich, v1, () => 0.5)
  resolveTrade(poor, v2, () => 0.5)
  expect(poor.gold).toBeLessThan(rich.gold)
  expect(poor.gold).toBeGreaterThan(0)
})

test('gift consumes goods and raises temperament and morale', () => {
  const s = makeState({ goods: 100, morale: 80 })
  const v = village({ temperament: 0.3 })
  const before = v.temperament
  resolveGift(s, v)
  expect(v.temperament).toBeGreaterThan(before)
  expect(s.morale).toBeGreaterThan(80)
  expect(s.goods).toBeLessThan(100)
  expect(s.gold).toBe(0)
})

test('gift with no goods does nothing', () => {
  const s = makeState({ goods: 0 })
  const v = village({ temperament: 0.3 })
  resolveGift(s, v)
  expect(v.temperament).toBe(0.3)
})

test('attack needs no goods, can cost crew, seizes all gold', () => {
  const s = makeState({ goods: 0 })
  const v = village({ temperament: 0.05, population: 300, wealth: 300 })
  resolveAttack(s, v, () => 0.99)
  expect(s.crew).toBeLessThan(100)
  expect(s.gold).toBe(300)
  expect(v.depleted).toBe(true)
})

test('depleted village cannot be re-traded or re-attacked', () => {
  const s = makeState({ goods: 100 })
  const v = village({ depleted: true })
  resolveTrade(s, v, () => 0.5)
  resolveAttack(s, v, () => 0.5)
  expect(s.gold).toBe(0)
})
