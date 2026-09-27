import { describe, expect, it } from 'vitest'
import { scheduleNote, scheduleThemeWindow } from '../src/audio/music'
import { buildTheme, type ThemeId } from '../src/audio/score'

/** An AudioParam that remembers the last value set, so a start can be tagged with its pitch. */
function param() {
  const p = {
    value: 0,
    setValueAtTime(v: number) {
      p.value = v
      return p
    },
    linearRampToValueAtTime: () => p,
    exponentialRampToValueAtTime: () => p,
    setTargetAtTime: () => p,
  }
  return p
}

/** A BaseAudioContext stand-in that records every oscillator start as `time|hz`. */
function stubCtx() {
  const starts: string[] = []
  const node = () => ({ connect: () => {}, disconnect: () => {} })
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    createGain: () => ({ ...node(), gain: param() }),
    createOscillator: () => {
      const o = {
        ...node(),
        type: 'sine',
        frequency: param(),
        detune: param(),
        start: (at = 0) => void starts.push(`${at}|${o.frequency.value}`),
        stop: () => {},
      }
      return o
    },
  }
  return { ctx: ctx as unknown as BaseAudioContext, dest: node() as unknown as AudioNode, starts }
}

const START = 0.15 // the live player's lead-in

/** Every note of `loops` loops scheduled one by one, at base + n.t * spb. */
function reference(id: ThemeId, loops: number): string[] {
  const theme = buildTheme(id)
  const spb = 60 / theme.bpm
  const loopDur = theme.beats * spb
  const { ctx, dest, starts } = stubCtx()
  for (let li = 0; li < loops; li++) {
    const base = START + li * loopDur
    for (const n of theme.notes) scheduleNote(ctx, dest, n, base + n.t * spb, spb)
  }
  return starts.sort()
}

/** The same span pumped through scheduleThemeWindow over consecutive [edges[i], edges[i+1]) windows. */
function windowed(id: ThemeId, edges: number[]): string[] {
  const theme = buildTheme(id)
  const { ctx, dest, starts } = stubCtx()
  let until = edges[0]
  for (let i = 1; i < edges.length; i++) {
    until = scheduleThemeWindow(ctx, dest, theme, START, until, edges[i])
    expect(until).toBe(edges[i])
  }
  return starts.sort()
}

/** Window edges from START to `end`, stepping by `step`, the last clipped to `end`. */
function steps(step: number, end: number): number[] {
  const edges = [START]
  while (edges[edges.length - 1] < end) edges.push(Math.min(edges[edges.length - 1] + step, end))
  return edges
}

describe('scheduleThemeWindow', () => {
  const theme = buildTheme('title')
  const loopDur = theme.beats * (60 / theme.bpm)
  const end = START + 2 * loopDur
  const expected = reference('title', 2)

  it('the reference covers two full loops of the title theme', () => {
    expect(theme.notes.length).toBeGreaterThan(0)
    expect(expected.length).toBeGreaterThanOrEqual(2 * theme.notes.length)
  })

  it('one window over both loops starts every note exactly once', () => {
    expect(windowed('title', [START, end])).toEqual(expected)
  })

  it('windows that land exactly on the loop seam start every note exactly once', () => {
    expect(windowed('title', [START, START + loopDur, end])).toEqual(expected)
    expect(windowed('title', [START, START + loopDur / 2, START + loopDur, START + 1.5 * loopDur, end])).toEqual(
      expected,
    )
  })

  for (const step of [1.2, 0.3, 0.713, 0.0625, loopDur / 7, loopDur * 0.9]) {
    it(`${step.toFixed(4)}s windows start every note exactly once across the seam`, () => {
      expect(windowed('title', steps(step, end))).toEqual(expected)
    })
  }

  it('an empty window schedules nothing and keeps the watermark', () => {
    const { ctx, dest, starts } = stubCtx()
    expect(scheduleThemeWindow(ctx, dest, theme, START, 3, 3)).toBe(3)
    expect(starts).toEqual([])
  })
})
