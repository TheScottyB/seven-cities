import { describe, expect, it } from 'vitest'
import { musicFor, buildTheme, type ThemeId } from '../src/audio/score'

const snap = (screen: string, won = false, lost = false) => ({ screen, won, lost })
const pcs = (id: ThemeId) => new Set(buildTheme(id).notes.map((n) => n.midi % 12))

describe('which piece the moment calls for', () => {
  it('the title theme carries from the chart table to the outfitter', () => {
    expect(musicFor(snap('start'))).toBe('title')
    expect(musicFor(snap('outfit'))).toBe('title')
  })
  it('the harbor motif greets every return to Spain', () => {
    expect(musicFor(snap('spain'))).toBe('spain')
  })
  it('the New World itself is unscored — ambience owns the wilderness', () => {
    expect(musicFor(snap('playing'))).toBeNull()
    expect(musicFor(snap('walkin'))).toBeNull()
  })
  it('the end of an expedition gets a hymn or a lament', () => {
    expect(musicFor(snap('over', true))).toBe('victory')
    expect(musicFor(snap('over', false, true))).toBe('lament')
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
