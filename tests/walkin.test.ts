import { makeScene, tickScene, isBlockedAt } from '../src/game/walkin'
import { Facing } from '../src/game/gait'
import { effectiveTemperament, moodOf } from '../src/game/encounter'
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

test('the scene knows a City of Gold and the crowd\'s mood', () => {
  expect(makeScene(village({ golden: true }), 0).golden).toBe(true)
  expect(makeScene(village(), 0).golden).toBe(false)
  expect(makeScene(village({ temperament: 0.8 }), 0).mood).toBeCloseTo(0.8)
})

test('village furniture is deterministic and keeps off the center path', () => {
  const a = makeScene(village(), 0)
  const b = makeScene(village(), 0)
  expect(a.props).toEqual(b.props)
  expect(a.props.some((p) => p.kind === 'fire')).toBe(true)
  expect(a.props.some((p) => p.kind === 'crop')).toBe(true)
  for (const p of a.props) {
    expect(Math.abs(p.x - a.w / 2)).toBeGreaterThanOrEqual(1.6)
    expect(isBlockedAt(a, p.x, p.y)).toBe(false) // decoration never traps the player
  }
})

test('huts block movement', () => {
  const s = makeScene(village(), 0)
  expect(s.huts.length).toBeGreaterThan(0)
  const [hx, hy] = s.huts[0]
  expect(isBlockedAt(s, hx + 0.5, hy + 0.5)).toBe(true)
  expect(isBlockedAt(s, s.w / 2, s.h - 1)).toBe(false) // entrance is open
})

test('sliding down the west wall of a hut faces the slide, not the keys', () => {
  const s = makeScene(village(), 0)
  // just clear of a hut's west face, level with it, with room to step south
  const spot = s.huts
    .map(([hx, hy]) => ({ x: hx + 0.5 - 0.91, y: hy + 0.2 }))
    .find((p) => !isBlockedAt(s, p.x, p.y) && !isBlockedAt(s, p.x, p.y + 0.1))
  expect(spot).toBeDefined()
  s.px = spot!.x
  s.py = spot!.y
  tickScene(s, 1, 1, 1 / 60)
  expect(s.px).toBe(spot!.x)
  expect(s.py).toBeGreaterThan(spot!.y)
  expect(s.facing).toBe(Facing.S)
})

test('a tick without input clears moving but keeps the stride', () => {
  const s = makeScene(village(), 0)
  expect(s.moving).toBe(false)
  tickScene(s, 0, -1, 1 / 60)
  expect(s.moving).toBe(true)
  const gait = s.gait
  expect(gait).toBeGreaterThan(0)
  tickScene(s, 0, 0, 1 / 60)
  expect(s.moving).toBe(false)
  expect(s.gait).toBe(gait)
})

test('walk-in hostility is the shared hostile mood', () => {
  for (let i = 0; i <= 40; i++) {
    const temperament = i / 40
    for (const fear of [0, 25, 60, 100]) {
      const eff = effectiveTemperament(temperament, fear)
      const s = makeScene(village({ temperament }), fear)
      expect(s.hostile).toBe(moodOf(eff) === 'hostile')
    }
  }
})
