import { generateMap } from '../src/world/mapgen'
import { makeExplorer, moveExplorer } from '../src/game/explorer'
import { isWalkable } from '../src/world/tiles'

test('starts at landing point', () => {
  const m = generateMap(123)
  const e = makeExplorer(m)
  expect(e.x).toBeCloseTo(m.landing.x + 0.5)
  expect(e.y).toBeCloseTo(m.landing.y + 0.5)
})

test('cannot move onto ocean/impassable', () => {
  const m = generateMap(123)
  const e = makeExplorer(m)
  for (let i = 0; i < 1000; i++) moveExplorer(m, e, -1, 0, 0.1)
  expect(isWalkable(m.tiles[Math.floor(e.y) * m.width + Math.floor(e.x)])).toBe(true)
})

test('stays within bounds', () => {
  const m = generateMap(123)
  const e = makeExplorer(m)
  for (let i = 0; i < 5000; i++) moveExplorer(m, e, 1, 1, 0.5)
  expect(e.x).toBeGreaterThanOrEqual(0)
  expect(e.x).toBeLessThan(m.width)
  expect(e.y).toBeGreaterThanOrEqual(0)
  expect(e.y).toBeLessThan(m.height)
})
