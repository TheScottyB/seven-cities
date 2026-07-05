import { generateMap } from '../src/world/mapgen'
import { TILE, isWalkable } from '../src/world/tiles'

test('same seed → identical map', () => {
  const a = generateMap(123),
    b = generateMap(123)
  expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles))
  expect(a.width).toBe(b.width)
})

test('map has both land and ocean', () => {
  const m = generateMap(123)
  let ocean = 0,
    land = 0
  for (const t of m.tiles) t === TILE.OCEAN ? ocean++ : land++
  expect(ocean).toBeGreaterThan(0)
  expect(land).toBeGreaterThan(0)
})

test('landing point is on walkable land', () => {
  const m = generateMap(123)
  const i = m.landing.y * m.width + m.landing.x
  expect(isWalkable(m.tiles[i])).toBe(true)
})
