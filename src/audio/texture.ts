/**
 * One-shot ambient textures: the creak of a hull, a rigging clang, a gull,
 * a wave swell, a drone note, the low pulse of approaching danger. Like the
 * cue and score synths, everything renders onto any BaseAudioContext so
 * the dev hook __dbg.renderTexture can measure the actual signal.
 */
import { midiHz } from './music'

export type TextureKind = 'creak' | 'clang' | 'gull' | 'swell' | 'pad' | 'pulse'

export interface TextureOpts {
  /** overall level multiplier */
  gain?: number
  /** -1..1 pitch/character variation so no two firings match */
  vary?: number
  /** pad only: which note to drone on */
  midi?: number
  /** pad only: seconds to hold */
  dur?: number
}

const noiseCache = new WeakMap<BaseAudioContext, { buf: AudioBuffer; samples: number }>()

/**
 * Deterministic white noise, cached per AudioContext so repeated textures and
 * cues reuse one buffer instead of allocating and filling tens of thousands of
 * samples on each firing. Because the LCG always starts from the same seed,
 * every prefix is bit-identical to a fresh buffer of that length.
 */
export function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const needed = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const cached = noiseCache.get(ctx)
  if (cached && cached.samples >= needed) return cached.buf
  const samples = Math.max(needed, Math.floor(ctx.sampleRate * 4))
  const buf = ctx.createBuffer(1, samples, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let s = 1234567
  for (let i = 0; i < d.length; i++) {
    // tiny deterministic LCG so offline renders are reproducible
    s = (s * 1664525 + 1013904223) >>> 0
    d[i] = (s / 4294967296) * 2 - 1
  }
  noiseCache.set(ctx, { buf, samples })
  return buf
}

function osc(
  ctx: BaseAudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  at: number,
  attack: number,
  hold: number,
  release: number,
  peak: number,
): OscillatorNode {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  const e = ctx.createGain()
  e.gain.setValueAtTime(0, at)
  e.gain.linearRampToValueAtTime(peak, at + attack)
  e.gain.setValueAtTime(peak, at + attack + hold)
  e.gain.exponentialRampToValueAtTime(0.001, at + attack + hold + release)
  o.connect(e)
  e.connect(dest)
  o.start(at)
  o.stop(at + attack + hold + release + 0.1)
  return o
}

function filteredNoise(
  ctx: BaseAudioContext,
  dest: AudioNode,
  at: number,
  dur: number,
  peak: number,
  type: BiquadFilterType,
  hz: number,
  q: number,
  attack = 0.02,
): void {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, dur + 0.3)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(hz, at)
  f.Q.setValueAtTime(q, at)
  const e = ctx.createGain()
  e.gain.setValueAtTime(0, at)
  e.gain.linearRampToValueAtTime(peak, at + attack)
  e.gain.exponentialRampToValueAtTime(0.001, at + dur)
  src.connect(f)
  f.connect(e)
  e.connect(dest)
  src.start(at)
  src.stop(at + dur + 0.3)
}

export function synthTexture(
  ctx: BaseAudioContext,
  dest: AudioNode,
  kind: TextureKind,
  at: number,
  opts: TextureOpts = {},
): void {
  const g = opts.gain ?? 1
  const v = opts.vary ?? 0
  switch (kind) {
    case 'creak': {
      // old timber leaning: a groaning band of noise over a low fibre tone
      filteredNoise(ctx, dest, at, 0.55, 0.22 * g, 'bandpass', 150 * (1 + 0.4 * v), 7, 0.16)
      osc(ctx, dest, 'sine', 72 * (1 + 0.3 * v), at + 0.04, 0.12, 0.1, 0.3, 0.1 * g)
      break
    }
    case 'clang': {
      // rigging iron: inharmonic partials with a hard strike
      const f0 = 880 * (1 + 0.3 * v)
      for (const [mul, pg] of [[1, 1], [2.76, 0.5], [5.4, 0.22]] as const) {
        osc(ctx, dest, 'sine', f0 * mul, at, 0.004, 0, 0.45, 0.09 * g * pg)
      }
      filteredNoise(ctx, dest, at, 0.05, 0.1 * g, 'highpass', 2500, 0.7, 0.004)
      break
    }
    case 'gull': {
      // kee-aw: a sawtooth that leaps up and falls away, echoed once
      for (const [dt, eg] of [[0, 1], [0.5, 0.55]] as const) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        const f = 950 * (1 + 0.2 * v)
        o.frequency.setValueAtTime(f, at + dt)
        o.frequency.exponentialRampToValueAtTime(f * 1.45, at + dt + 0.09)
        o.frequency.exponentialRampToValueAtTime(f * 0.68, at + dt + 0.32)
        const e = ctx.createGain()
        e.gain.setValueAtTime(0, at + dt)
        e.gain.linearRampToValueAtTime(0.055 * g * eg, at + dt + 0.03)
        e.gain.exponentialRampToValueAtTime(0.001, at + dt + 0.36)
        o.connect(e)
        e.connect(dest)
        o.start(at + dt)
        o.stop(at + dt + 0.45)
      }
      break
    }
    case 'swell': {
      // one wave gathering and letting go under the hull
      filteredNoise(ctx, dest, at, 2.2, 0.2 * g, 'lowpass', 420 * (1 + 0.5 * v), 0.6, 0.7)
      break
    }
    case 'pad': {
      // a soft drone note: two detuned triangles and a sub, slow to bloom
      const midi = opts.midi ?? 57
      const dur = opts.dur ?? 4
      const hz = midiHz(midi)
      for (const [cents, pg] of [[-4, 1], [5, 0.8]] as const) {
        osc(ctx, dest, 'triangle', hz * Math.pow(2, cents / 1200), at, dur * 0.35, dur * 0.3, dur * 0.35, 0.055 * g * pg)
      }
      osc(ctx, dest, 'sine', hz / 2, at, dur * 0.4, dur * 0.25, dur * 0.35, 0.04 * g)
      break
    }
    case 'pulse': {
      // da-dum: the heart notices before the eyes do
      osc(ctx, dest, 'sine', 55, at, 0.012, 0.03, 0.14, 0.3 * g)
      osc(ctx, dest, 'sine', 50, at + 0.22, 0.012, 0.02, 0.12, 0.21 * g)
      break
    }
  }
}
