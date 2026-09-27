import { makeState } from '../src/game/state'
import {
  discoverVillage,
  resolveTrade,
  resolveGift,
  resolveAttack,
  effectiveTemperament,
  moodOf,
  applyDrivenOff,
  HOSTILE_BELOW,
  FRIENDLY_ABOVE,
} from '../src/game/encounter'
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
  const s = makeState({ goods: 100, morale: 50 })
  const food0 = s.food
  const m0 = s.morale
  const v = village({ temperament: 0.9, wealth: 200 })
  resolveTrade(s, v, () => 0.5)
  expect(s.gold).toBeGreaterThan(0)
  expect(s.food).toBeGreaterThan(food0)
  expect(s.morale).toBeGreaterThan(m0)
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
  const s = makeState({ goods: 0, morale: 50 })
  const fear0 = s.fear
  const v = village({ temperament: 0.05, population: 300, wealth: 300 })
  resolveAttack(s, v, () => 0.99)
  expect(s.crew).toBeLessThan(100)
  expect(s.gold).toBe(300)
  expect(s.morale).toBeLessThan(50)
  expect(s.fear).toBeGreaterThan(fear0)
  expect(v.depleted).toBe(true)
})

test('attack spreads fear across the world; gifts slowly redeem it', () => {
  const s = makeState()
  resolveAttack(s, village({ population: 200 }), () => 0.5)
  expect(s.fear).toBeGreaterThan(0)
  const afterAttack = s.fear
  resolveGift(s, village())
  expect(s.fear).toBeLessThan(afterAttack)
})

test('fear poisons trade rates everywhere', () => {
  const calm = makeState({ fear: 0 })
  const feared = makeState({ fear: 80 })
  const v1 = village({ temperament: 0.8, wealth: 200 })
  const v2 = village({ temperament: 0.8, wealth: 200 })
  resolveTrade(calm, v1, () => 0.5)
  resolveTrade(feared, v2, () => 0.5)
  expect(feared.gold).toBeLessThan(calm.gold)
})

test('effectiveTemperament drops with fear, clamped to [0,1]', () => {
  expect(effectiveTemperament(0.8, 0)).toBeCloseTo(0.8)
  expect(effectiveTemperament(0.8, 50)).toBeLessThan(0.8)
  expect(effectiveTemperament(0.1, 100)).toBe(0)
  expect(effectiveTemperament(1, 0)).toBe(1)
})

test('depleted village cannot be re-traded or re-attacked', () => {
  const s = makeState({ goods: 100 })
  const v = village({ depleted: true })
  resolveTrade(s, v, () => 0.5)
  resolveAttack(s, v, () => 0.5)
  expect(s.gold).toBe(0)
})

test('moodOf splits hostile / wary / friendly at the shared cutoffs', () => {
  expect(HOSTILE_BELOW).toBe(0.3)
  expect(FRIENDLY_ABOVE).toBe(0.66)
  expect(moodOf(0.29)).toBe('hostile')
  expect(moodOf(0.3)).toBe('wary')
  expect(moodOf(0.66)).toBe('wary')
  expect(moodOf(0.67)).toBe('friendly')
  expect(moodOf(0)).toBe('hostile')
  expect(moodOf(1)).toBe('friendly')
})

test('being driven off costs men and heart, floored at zero', () => {
  const s = makeState({ crew: 20, morale: 50 })
  applyDrivenOff(s)
  expect(s.crew).toBe(18)
  expect(s.morale).toBe(45)
  const low = makeState({ crew: 1, morale: 3 })
  applyDrivenOff(low)
  expect(low.crew).toBe(0)
  expect(low.morale).toBe(0)
})
