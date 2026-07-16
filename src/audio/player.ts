import type { AudioCue, CueId } from './director'

/**
 * Thin WebAudio adapter. All decisions live in the director; this file only
 * turns AudioCue data into sound. `synthesize` takes any BaseAudioContext so
 * tests can render cues on an OfflineAudioContext and assert on the signal.
 */

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const d = buf.getChannelData(0)
  let s = 1234567
  for (let i = 0; i < d.length; i++) {
    // tiny deterministic LCG so offline renders are reproducible
    s = (s * 1664525 + 1013904223) >>> 0
    d[i] = (s / 4294967296) * 2 - 1
  }
  return buf
}

function env(ctx: BaseAudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.001, at + attack + decay)
  return g
}

/**
 * Humanization for a whole cue: `detune` in cents shifts every tone together
 * (intervals stay intact), `gain` scales every peak. Defaults are neutral so
 * offline test renders stay bit-deterministic.
 */
export interface CueVoicing {
  detune?: number
  gain?: number
}

let voicing: Required<CueVoicing> = { detune: 0, gain: 1 }

function tone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  at: number,
  dur: number,
  peak: number,
): void {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq * Math.pow(2, voicing.detune / 1200), at)
  const g = env(ctx, at, peak * voicing.gain, 0.01, dur)
  o.connect(g)
  g.connect(dest)
  o.start(at)
  o.stop(at + dur + 0.1)
}

function noiseBurst(
  ctx: BaseAudioContext,
  dest: AudioNode,
  at: number,
  dur: number,
  peak: number,
  filterHz: number,
  q = 1,
): void {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, dur + 0.2)
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.setValueAtTime(filterHz, at)
  f.Q.setValueAtTime(q, at)
  const g = env(ctx, at, peak * voicing.gain, 0.02, dur)
  src.connect(f)
  f.connect(g)
  g.connect(dest)
  src.start(at)
  src.stop(at + dur + 0.2)
}

/** One-shot cues rendered onto any context — the offline-testable core. */
export function synthesize(ctx: BaseAudioContext, dest: AudioNode, id: CueId, at = 0, v: CueVoicing = {}): void {
  voicing = { detune: v.detune ?? 0, gain: v.gain ?? 1 }
  switch (id) {
    case 'trade': // two-note major pluck
      tone(ctx, dest, 'triangle', 660, at, 0.18, 0.5)
      tone(ctx, dest, 'triangle', 880, at + 0.12, 0.25, 0.5)
      break
    case 'gift': // soft ascending arpeggio
      tone(ctx, dest, 'sine', 523, at, 0.15, 0.35)
      tone(ctx, dest, 'sine', 659, at + 0.1, 0.15, 0.35)
      tone(ctx, dest, 'sine', 784, at + 0.2, 0.3, 0.35)
      break
    case 'attack': // drum thumps + noise snap
      tone(ctx, dest, 'sine', 70, at, 0.2, 0.9)
      tone(ctx, dest, 'sine', 65, at + 0.22, 0.2, 0.9)
      noiseBurst(ctx, dest, at + 0.1, 0.12, 0.5, 2500, 0.8)
      break
    case 'city-found': // rising fanfare
      tone(ctx, dest, 'square', 392, at, 0.15, 0.25)
      tone(ctx, dest, 'square', 523, at + 0.14, 0.15, 0.25)
      tone(ctx, dest, 'square', 659, at + 0.28, 0.35, 0.3)
      break
    case 'victory':
      tone(ctx, dest, 'square', 523, at, 0.2, 0.3)
      tone(ctx, dest, 'square', 659, at + 0.18, 0.2, 0.3)
      tone(ctx, dest, 'square', 784, at + 0.36, 0.2, 0.3)
      tone(ctx, dest, 'square', 1046, at + 0.54, 0.6, 0.35)
      break
    case 'defeat': // minor descent
      tone(ctx, dest, 'sawtooth', 440, at, 0.3, 0.3)
      tone(ctx, dest, 'sawtooth', 349, at + 0.3, 0.3, 0.3)
      tone(ctx, dest, 'sawtooth', 262, at + 0.6, 0.7, 0.3)
      break
    case 'board': // sail creak
      noiseBurst(ctx, dest, at, 0.3, 0.4, 300, 6)
      break
    case 'landfall': // soft surf wash
      noiseBurst(ctx, dest, at, 0.5, 0.35, 900, 0.6)
      break
    case 'storm-enter': // rising howl
      noiseBurst(ctx, dest, at, 1.2, 0.7, 500, 2)
      noiseBurst(ctx, dest, at + 0.2, 1.0, 0.5, 1200, 2)
      break
    case 'home': // warm major chord — the harbor of Palos again
      tone(ctx, dest, 'sine', 392, at, 0.8, 0.25)
      tone(ctx, dest, 'sine', 494, at + 0.05, 0.8, 0.22)
      tone(ctx, dest, 'sine', 587, at + 0.1, 0.9, 0.22)
      break
    case 'low-food': // the larder bell: two ominous low pulses
      tone(ctx, dest, 'sine', 110, at, 0.35, 0.7)
      tone(ctx, dest, 'sine', 104, at + 0.45, 0.5, 0.7)
      break
    case 'walkin-enter': // low wooden knock — you step among the huts
      tone(ctx, dest, 'sine', 180, at, 0.12, 0.4)
      tone(ctx, dest, 'sine', 140, at + 0.1, 0.15, 0.4)
      break
    case 'driven-off':
      noiseBurst(ctx, dest, at, 0.25, 0.6, 1800, 1.2)
      tone(ctx, dest, 'sawtooth', 300, at + 0.1, 0.3, 0.3)
      break
    default:
      break // ambient ids are handled by the bed, not as one-shots
  }
}

