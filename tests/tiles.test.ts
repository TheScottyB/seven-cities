import { TILE, tileInfo, isWalkable } from '../src/world/tiles'

test('ocean is not walkable on foot', () => {
  expect(isWalkable(TILE.OCEAN)).toBe(false)
})

test('mountain peak is not walkable', () => {
  expect(isWalkable(TILE.MOUNTAIN)).toBe(false)
})

test('grass is walkable and faster than forest', () => {
  expect(isWalkable(TILE.GRASS)).toBe(true)
  expect(tileInfo(TILE.GRASS).speed).toBeGreaterThan(tileInfo(TILE.FOREST).speed)
})

test('river is faster than grass — canoes are highways', () => {
  expect(isWalkable(TILE.RIVER)).toBe(true)
  expect(tileInfo(TILE.RIVER).speed).toBeGreaterThan(tileInfo(TILE.GRASS).speed)
})

test('every tile has a color', () => {
  for (const key of Object.values(TILE)) {
    expect(tileInfo(key as number).color).toMatch(/^#[0-9a-f]{6}$/i)
  }
})
