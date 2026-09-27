import { generateMap } from '../src/world/mapgen'
import { findMooring, moveShip, landingSpots, type Ship } from '../src/game/ship'
import { TILE, isWalkable } from '../src/world/tiles'

test('mooring is an ocean tile near the landing', () => {
  const m = generateMap(123)
  const s = findMooring(m)
  expect(m.tiles[Math.floor(s.y) * m.width + Math.floor(s.x)]).toBe(TILE.OCEAN)
  expect(Math.hypot(s.x - m.landing.x, s.y - m.landing.y)).toBeLessThan(6)
})

test('ship sails on ocean and cannot run aground', () => {
  const m = generateMap(123)
  const s = findMooring(m)
  const ship = { x: s.x, y: s.y }
  // sail hard east (toward the coast) for a long time
  for (let i = 0; i < 2000; i++) moveShip(m, ship, 1, 0, 0.1)
  const t = m.tiles[Math.floor(ship.y) * m.width + Math.floor(ship.x)]
  expect(t).toBe(TILE.OCEAN)
})

test('ship stays within map bounds', () => {
  const m = generateMap(123)
  const s = findMooring(m)
  const ship = { x: s.x, y: s.y }
  for (let i = 0; i < 5000; i++) moveShip(m, ship, -1, -1, 0.5)
  expect(ship.x).toBeGreaterThanOrEqual(0)
  expect(ship.y).toBeGreaterThanOrEqual(0)
})

test('landingSpots finds adjacent walkable land from a coastal ship', () => {
  const m = generateMap(123)
  const s = findMooring(m) // moored beside the landing beach
  const spots = landingSpots(m, s.x, s.y)
  expect(spots.length).toBeGreaterThan(0)
  for (const [x, y] of spots) {
    expect(isWalkable(m.tiles[y * m.width + x])).toBe(true)
  }
})

test('landingSpots is empty in open ocean', () => {
  const m = generateMap(123)
  // the map's west edge is forced deep ocean
  const spots = landingSpots(m, 1.5, Math.floor(m.height / 2) + 0.5)
  expect(spots.length).toBe(0)
})

test('a bare restored ship picks up sprite fields from drift alone', () => {
  const m = generateMap(123)
  // the map's west edge is forced deep ocean; saves restore ships as bare {x, y}
  const bare: Ship = { x: 1.5, y: Math.floor(m.height / 2) + 0.5 }
  moveShip(m, bare, 0, 0, 0.1, 1, 0, 2) // no helm, a squall pushing south
  expect(bare.moving).toBe(true)
  expect(bare.facing).toBeDefined()
  expect(Number.isFinite(bare.gait)).toBe(true)
})
