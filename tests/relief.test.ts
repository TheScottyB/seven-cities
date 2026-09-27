import { describe, expect, it } from 'vitest'
import { generateMap } from '../src/world/mapgen'
import { TILE } from '../src/world/tiles'
import { DEPTH_RAMP } from '../src/art/tileset'
import {
  buildDepthBands,
  buildHillshade,
  buildDecorMap,
  buildTileBase,
  framesFor,
  tileIndex,
  DECORS,
  PHASES,
  SHADES,
} from '../src/art/relief'

const map = generateMap(12, 96, 96)

describe('the sea reads its own depth', () => {
  const band = buildDepthBands(map)

  it('shallows hug the shore and the open ocean runs deep', () => {
    let coastal = 0
    let deep = 0
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        const i = y * map.width + x
        if (map.tiles[i] !== TILE.OCEAN) continue
        const touchesLand =
          map.tiles[i - 1] !== TILE.OCEAN ||
          map.tiles[i + 1] !== TILE.OCEAN ||
          map.tiles[i - map.width] !== TILE.OCEAN ||
          map.tiles[i + map.width] !== TILE.OCEAN
        if (touchesLand) {
          expect(band[i]).toBe(0)
          coastal++
        }
        if (band[i] === 3) deep++
      }
    }
    expect(coastal).toBeGreaterThan(20)
    expect(deep).toBeGreaterThan(20)
  })

  it('land carries no depth at all', () => {
    for (let i = 0; i < band.length; i++) {
      if (map.tiles[i] !== TILE.OCEAN) expect(band[i]).toBe(0)
    }
  })

  it('depth never exceeds the band count', () => {
    for (let i = 0; i < band.length; i++) expect(band[i]).toBeLessThan(SHADES[TILE.OCEAN])
  })

  it('has one ramp colour per depth band', () => {
    expect(DEPTH_RAMP.length).toBe(SHADES[TILE.OCEAN])
  })
})

describe('relief on the cordillera', () => {
  it('shades only the uplands — terrain identity stays colour-invariant', () => {
    const hill = buildHillshade(map)
    for (let i = 0; i < hill.length; i++) {
      const t = map.tiles[i]
      if (t !== TILE.HIGHLAND && t !== TILE.MOUNTAIN) expect(hill[i]).toBe(0)
      else expect(hill[i]).toBeLessThan(SHADES[TILE.MOUNTAIN])
    }
  })

  it('gives the uplands at least one shade slot', () => {
    expect(SHADES[TILE.HIGHLAND]).toBeGreaterThanOrEqual(1)
    expect(SHADES[TILE.MOUNTAIN]).toBeGreaterThanOrEqual(1)
  })

  it('finds both lit and shadowed slopes', () => {
    const hill = buildHillshade(map)
    const seen = new Set<number>()
    for (let i = 0; i < hill.length; i++) {
      const t = map.tiles[i]
      if (t === TILE.HIGHLAND || t === TILE.MOUNTAIN) seen.add(hill[i])
    }
    expect(seen.size).toBeGreaterThan(1)
  })

})

describe('ground dressing', () => {
  const decor = buildDecorMap(map)

  it('never exceeds the dressings a terrain actually has', () => {
    for (let i = 0; i < decor.length; i++) {
      expect(decor[i]).toBeLessThan(DECORS[map.tiles[i]] ?? 1)
    }
  })

  it('leaves water bare', () => {
    for (let i = 0; i < decor.length; i++) {
      const t = map.tiles[i]
      if (t === TILE.OCEAN || t === TILE.RIVER) expect(decor[i]).toBe(0)
    }
  })

  it('is deterministic for the same world', () => {
    expect(Array.from(buildDecorMap(map))).toEqual(Array.from(decor))
  })
})

describe('the atlas index', () => {
  it('every (decor, phase, shade) lands in its own slot, and they fill the run', () => {
    for (const t of Object.values(TILE)) {
      const type = t as number
      const seen = new Set<number>()
      for (let d = 0; d < DECORS[type]; d++) {
        for (let p = 0; p < PHASES[type]; p++) {
          for (let s = 0; s < SHADES[type]; s++) {
            const idx = tileIndex(type, d, p, s)
            expect(idx).toBeGreaterThanOrEqual(0)
            expect(idx).toBeLessThan(framesFor(type))
            expect(seen.has(idx)).toBe(false)
            seen.add(idx)
          }
        }
      }
      expect(seen.size).toBe(framesFor(type))
    }
  })

  it('a tile base plus its animated phase always stays inside the atlas', () => {
    const depth = buildDepthBands(map)
    const hill = buildHillshade(map)
    const decor = buildDecorMap(map)
    const base = buildTileBase(map, depth, hill, decor)
    for (let i = 0; i < base.length; i++) {
      const t = map.tiles[i]
      for (let p = 0; p < PHASES[t]; p++) {
        const idx = base[i] + p * SHADES[t]
        expect(idx).toBeLessThan(framesFor(t))
      }
    }
  })
})
