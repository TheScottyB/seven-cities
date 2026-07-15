import { makeCareer, rankIndex, rankTitle, budgetFor, bankGold, RANKS } from '../src/game/career'

test('a fresh career starts at the bottom', () => {
  const c = makeCareer()
  expect(c.banked).toBe(0)
  expect(c.voyages).toBe(0)
  expect(rankTitle(0)).toBe('Adventurer')
})

test('rank thresholds are ascending and reachable', () => {
  for (let i = 1; i < RANKS.length; i++) {
    expect(RANKS[i].min).toBeGreaterThan(RANKS[i - 1].min)
    expect(rankIndex(RANKS[i].min)).toBe(i)
    expect(rankIndex(RANKS[i].min - 1)).toBe(i - 1)
  }
  expect(rankTitle(999999)).toBe('Viceroy of the Indies')
})

test('the Crown funds proven men more richly', () => {
  expect(budgetFor(0)).toBe(500)
  expect(budgetFor(1500)).toBe(700)
  expect(budgetFor(999999)).toBe(500 + (RANKS.length - 1) * 200)
})

test('banking accumulates and counts voyages; negatives ignored', () => {
  let c = makeCareer()
  c = bankGold(c, 1200.7)
  expect(c.banked).toBe(1200)
  expect(c.voyages).toBe(1)
  c = bankGold(c, -50)
  expect(c.banked).toBe(1200)
  expect(c.voyages).toBe(2)
})
