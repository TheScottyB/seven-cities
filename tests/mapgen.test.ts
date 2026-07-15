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

test('maps have rivers (canoe routes)', () => {
  for (const seed of [123, 1, 999]) {
    const m = generateMap(seed)
    let rivers = 0
    for (const t of m.tiles) if (t === TILE.RIVER) rivers++
    expect(rivers).toBeGreaterThan(20)
  }
})

test('the continent spans the map north-south with a mountain spine', () => {
  for (const seed of [123, 1, 999]) {
    const m = generateMap(seed)
    // land present in the north, middle, and south thirds
    for (const fy of [0.2, 0.5, 0.8]) {
      const y = Math.floor(m.height * fy)
      let land = 0
      for (let x = 0; x < m.width; x++) if (m.tiles[y * m.width + x] !== TILE.OCEAN) land++
      expect(land).toBeGreaterThan(10)
    }
    // a real cordillera exists
    let mountains = 0
    for (const t of m.tiles) if (t === TILE.MOUNTAIN) mountains++
    expect(mountains).toBeGreaterThan(80)
    // and an island arc: land west of the continent band
    let arcLand = 0
    for (let y = 0; y < m.height; y++) {
      for (let x = Math.floor(m.width * 0.1); x < Math.floor(m.width * 0.3); x++) {
        if (m.tiles[y * m.width + x] !== TILE.OCEAN) arcLand++
      }
    }
    expect(arcLand).toBeGreaterThan(30)
  }
})

test('landing point is on walkable land', () => {
  const m = generateMap(123)
  const i = m.landing.y * m.width + m.landing.x
  expect(isWalkable(m.tiles[i])).toBe(true)
})
