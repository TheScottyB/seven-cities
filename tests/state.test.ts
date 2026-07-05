import { makeState, tick, GameStatus } from '../src/game/state'

function base() {
  return makeState({ food: 100, crew: 100, morale: 100 })
}

test('food drains over time', () => {
  const s = base()
  const before = s.food
  tick(s, 10)
  expect(s.food).toBeLessThan(before)
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
