import {
  makeState,
  tick,
  canCamp,
  makeCamp,
  CAMP_FOOD,
  CAMP_MORALE,
  dailyAppetite,
  score,
  scoreParts,
  GameStatus,
  SECONDS_PER_DAY,
} from '../src/game/state'

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
  const small = makeState({ food: 500, crew: 10 })
  const large = makeState({ food: 500, crew: 50 })
  tick(small, SECONDS_PER_DAY)
  tick(large, SECONDS_PER_DAY)
  const smallEaten = 500 - small.food
  const largeEaten = 500 - large.food
  expect(smallEaten).toBeGreaterThan(8) // hunger bites even for a small party
  expect(largeEaten).toBeGreaterThan(smallEaten * 1.8) // and scales with mouths
})

test('dailyAppetite matches what tick actually eats', () => {
  const s = makeState({ food: 500, crew: 25 })
  tick(s, SECONDS_PER_DAY)
  expect(s.day).toBe(2)
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

test('the seventh city wins even if the last man falls in the same tick', () => {
  const s = base()
  s.citiesFound = 7
  s.crew = 0
  tick(s, 1)
  expect(s.status).toBe(GameStatus.Won)
})

test('a finished expedition is frozen', () => {
  for (const status of [GameStatus.Won, GameStatus.Lost]) {
    const s = makeState({ food: 100, elapsed: 55, day: 3, status })
    tick(s, 30)
    expect(s.elapsed).toBe(55)
    expect(s.day).toBe(3)
    expect(s.food).toBe(100)
    expect(s.status).toBe(status)
  }
})

test('score is the sum of its whole-number parts', () => {
  const s = makeState({ gold: 123.7, villagesContacted: 4, day: 9 })
  const p = scoreParts(s, 57, 3)
  for (const v of Object.values(p)) expect(Number.isInteger(v)).toBe(true)
  expect(p.landmarks).toBe(150)
  expect(p.gold + p.charted + p.villages + p.landmarks + p.days).toBe(score(s, 57, 3))
  expect(p.days).toBeLessThan(0)
})

test('makeCamp trades provisions and half a day to restore morale, refused when full or starving', () => {
  const s = makeState({ food: 100, morale: 60, elapsed: 0, day: 1 })
  expect(canCamp(s)).toBe(true)
  expect(makeCamp(s)).toBe(true)
  expect(s.food).toBe(100 - CAMP_FOOD)
  expect(s.morale).toBe(60 + CAMP_MORALE)
  expect(s.elapsed).toBe(SECONDS_PER_DAY * 0.5)

  const cheerful = makeState({ food: 100, morale: 98 })
  expect(canCamp(cheerful)).toBe(false)
  expect(makeCamp(cheerful)).toBe(false)

  const hungry = makeState({ food: CAMP_FOOD - 1, morale: 40 })
  expect(canCamp(hungry)).toBe(false)
  expect(makeCamp(hungry)).toBe(false)
})
