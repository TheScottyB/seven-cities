import { makeScene, tickScene, isBlockedAt } from '../src/game/walkin'
import type { Village } from '../src/world/villages'

function village(over: Partial<Village> = {}): Village {
  return {
    x: 40,
    y: 60,
    wealth: 200,
    temperament: 0.8,
    population: 200,
    golden: false,
    visited: false,
    depleted: false,
    ...over,
  }
}

test('scene is deterministic for a village', () => {
  const a = makeScene(village(), 0)
  const b = makeScene(village(), 0)
  expect(a.huts).toEqual(b.huts)
  expect(a.villagers.map((v) => [v.x, v.y])).toEqual(b.villagers.map((v) => [v.x, v.y]))
})

test('player starts at the south entrance, chief waits at the head', () => {
  const s = makeScene(village(), 0)
  expect(s.py).toBeGreaterThan(s.h - 2)
  expect(s.chief.y).toBeLessThan(3)
  expect(s.hostile).toBe(false)
})

test('fear turns a wary village hostile', () => {
  expect(makeScene(village({ temperament: 0.8 }), 0).hostile).toBe(false)
  expect(makeScene(village({ temperament: 0.8 }), 95).hostile).toBe(true)
  expect(makeScene(village({ temperament: 0.1 }), 0).hostile).toBe(true)
})

test('walking north up the clear center path reaches the chief', () => {
  const s = makeScene(village(), 0)
  let status = 'walking'
  for (let i = 0; i < 600 && status === 'walking'; i++) {
    status = tickScene(s, 0, -1, 1 / 60)
  }
  expect(status).toBe('chief')
})

test('walking south leaves the village', () => {
  const s = makeScene(village(), 0)
  let status = 'walking'
  for (let i = 0; i < 200 && status === 'walking'; i++) {
    status = tickScene(s, 0, 1, 1 / 60)
  }
  expect(status).toBe('left')
})

test('a hostile crowd drives off a dawdling intruder', () => {
  const s = makeScene(village({ temperament: 0.05, population: 400 }), 50)
  expect(s.hostile).toBe(true)
  let status = 'walking'
  for (let i = 0; i < 3000 && status === 'walking'; i++) {
    status = tickScene(s, 0, 0, 1 / 60) // stand there like a fool
  }
  expect(status).toBe('driven-off')
  expect(s.caught).toBe(3)
})

test('huts block movement', () => {
  const s = makeScene(village(), 0)
  expect(s.huts.length).toBeGreaterThan(0)
  const [hx, hy] = s.huts[0]
  expect(isBlockedAt(s, hx + 0.5, hy + 0.5)).toBe(true)
  expect(isBlockedAt(s, s.w / 2, s.h - 1)).toBe(false) // entrance is open
})
