import { generateMap } from '../src/world/mapgen'
import { placeVillages } from '../src/world/villages'
import { isWalkable } from '../src/world/tiles'

test('places villages on walkable land', () => {
  const m = generateMap(123)
  const vs = placeVillages(m, 20)
  for (const v of vs) expect(isWalkable(m.tiles[v.y * m.width + v.x])).toBe(true)
})

test('exactly 7 golden cities', () => {
  const m = generateMap(123)
  const vs = placeVillages(m, 20)
  expect(vs.filter((v) => v.golden).length).toBe(7)
})

test('villages are spaced apart (min distance)', () => {
  const m = generateMap(123)
  const vs = placeVillages(m, 20)
  for (let i = 0; i < vs.length; i++) {
    for (let j = i + 1; j < vs.length; j++) {
      const d = Math.hypot(vs[i].x - vs[j].x, vs[i].y - vs[j].y)
      expect(d).toBeGreaterThanOrEqual(8)
    }
  }
})

test('same seed → same villages', () => {
  const m = generateMap(123)
  expect(placeVillages(m, 20)).toEqual(placeVillages(m, 20))
})

test('the default map fits close to the requested village count', () => {
  // guards against the map being too small/dense to place enough villages
  // (28 is the count main.ts requests)
  const m = generateMap(123)
  const vs = placeVillages(m, 28)
  expect(vs.length).toBeGreaterThanOrEqual(24)
  expect(vs.filter((v) => v.golden).length).toBe(7)
})
