import { describe, expect, it } from 'vitest'
import { musicFor, buildTheme, type ThemeId } from '../src/audio/score'
import type { Screen } from '../src/game/screen'

const pcs = (id: ThemeId) => new Set(buildTheme(id).notes.map((n) => n.midi % 12))

describe('which piece the moment calls for', () => {
  it('the score belongs to the opening title alone', () => {
    expect(musicFor('start')).toBe('title')
  })
  it('everywhere else, the world speaks for itself', () => {
    const others: Screen[] = ['outfit', 'spain', 'playing', 'walkin', 'over']
    for (const screen of others) expect(musicFor(screen)).toBeNull()
  })
})

describe('the score itself', () => {
  const ids: ThemeId[] = ['title', 'spain', 'victory', 'lament']

  it('every theme is structurally sound: notes inside the loop, sane ranges', () => {
    for (const id of ids) {
      const t = buildTheme(id)
      expect(t.notes.length).toBeGreaterThan(6)
      expect(t.beats).toBeGreaterThan(0)
      expect(t.bpm).toBeGreaterThanOrEqual(40)
      expect(t.bpm).toBeLessThanOrEqual(160)
      for (const n of t.notes) {
        expect(n.t).toBeGreaterThanOrEqual(0)
        expect(n.t).toBeLessThan(t.beats)
        expect(n.dur).toBeGreaterThan(0)
        expect(n.midi).toBeGreaterThan(30)
        expect(n.midi).toBeLessThan(96)
        expect(n.gain).toBeGreaterThan(0)
        expect(n.gain).toBeLessThanOrEqual(1)
      }
    }
  })

  it('the title stays in E Phrygian dominant — G# sting included, no strays', () => {
    const allowed = new Set([0, 2, 4, 5, 7, 8, 9, 11]) // E F G G# A B C D
    for (const pc of pcs('title')) expect(allowed).toContain(pc)
    expect(pcs('title')).toContain(8) // the flamenco G#
  })

  it('the harbor motif is G major in triple time', () => {
    const t = buildTheme('spain')
    expect(t.beats % 3).toBe(0)
    const allowed = new Set([7, 9, 11, 0, 2, 4, 6]) // G A B C D E F#
    for (const pc of pcs('spain')) expect(allowed).toContain(pc)
  })

  it('victory rings in unclouded C major', () => {
    const allowed = new Set([0, 2, 4, 5, 7, 9, 11])
    for (const pc of pcs('victory')) expect(allowed).toContain(pc)
  })

  it('the lament moves slow and sparse', () => {
    const t = buildTheme('lament')
    expect(t.bpm).toBeLessThan(80)
    expect(t.notes.length).toBeLessThan(20)
  })
})
