/**
 * Turns score data into sound. Like the cue synthesizer, everything here
 * takes any BaseAudioContext: the dev hook __dbg.renderTheme renders passages
 * onto an OfflineAudioContext, and tests/music.test.ts checks the scheduler
 * against a stub context.
 */
import type { ScoreNote, Theme } from './score'

export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

/** Render one note of the score at absolute context time `at`. */
export function scheduleNote(ctx: BaseAudioContext, dest: AudioNode, n: ScoreNote, at: number, spb: number): void {
  const dur = n.dur * spb
  const hz = midiHz(n.midi)
  switch (n.voice) {
    case 'pluck': {
      // two slightly-detuned triangles with a fast pick and quick die-away
      for (const [cents, g] of [[0, 1], [7, 0.4]] as const) {
        const o = ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.setValueAtTime(hz * Math.pow(2, cents / 1200), at)
        const e = ctx.createGain()
        e.gain.setValueAtTime(0, at)
        e.gain.linearRampToValueAtTime(n.gain * g, at + 0.008)
        e.gain.exponentialRampToValueAtTime(0.001, at + Math.min(0.6, dur + 0.15))
        o.connect(e)
        e.connect(dest)
        o.start(at)
        o.stop(at + dur + 0.3)
      }
      break
    }
    case 'bass': {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(hz, at)
      const e = ctx.createGain()
      e.gain.setValueAtTime(0, at)
      e.gain.linearRampToValueAtTime(n.gain, at + 0.03)
      e.gain.setValueAtTime(n.gain, at + Math.max(0.03, dur * 0.6))
      e.gain.exponentialRampToValueAtTime(0.001, at + dur)
      o.connect(e)
      e.connect(dest)
      o.start(at)
      o.stop(at + dur + 0.1)
      break
    }
    case 'flute': {
      // breathy sine with a touch of vibrato
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(hz, at)
      const lfo = ctx.createOscillator()
      lfo.frequency.setValueAtTime(5.2, at)
      const lfoGain = ctx.createGain()
      lfoGain.gain.setValueAtTime(hz * 0.004, at)
      lfo.connect(lfoGain)
      lfoGain.connect(o.frequency)
      const e = ctx.createGain()
      e.gain.setValueAtTime(0, at)
      e.gain.linearRampToValueAtTime(n.gain, at + 0.05)
      e.gain.setValueAtTime(n.gain, at + Math.max(0.05, dur - 0.12))
      e.gain.linearRampToValueAtTime(0, at + dur)
      o.connect(e)
      e.connect(dest)
      o.start(at)
      o.stop(at + dur + 0.1)
      lfo.start(at)
      lfo.stop(at + dur + 0.1)
      break
    }
    case 'bell': {
      // fundamental plus an inharmonic upper partial, ringing out
      for (const [mul, g] of [[1, 1], [2.4, 0.3]] as const) {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.setValueAtTime(hz * mul, at)
        const e = ctx.createGain()
        e.gain.setValueAtTime(0, at)
        e.gain.linearRampToValueAtTime(n.gain * g, at + 0.006)
        e.gain.exponentialRampToValueAtTime(0.001, at + Math.max(0.8, dur))
        o.connect(e)
        e.connect(dest)
        o.start(at)
        o.stop(at + Math.max(0.8, dur) + 0.1)
      }
      break
    }
    default: {
      const _exhaustive: never = n.voice
      return _exhaustive
    }
  }
}

/**
 * Schedule every note of a looping theme whose absolute start time falls in
 * [from, to). `themeStart` anchors beat zero of loop zero. Returns `to`, the
 * new scheduled-until watermark. Works on offline contexts for testing.
 */
export function scheduleThemeWindow(
  ctx: BaseAudioContext,
  dest: AudioNode,
  theme: Theme,
  themeStart: number,
  from: number,
  to: number,
): number {
  const spb = 60 / theme.bpm
  const loopDur = theme.beats * spb
  let li = Math.max(0, Math.floor((from - themeStart) / loopDur))
  for (; themeStart + li * loopDur < to; li++) {
    const base = themeStart + li * loopDur
    for (const n of theme.notes) {
      const at = base + n.t * spb
      if (at >= from && at < to) scheduleNote(ctx, dest, n, at, spb)
    }
  }
  return to
}
