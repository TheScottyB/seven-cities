import { generateMap } from '../src/world/mapgen'
import { placeVillages, nearestUnvisitedGolden, reachableAmphibious, CITIES_OF_GOLD } from '../src/world/villages'
import { findMooring, findMoorings } from '../src/game/ship'
import { isWalkable, TILE } from '../src/world/tiles'
import { seedFromString } from '../src/world/rng'

test('places villages on walkable land', () => {
  const m = generateMap(123)
  const vs = placeVillages(m, 20)
  for (const v of vs) expect(isWalkable(m.tiles[v.y * m.width + v.x])).toBe(true)
})

test('villages never sit on a river tile', () => {
  for (const seed of [123, 1, 999]) {
    const m = generateMap(seed)
    for (const v of placeVillages(m, 28)) {
      expect(m.tiles[v.y * m.width + v.x]).not.toBe(TILE.RIVER)
    }
  }
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

test('every map is winnable: no village hides in a sea the fleet cannot reach', () => {
  // regression: seed "12" used to place a City of Gold on an island in an
  // eastern ocean basin disconnected from the fleet's home sea — unwinnable,
  // since a ship can never portage between basins. Checked here with an
  // independent flood of the reachability rule, seeded from the real mooring.
  const seeds = [
    ...Array.from({ length: 100 }, (_, i) => String(i + 1)),
    '12', '1492', '9', '26',
    '2024', '5000', '8191', '11491',
  ]
  for (const seedStr of seeds) {
    const m = generateMap(seedFromString(seedStr))
    const { width: W, height: H, tiles, landing } = m
    const idx = (x: number, y: number) => y * W + x

    // flood the home sea from the fleet's first mooring
    const s0 = findMooring(m)
    const start = idx(Math.floor(s0.x), Math.floor(s0.y))
    expect(tiles[start], seedStr).toBe(TILE.OCEAN)
    const mainSea = new Uint8Array(W * H)
    const q = [start]
    mainSea[start] = 1
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi]
      const x = i % W
      const y = (i / W) | 0
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const j = idx(nx, ny)
        if (!mainSea[j] && tiles[j] === TILE.OCEAN) {
          mainSea[j] = 1
          q.push(j)
        }
      }
    }

    // every ship of the largest fleet moors in that same sea — never the
    // on-land fallback, never a separate basin
    for (const sh of findMoorings(m, 4)) {
      const i = idx(Math.floor(sh.x), Math.floor(sh.y))
      expect(tiles[i], seedStr).toBe(TILE.OCEAN)
      expect(mainSea[i], seedStr).toBe(1)
    }

    // expedition reach: walk anywhere on land, sail only the home sea,
    // board/land freely where land meets that sea
    const reach = new Uint8Array(W * H)
    const q2 = [idx(landing.x, landing.y)]
    reach[q2[0]] = 1
    for (let qi = 0; qi < q2.length; qi++) {
      const i = q2[qi]
      const x = i % W
      const y = (i / W) | 0
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const j = idx(nx, ny)
        if (reach[j]) continue
        if (isWalkable(tiles[j]) || mainSea[j] === 1) {
          reach[j] = 1
          q2.push(j)
        }
      }
    }

    const vs = placeVillages(m, 28)
    expect(vs.length, seedStr).toBeGreaterThanOrEqual(20)
    expect(vs.filter((v) => v.golden).length, seedStr).toBe(CITIES_OF_GOLD)
    for (const v of vs) expect(reach[idx(v.x, v.y)], seedStr).toBe(1)
  }
}, 20_000)

test('every village is amphibious-reachable from the landing (many seeds)', () => {
  // guards against unwinnable maps: with the ship, reachable means some mix
  // of walking and sailing gets there — only mountain rings could strand a
  // village, and placement rejects those tiles
  for (const seed of [1, 2, 123, 999, 31415]) {
    const m = generateMap(seed)
    const reach = reachableAmphibious(m)
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
