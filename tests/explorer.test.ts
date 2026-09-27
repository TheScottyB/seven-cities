import { generateMap, type GameMap } from '../src/world/mapgen'
import { makeExplorer, moveExplorer, Facing, GAIT_CYCLE, GAIT_RATE } from '../src/game/explorer'
import { isWalkable, TILE } from '../src/world/tiles'

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

test('facing follows the displacement, not the input', () => {
  const m = generateMap(123)
  const e = makeExplorer(m)
  // From the centre of the walkable landing tile, a step this short (at most
  // 8 * 1.8 * 0.02 < 0.5 tiles) never leaves the tile, so every move lands.
  const cases: [number, number, number][] = [
    [1, 0, Facing.E],
    [-1, 0, Facing.W],
    [0, 1, Facing.S],
    [0, -1, Facing.N],
  ]
  for (const [dx, dy, facing] of cases) {
    e.x = m.landing.x + 0.5
    e.y = m.landing.y + 0.5
    moveExplorer(m, e, dx, dy, 0.02)
    expect(e.moving).toBe(true)
    expect(e.facing).toBe(facing)
  }
})

test('standing still clears moving and leaves gait alone', () => {
  const m = generateMap(123)
  const e = makeExplorer(m)
  moveExplorer(m, e, 1, 0, 0.05)
  const g = e.gait
  moveExplorer(m, e, 0, 0, 0.05)
  expect(e.moving).toBe(false)
  expect(e.gait).toBe(g)
})

/**
 * A walkable tile with a mountain directly to its east, if the map has one.
 * With `openSouth`, the tile below must be walkable too.
 */
function mountainWall(m: GameMap, openSouth = false): { x: number; y: number } | null {
  for (let y = 1; y < m.height - 1; y++) {
    for (let x = 1; x < m.width - 2; x++) {
      if (!isWalkable(m.tiles[y * m.width + x])) continue
      if (openSouth && !isWalkable(m.tiles[(y + 1) * m.width + x])) continue
      if (m.tiles[y * m.width + x + 1] === TILE.MOUNTAIN) return { x, y }
    }
  }
  return null
}

test('walking into a mountain leaves gait unchanged — he stops mid-stride', () => {
  const m = generateMap(123)
  const wall = mountainWall(m)
  expect(wall).not.toBeNull()
  const e = makeExplorer(m)
  e.x = wall!.x + 0.99
  e.y = wall!.y + 0.5
  e.gait = 3.5
  const before = e.gait
  for (let i = 0; i < 20; i++) moveExplorer(m, e, 1, 0, 0.05)
  expect(e.moving).toBe(false)
  expect(e.gait).toBe(before)
})

test('pushing diagonally into a wall slides along it and faces the slide', () => {
  const m = generateMap(123)
  const wall = mountainWall(m, true)
  expect(wall).not.toBeNull()
  const e = makeExplorer(m)
  e.x = wall!.x + 0.99
  e.y = wall!.y + 0.2
  moveExplorer(m, e, 1, 1, 0.05)
  expect(e.x).toBe(wall!.x + 0.99)
  expect(e.moving).toBe(true)
  expect(e.facing).toBe(Facing.S)
})

test('gait wrap is commensurate with the 4-frame walk cycle', () => {
  // floor(gait * GAIT_RATE) & 3 must land back on frame 0 at the wrap
  expect((GAIT_CYCLE * GAIT_RATE) % 4).toBe(0)
})
