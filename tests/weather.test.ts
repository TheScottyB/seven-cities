import { generateMap } from '../src/world/mapgen'
import { TILE } from '../src/world/tiles'
import { makeState } from '../src/game/state'
import {
  makeWeather,
  windAt,
  windFactor,
  stormCenter,
  stormAt,
  applyStorm,
} from '../src/game/weather'

test('weather is deterministic for a seed', () => {
  const m = generateMap(123)
  const a = makeWeather(123, m)
  const b = makeWeather(123, m)
  expect(a).toEqual(b)
  expect(windAt(a, 100)).toEqual(windAt(b, 100))
})

test('storm cells start over ocean', () => {
  const m = generateMap(123)
  const w = makeWeather(123, m)
  expect(w.storms.length).toBeGreaterThan(0)
  for (const s of w.storms) {
    expect(m.tiles[Math.floor(s.y0) * m.width + Math.floor(s.x0)]).toBe(TILE.OCEAN)
  }
})

test('wind strength stays within sane bounds over time', () => {
  const m = generateMap(123)
  const w = makeWeather(123, m)
  for (let t = 0; t < 2000; t += 7) {
    const { strength } = windAt(w, t)
    expect(strength).toBeGreaterThanOrEqual(0.1)
    expect(strength).toBeLessThanOrEqual(1)
  }
})

test('tailwind speeds you up, headwind slows you down', () => {
  const angle = 0 // wind blowing east
  const tail = windFactor(angle, 1, 1, 0) // sailing east
  const head = windFactor(angle, 1, -1, 0) // sailing west
  const cross = windFactor(angle, 1, 0, 1) // sailing south
  expect(tail).toBeGreaterThan(1)
  expect(head).toBeLessThan(1)
  expect(head).toBeGreaterThan(0.4) // never a dead stop
  expect(cross).toBeCloseTo(1, 1)
  expect(windFactor(angle, 0.001, 1, 0)).toBeCloseTo(1, 1) // calm ≈ no effect
})

test('storms move over time and stormAt tracks them', () => {
  const m = generateMap(123)
  const w = makeWeather(123, m)
  const s = w.storms[0]
  const c0 = stormCenter(s, 0, m.width, m.height)
  const c60 = stormCenter(s, 60, m.width, m.height)
  expect(Math.hypot(c60.x - c0.x, c60.y - c0.y)).toBeGreaterThan(1)
  expect(stormAt(w, 0, m.width, m.height, c0.x, c0.y)).toBe(true)
  expect(stormAt(w, 0, m.width, m.height, c0.x + s.r + 30, c0.y)).toBe(false)
})

test('a storm bleeds crew and morale, clamped at zero', () => {
  const s = makeState({ crew: 10, morale: 50 })
  applyStorm(s, 2)
  expect(s.crew).toBeLessThan(10)
  expect(s.morale).toBeLessThan(50)
  applyStorm(s, 9999)
  expect(s.crew).toBe(0)
  expect(s.morale).toBe(0)
})

test('storms bounce off the map edges instead of jumping across', () => {
  const m = generateMap(123)
  const w = makeWeather(123, m)
  const dt = 0.25
  let edgesMet = 0
  for (const s of w.storms) {
    const xEnd = s.x0 + s.vx * 3000
    const yEnd = s.y0 + s.vy * 3000
    if (xEnd < 0 || xEnd > m.width || yEnd < 0 || yEnd > m.height) edgesMet++
    const step = Math.hypot(s.vx, s.vy) * dt
    let prev = stormCenter(s, 0, m.width, m.height)
    for (let t = dt; t <= 3000; t += dt) {
      const c = stormCenter(s, t, m.width, m.height)
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x).toBeLessThanOrEqual(m.width)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeLessThanOrEqual(m.height)
      expect(Math.abs(c.x - prev.x)).toBeLessThanOrEqual(Math.abs(s.vx) * dt + 1e-9)
      expect(Math.abs(c.y - prev.y)).toBeLessThanOrEqual(Math.abs(s.vy) * dt + 1e-9)
      expect(Math.hypot(c.x - prev.x, c.y - prev.y)).toBeLessThanOrEqual(step + 1e-9)
      prev = c
    }
  }
  expect(edgesMet).toBeGreaterThan(0) // the run really does cross an edge
})

test('storms follow their straight course until they first reach an edge', () => {
  const m = generateMap(123)
  const s = makeWeather(123, m).storms[0]
  const wrap = (v: number, n: number) => ((v % n) + n) % n
  let checked = 0
  for (let t = 0; t < 3000; t += 0.5) {
    const x = s.x0 + s.vx * t
    const y = s.y0 + s.vy * t
    if (x < 0 || x > m.width || y < 0 || y > m.height) break
    const c = stormCenter(s, t, m.width, m.height)
    expect(c.x).toBeCloseTo(wrap(x, m.width), 9)
    expect(c.y).toBeCloseTo(wrap(y, m.height), 9)
    checked++
  }
  expect(checked).toBeGreaterThan(1)
})
