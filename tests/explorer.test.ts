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
  // walk east until something actually moves, then check where he is looking
  moveExplorer(m, e, 1, 0, 0.05)
  if (e.moving) expect(e.facing).toBe(Facing.E)
  moveExplorer(m, e, -1, 0, 0.05)
  if (e.moving) expect(e.facing).toBe(Facing.W)
  moveExplorer(m, e, 0, 1, 0.05)
  if (e.moving) expect(e.facing).toBe(Facing.S)
  moveExplorer(m, e, 0, -1, 0.05)
  if (e.moving) expect(e.facing).toBe(Facing.N)
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

/** A walkable tile with a mountain directly to its east, if the map has one. */
function mountainWall(m: GameMap): { x: number; y: number } | null {
  for (let y = 1; y < m.height - 1; y++) {
    for (let x = 1; x < m.width - 2; x++) {
      if (!isWalkable(m.tiles[y * m.width + x])) continue
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

test('gait wrap is commensurate with the 4-frame walk cycle', () => {
  // floor(gait * GAIT_RATE) & 3 must land back on frame 0 at the wrap
  expect((GAIT_CYCLE * GAIT_RATE) % 4).toBe(0)
})
