import { generateMap } from '../src/world/mapgen'
import { placeVillages, nearestUnvisitedGolden, reachableFromLanding } from '../src/world/villages'
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

test('nearestUnvisitedGolden skips visited and non-golden villages', () => {
  const m = generateMap(123)
  const vs = placeVillages(m, 28)
  const golden = vs.filter((v) => v.golden)
  const target = nearestUnvisitedGolden(vs, golden[0].x, golden[0].y)
  expect(target).toBe(golden[0]) // standing on it → it's the nearest

  golden[0].visited = true
  const next = nearestUnvisitedGolden(vs, golden[0].x, golden[0].y)
  expect(next).not.toBe(golden[0])
  expect(next?.golden).toBe(true)

  for (const g of golden) g.visited = true
  expect(nearestUnvisitedGolden(vs, 0, 0)).toBeNull()
})

test('every village is walk-reachable from the landing point (many seeds)', () => {
  // guards against unwinnable maps: a City of Gold stranded across water
  // can never be reached on foot
  for (const seed of [1, 2, 123, 999, 31415]) {
    const m = generateMap(seed)
    const reach = reachableFromLanding(m)
    const vs = placeVillages(m, 28)
    expect(vs.length).toBeGreaterThanOrEqual(20)
    for (const v of vs) {
      expect(reach[v.y * m.width + v.x]).toBe(1)
    }
  }
})

test('the default map fits close to the requested village count', () => {
  // guards against the map being too small/dense to place enough villages
  // (28 is the count main.ts requests)
  const m = generateMap(123)
  const vs = placeVillages(m, 28)
  expect(vs.length).toBeGreaterThanOrEqual(24)
  expect(vs.filter((v) => v.golden).length).toBe(7)
})
