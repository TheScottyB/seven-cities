import { describe, expect, test } from 'vitest'
import {
  GOLDEN_CITY_NAMES,
  villageName,
  bearingAndLeagues,
  rumorLine,
  cityFoundToast,
  courtRemark,
} from '../src/game/lore'
import { CITIES_OF_GOLD, type Village } from '../src/world/villages'

function mkVillage(over: Partial<Village> = {}): Village {
  return {
    x: 20,
    y: 30,
    wealth: 200,
    temperament: 0.5,
    population: 120,
    golden: false,
    visited: false,
    depleted: false,
    ...over,
  }
}

describe('lore & 1984 navigation helpers', () => {
  test('all 7 golden cities receive distinct gold-tone titles', () => {
    const goldens = Array.from({ length: CITIES_OF_GOLD }, (_, i) => mkVillage({ x: i * 10, y: 5, golden: true }))
    const names = goldens.map((v) => villageName(v, goldens))
    expect(names).toEqual([...GOLDEN_CITY_NAMES])
    expect(new Set(names).size).toBe(CITIES_OF_GOLD)
  })

  test('regular villages receive deterministic names by coordinate', () => {
    const a = mkVillage({ x: 14, y: 22 })
    const b = mkVillage({ x: 14, y: 22 })
    expect(villageName(a, [a])).toBe(villageName(b, [b]))
    expect(villageName(a, [a]).length).toBeGreaterThan(2)
  })

  test('bearingAndLeagues covers all 8 compass winds accurately', () => {
    expect(bearingAndLeagues(10, 10, 20, 10).wind).toBe('EAST')
    expect(bearingAndLeagues(10, 10, 20, 20).wind).toBe('SOUTHEAST')
    expect(bearingAndLeagues(10, 10, 10, 20).wind).toBe('SOUTH')
    expect(bearingAndLeagues(10, 10, 0, 20).wind).toBe('SOUTHWEST')
    expect(bearingAndLeagues(10, 10, 0, 10).wind).toBe('WEST')
    expect(bearingAndLeagues(10, 10, 0, 0).wind).toBe('NORTHWEST')
    expect(bearingAndLeagues(10, 10, 10, 0).wind).toBe('NORTH')
    expect(bearingAndLeagues(10, 10, 20, 0).wind).toBe('NORTHEAST')
    expect(bearingAndLeagues(10, 10, 20, 10).leagues).toBe(15)
  })

  test('rumorLine includes bearing, leagues, and shrubbery humor', () => {
    const line = rumorLine({ x: 10, y: 20 }, { x: 20, y: 10 })
    expect(line).toContain('NORTHEAST')
    expect(line).toContain('leagues')
    expect(line).toContain('six or seven')
  })

  test('cityFoundToast celebrates the 6th and 7th six-seven milestones', () => {
    expect(cityFoundToast('Cibola (14k Gold-Tone)', 1)).toContain('1 of 7')
    expect(cityFoundToast('Chicora (Polished Pyrite Plaza)', 6)).toContain('6... 7!')
    expect(cityFoundToast('Norumbega (Certified Gold-Tone)', 7)).toContain('SIX-SEVEN!')
  })

  test('courtRemark varies by promotion, empty hold, and voyage count', () => {
    expect(courtRemark({ banked: 1500, voyages: 1 }, 1500, true)).toContain('6 out of 7')
    expect(courtRemark({ banked: 0, voyages: 1 }, 0, false)).toContain('shrubbery')
    expect(courtRemark({ banked: 400, voyages: 1 }, 400, false)).toContain('Nobody expects')
    expect(courtRemark({ banked: 800, voyages: 2 }, 400, false)).toContain('silly place')
  })
})
