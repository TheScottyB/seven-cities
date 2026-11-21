import { describe, expect, test } from 'vitest'
import { generateMap } from '../src/world/mapgen'
import { seedFromString } from '../src/world/rng'
import { findLandmarks, checkDiscoveries, DISCOVERY_RADIUS } from '../src/game/discoveries'

describe('1984 geographic landmark discoveries', () => {
  test('findLandmarks is deterministic and places 5-7 distinct, spaced, in-bounds landmarks', () => {
    for (const s of ['1492', '1519', '6767', '42']) {
      const m = generateMap(seedFromString(s))
      const a = findLandmarks(m)
      const b = findLandmarks(m)
      expect(a, s).toEqual(b)
      expect(a.length, s).toBeGreaterThanOrEqual(5)
      expect(a.length, s).toBeLessThanOrEqual(7)
      expect(new Set(a.map((l) => l.name)).size, s).toBe(a.length)
      for (const l of a) {
        expect(l.x).toBeGreaterThanOrEqual(0)
        expect(l.x).toBeLessThan(m.width)
        expect(l.y).toBeGreaterThanOrEqual(0)
        expect(l.y).toBeLessThan(m.height)
      }
      for (let i = 0; i < a.length; i++) {
        for (let j = i + 1; j < a.length; j++) {
          expect(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y)).toBeGreaterThanOrEqual(18)
        }
      }
    }
  })

  test('checkDiscoveries charts landmarks within DISCOVERY_RADIUS exactly once', () => {
    const m = generateMap(seedFromString('1492'))
    const landmarks = findLandmarks(m)
    const discovered = new Set<number>()
    const first = landmarks[0]

    // far away: nothing discovered
    expect(checkDiscoveries(landmarks, discovered, first.x + DISCOVERY_RADIUS + 5, first.y)).toEqual([])
    expect(discovered.size).toBe(0)

    // within radius: discovered once
    const found = checkDiscoveries(landmarks, discovered, first.x + 1, first.y + 1)
    expect(found).toEqual([first])
    expect(discovered.has(first.id)).toBe(true)

    // checking again at the same spot returns empty
    expect(checkDiscoveries(landmarks, discovered, first.x + 1, first.y + 1)).toEqual([])
  })
})
