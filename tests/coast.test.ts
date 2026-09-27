import type { GameMap } from '../src/world/mapgen'
import { generateMap } from '../src/world/mapgen'
import { nearestLandDist } from '../src/world/coast'
import { TILE } from '../src/world/tiles'

function fill(width: number, height: number, at: (x: number, y: number) => number): GameMap {
  const tiles = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) tiles[y * width + x] = at(x, y)
  return { width, height, tiles, landing: { x: 0, y: 0 }, seed: 0, elevation: new Float32Array(width * height) }
}

// ocean in columns 0..11, grass from 12 east
const half = fill(20, 8, (x) => (x < 12 ? TILE.OCEAN : TILE.GRASS))

test('0 on land', () => {
  expect(nearestLandDist(half, 12.5, 3.5)).toBe(0)
  expect(nearestLandDist(half, 19.9, 7.9)).toBe(0)
})

test('1 beside the coast, orthogonal or diagonal', () => {
  expect(nearestLandDist(half, 11.5, 3.5)).toBe(1)
  const dot = fill(9, 9, (x, y) => (x === 4 && y === 4 ? TILE.BEACH : TILE.OCEAN))
  expect(nearestLandDist(dot, 3.5, 3.5)).toBe(1)
  expect(nearestLandDist(dot, 5.5, 5.5)).toBe(1)
})

test('counts Chebyshev rings out to the coast', () => {
  expect(nearestLandDist(half, 7.5, 3.5)).toBe(5)
  expect(nearestLandDist(half, 0.5, 0.5)).toBe(12)
})

test('Infinity past maxR', () => {
  expect(nearestLandDist(half, 7.5, 3.5, 4)).toBe(Infinity)
  expect(nearestLandDist(half, 7.5, 3.5, 5)).toBe(5)
})

test('Infinity on an all-ocean map', () => {
  const sea = fill(16, 16, () => TILE.OCEAN)
  expect(nearestLandDist(sea, 8.5, 8.5)).toBe(Infinity)
  expect(nearestLandDist(sea, 8.5, 8.5, 100)).toBe(Infinity)
})

test('off-map tiles are not land', () => {
  const sea = fill(4, 4, () => TILE.OCEAN)
  expect(nearestLandDist(sea, 0.5, 0.5, 3)).toBe(Infinity)
})

test('1 beside a generated coast', () => {
  const m = generateMap(123)
  const ocean = (x: number, y: number) => m.tiles[y * m.width + x] === TILE.OCEAN
  let found = false
  for (let y = 1; y < m.height - 1 && !found; y++)
    for (let x = 1; x < m.width - 1 && !found; x++)
      if (ocean(x, y) && !ocean(x + 1, y)) {
        expect(nearestLandDist(m, x + 0.5, y + 0.5)).toBe(1)
        found = true
      }
  expect(found).toBe(true)
})
