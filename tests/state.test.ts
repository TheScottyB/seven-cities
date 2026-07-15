import { makeState, tick, dailyAppetite, GameStatus } from '../src/game/state'

function base() {
  return makeState({ food: 100, crew: 100, morale: 100 })
}

test('food drains over time', () => {
  const s = base()
  const before = s.food
  tick(s, 10)
  expect(s.food).toBeLessThan(before)
})

test('a full day feeds heavily and scales with crew size', () => {
  const day = 20 // seconds per game day
  const small = makeState({ food: 500, crew: 10 })
  const large = makeState({ food: 500, crew: 50 })
  tick(small, day)
  tick(large, day)
  const smallEaten = 500 - small.food
  const largeEaten = 500 - large.food
  expect(smallEaten).toBeGreaterThan(8) // hunger bites even for a small party
  expect(largeEaten).toBeGreaterThan(smallEaten * 1.8) // and scales with mouths
})

test('dailyAppetite matches what tick actually eats', () => {
  const s = makeState({ food: 500, crew: 25 })
  tick(s, 20) // one day
  expect(500 - s.food).toBeCloseTo(dailyAppetite(25), 1)
  expect(dailyAppetite(25)).toBeGreaterThan(20)
})

test('starvation costs crew and morale', () => {
  const s = base()
  s.food = 0
  tick(s, 5)
  expect(s.crew).toBeLessThan(100)
  expect(s.morale).toBeLessThan(100)
})

test('zero crew → game over', () => {
  const s = base()
  s.crew = 0
  tick(s, 1)
  expect(s.status).toBe(GameStatus.Lost)
})

test('zero morale → mutiny lost', () => {
  const s = base()
  s.morale = 0
  tick(s, 1)
  expect(s.status).toBe(GameStatus.Lost)
})

test('finding 7 cities → won', () => {
  const s = base()
  s.citiesFound = 7
  tick(s, 1)
  expect(s.status).toBe(GameStatus.Won)
})
