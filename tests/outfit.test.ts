import {
  defaultOutfit,
  outfitCost,
  remainingBudget,
  adjustOutfit,
  BUDGET,
  LIMITS,
} from '../src/game/outfit'

test('default outfit is within budget', () => {
  const o = defaultOutfit()
  expect(outfitCost(o)).toBeLessThanOrEqual(BUDGET)
  expect(remainingBudget(o)).toBeGreaterThanOrEqual(0)
})

test('adjusting up increases the quantity and cost', () => {
  const o = defaultOutfit()
  const o2 = adjustOutfit(o, 'goods', 1)
  expect(o2.goods).toBeGreaterThan(o.goods)
  expect(outfitCost(o2)).toBeGreaterThan(outfitCost(o))
})

test('adjusting down decreases and clamps at the lower limit', () => {
  let o = defaultOutfit()
  for (let i = 0; i < 100; i++) o = adjustOutfit(o, 'crew', -1)
  expect(o.crew).toBe(LIMITS.crew[0])
})

test('cannot exceed the upper limit', () => {
  let o = { food: 0, goods: 0, crew: 10 }
  for (let i = 0; i < 200; i++) o = adjustOutfit(o, 'food', 1)
  expect(o.food).toBeLessThanOrEqual(LIMITS.food[1])
})

test('cannot spend past the budget', () => {
  let o = { food: 0, goods: 0, crew: 10 }
  // hammer everything upward; total cost must never exceed BUDGET
  for (let i = 0; i < 300; i++) {
    o = adjustOutfit(o, 'food', 1)
    o = adjustOutfit(o, 'goods', 1)
    o = adjustOutfit(o, 'crew', 1)
  }
  expect(outfitCost(o)).toBeLessThanOrEqual(BUDGET)
})

test('rejected adjustment returns the outfit unchanged', () => {
  // spend the whole budget on goods, then try to add more
  let o = { food: 0, goods: 0, crew: 10 }
  for (let i = 0; i < 300; i++) o = adjustOutfit(o, 'goods', 1)
  const before = { ...o }
  const after = adjustOutfit(o, 'goods', 1)
  expect(after).toEqual(before)
})
