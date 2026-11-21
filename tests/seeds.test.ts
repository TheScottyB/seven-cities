import { describe, expect, test } from 'vitest'
import { DEFAULT_SEED, SEED_PRESETS, parseSeedQuery, nextSeedPreset, presetLabel } from '../src/game/seeds'

describe('shareable seeds & presets', () => {
  test('parseSeedQuery extracts clean seeds and rejects empty/control chars', () => {
    expect(parseSeedQuery('')).toBeNull()
    expect(parseSeedQuery('?foo=bar')).toBeNull()
    expect(parseSeedQuery('?seed=')).toBeNull()
    expect(parseSeedQuery('?seed=   ')).toBeNull()
    expect(parseSeedQuery('?seed=6767')).toBe('6767')
    expect(parseSeedQuery('seed=ElDorado&mode=1')).toBe('ElDorado')
    expect(parseSeedQuery('?seed=a\u0007b\nc')).toBe('abc')
    expect(parseSeedQuery(`?seed=${'x'.repeat(50)}`)).toHaveLength(32)
  })

  test('nextSeedPreset cycles through all presets and wraps cleanly', () => {
    let cur: string = DEFAULT_SEED
    const visited = [cur]
    for (let i = 0; i < SEED_PRESETS.length; i++) {
      cur = nextSeedPreset(cur).seed
      visited.push(cur)
    }
    expect(visited[0]).toBe(visited[visited.length - 1])
    expect(new Set(visited).size).toBe(SEED_PRESETS.length)
    // unknown custom seed jumps to the first preset
    expect(nextSeedPreset('custom-99').seed).toBe(SEED_PRESETS[0].seed)
  })

  test('presetLabel names known presets and returns null for custom seeds', () => {
    expect(presetLabel('1492')).toContain('1492')
    expect(presetLabel('6767')).toContain('6767')
    expect(presetLabel('99999')).toBeNull()
  })
})