/** Looping ambience beds: filtered noise shaped per environment. */
const AMBIENTS: Record<string, { hz: number; q: number; gain: number; lfoHz: number } | null> = {
  'amb-sea': { hz: 400, q: 0.4, gain: 0.16, lfoHz: 0.14 },
  'amb-storm': { hz: 700, q: 0.7, gain: 0.34, lfoHz: 0.6 },
  'amb-river': { hz: 2400, q: 0.5, gain: 0.1, lfoHz: 0.9 },
  'amb-land': { hz: 5000, q: 0.3, gain: 0.02, lfoHz: 0.25 },
  'amb-none': null,
}

export interface CueLogEntry {
  id: CueId
  at: number
}

export class AudioPlayer {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambientGain: GainNode | null = null
  private ambientSrc: AudioBufferSourceNode | null = null
  private ambientId = 'amb-none'
  private muted = false
  private log: CueLogEntry[] = []
  private chirpTimer: ReturnType<typeof setInterval> | null = null

  /** Call from a user-gesture handler; browsers gate audio until then. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.8
      // a gentle limiter so stacked cues (attack thumps over a storm bed)
      // squash instead of clipping
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -12
      comp.knee.value = 20
      comp.ratio.value = 6
      comp.attack.value = 0.003
      comp.release.value = 0.25
      this.master.connect(comp)
      comp.connect(this.ctx.destination)
    } catch {
      this.ctx = null // no audio — the game plays silent
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05)
    }
    return this.muted
  }

  isMuted(): boolean {
    return this.muted
  }

  /** Every cue ever received (capped) — the agent-testable seam. */
  getLog(): CueLogEntry[] {
    return this.log.slice()
  }

  play(cues: AudioCue[]): void {
    for (const cue of cues) {
      this.log.push({ id: cue.id, at: Date.now() })
      if (this.log.length > 300) this.log.splice(0, this.log.length - 300)
      if (!this.ctx || !this.master) continue
      if (cue.id.startsWith('amb-')) this.setAmbient(cue.id)
      else
        // a whisper of detune and level variation so the hundredth trade
        // chime of a career doesn't sound stamped from the same die
        synthesize(this.ctx, this.master, cue.id, this.ctx.currentTime, {
          detune: (Math.random() * 2 - 1) * 12,
          gain: 0.92 + Math.random() * 0.16,
        })
    }
  }

  /** A short bright bird call — two quick descending pips over the land bed. */
  private chirp(): void {
    if (!this.ctx || !this.master || this.muted) return
    const t = this.ctx.currentTime
    const base = 2600 + Math.random() * 1200
    const g = this.ctx.createGain()
    g.gain.value = 1
    g.connect(this.master)
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const o = this.ctx.createOscillator()
      o.type = 'sine'
      const at = t + i * (0.09 + Math.random() * 0.05)
      o.frequency.setValueAtTime(base * (1 - i * 0.12), at)
      o.frequency.exponentialRampToValueAtTime(base * (1 - i * 0.12) * 0.82, at + 0.05)
      const e = this.ctx.createGain()
      e.gain.setValueAtTime(0, at)
      e.gain.linearRampToValueAtTime(0.05, at + 0.008)
      e.gain.exponentialRampToValueAtTime(0.001, at + 0.06)
      o.connect(e)
      e.connect(g)
      o.start(at)
      o.stop(at + 0.1)
    }
  }

  private setAmbient(id: string): void {
    if (!this.ctx || !this.master || id === this.ambientId) return
    this.ambientId = id
    // birdsong belongs to the land bed alone
    if (this.chirpTimer) {
      clearInterval(this.chirpTimer)
      this.chirpTimer = null
    }
    if (id === 'amb-land') {
      this.chirpTimer = setInterval(() => {
        if (Math.random() < 0.55) this.chirp()
      }, 2800)
    }
    // fade out the old bed
    if (this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4)
      const old = this.ambientSrc
      if (old) setTimeout(() => old.stop(), 1500)
      this.ambientGain = null
      this.ambientSrc = null
    }
    const spec = AMBIENTS[id]
    if (!spec) return
    const src = this.ctx.createBufferSource()
    src.buffer = noiseBuffer(this.ctx, 2)
    src.loop = true
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = spec.hz
    f.Q.value = spec.q
    const g = this.ctx.createGain()
    g.gain.value = 0
    g.gain.setTargetAtTime(spec.gain, this.ctx.currentTime, 0.6)
    // slow swell so the bed breathes
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = spec.lfoHz
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = spec.gain * 0.35
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    lfo.start()
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    src.start()
    this.ambientSrc = src
    this.ambientGain = g
  }
}
