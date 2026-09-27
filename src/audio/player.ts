import type { AudioCue, CueId } from './director'
import { buildTheme, type Theme, type ThemeId } from './score'
import { scheduleThemeWindow } from './music'
import { synthTexture, noiseBuffer, type TextureKind } from './texture'
import type { SceneControls } from './scene'

/**
 * Thin WebAudio adapter. All decisions live in the director; this file only
 * turns AudioCue data into sound. `synthesize` takes any BaseAudioContext so
 * the dev hook __dbg.renderCue can render cues on an OfflineAudioContext and
 * measure the signal; tests/player.test.ts covers the player's bookkeeping.
 */

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

/** The live ambience bed: every node it started, so a change can stop them all. */
interface Bed {
  src: AudioBufferSourceNode
  f: BiquadFilterNode
  g: GainNode
  lfo: OscillatorNode
  lfoGain: GainNode
  drift: OscillatorNode | null
  driftGain: GainNode | null
}

const LOG_CAP = 300

export interface CueLogEntry {
  /** a CueId, or a music marker like 'music-title' / 'music-none' */
  id: string
  at: number
}

export class AudioPlayer {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bed: Bed | null = null
  private ambientId = 'amb-none'
  private muted = false
  private log: CueLogEntry[] = []
  private chirpTimer: ReturnType<typeof setInterval> | null = null
  private theme: Theme | null = null
  private themeId: ThemeId | null = null
  private themeGain: GainNode | null = null
  private themeStart = 0
  private themeUntil = 0
  private themeTimer: ReturnType<typeof setInterval> | null = null
  private controls: SceneControls | null = null
  private texStats: Record<TextureKind, number> = { creak: 0, clang: 0, gull: 0, swell: 0, pad: 0, pulse: 0 }

  /**
   * Call from a user-gesture handler; browsers gate audio until then.
   * True only when this call created the context or asked a stopped one to run.
   */
  unlock(): boolean {
    if (this.ctx) return this.wake()
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
      // if a theme was chosen while audio was still locked, strike it up now
      const pending = this.themeId
      this.themeId = null
      this.theme = null
      if (pending) this.setTheme(pending)
      // runs for the page's lifetime; nothing ever tears the player down
      setInterval(() => this.textureTick(), 250)
      return true
    } catch {
      this.ctx = null // no audio — the game plays silent
      return false
    }
  }

  /** Pause the audio clock (tab hidden, game paused). Never creates a context. */
  suspend(): void {
    if (this.ctx) void this.ctx.suspend()
  }

  /** Undo suspend() or an OS interruption. Never creates a context. */
  resume(): void {
    this.wake()
  }

  private wake(): boolean {
    // 'interrupted' (iOS calls, other apps) is missing from TS's AudioContextState
    const state: string | undefined = this.ctx?.state
    if (!this.ctx || (state !== 'suspended' && state !== 'interrupted')) return false
    void this.ctx.resume()
    return true
  }

  /**
   * Start, switch, or stop the score. Idempotent per theme; crossfades on
   * change. Called every frame with musicFor(screen).
   */
  setTheme(id: ThemeId | null): void {
    if (id === this.themeId) return
    this.themeId = id
    const marker = id ? `music-${id}` : 'music-none'
    if (this.log[this.log.length - 1]?.id !== marker) this.pushLog(marker)
    if (this.themeTimer) {
      clearInterval(this.themeTimer)
      this.themeTimer = null
    }
    if (this.themeGain && this.ctx) {
      const old = this.themeGain
      old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4)
      setTimeout(() => old.disconnect(), 2000)
      this.themeGain = null
    }
    this.theme = id ? buildTheme(id) : null
    if (!this.ctx || !this.master || !this.theme) return
    const g = this.ctx.createGain()
    g.gain.value = 0
    g.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.6)
    g.connect(this.master)
    this.themeGain = g
    this.themeStart = this.ctx.currentTime + 0.15
    this.themeUntil = this.themeStart
    const pump = () => {
      if (!this.ctx || !this.themeGain || !this.theme) return
      this.themeUntil = scheduleThemeWindow(
        this.ctx,
        this.themeGain,
        this.theme,
        this.themeStart,
        Math.max(this.themeUntil, this.ctx.currentTime),
        this.ctx.currentTime + 1.2,
      )
    }
    pump()
    this.themeTimer = setInterval(pump, 300)
  }

  /** Also honoured by a context created later (see unlock). */
  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05)
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  /** Every cue and music marker received, newest LOG_CAP kept — the agent-testable seam. */
  getLog(): CueLogEntry[] {
    return this.log.slice()
  }

  private pushLog(id: string): void {
    this.log.push({ id, at: Date.now() })
    if (this.log.length > LOG_CAP) this.log.splice(0, this.log.length - LOG_CAP)
  }

  /** The world tells the soundscape how it feels, every frame. */
  setScene(c: SceneControls): void {
    this.controls = c
  }

  /** How many of each ambient texture have fired — the other testable seam. */
  getTextureStats(): Record<TextureKind, number> {
    return { ...this.texStats }
  }

  /** Every 250ms: roll dice against the scene's rates and fire textures. */
  private textureTick(): void {
    const c = this.controls
    if (!c || !this.ctx || !this.master || this.muted) return
    const roll = (perMin: number) => perMin > 0 && Math.random() < (perMin * 0.25) / 60
    const t = this.ctx.currentTime + Math.random() * 0.2
    const vary = () => Math.random() * 2 - 1
    // a stopped clock would stack every texture at one instant for the resume;
    // the dice and counts still run so the stats stay readable
    const running = this.ctx.state === 'running'
    const fire = (kind: TextureKind, opts: Parameters<typeof synthTexture>[4]) => {
      if (running) synthTexture(this.ctx!, this.master!, kind, t, opts)
      this.texStats[kind]++
    }
    if (roll(c.creaksPerMin)) fire('creak', { gain: 0.7 + Math.random() * 0.6, vary: vary() })
    if (roll(c.clangsPerMin)) fire('clang', { gain: 0.6 + Math.random() * 0.5, vary: vary() })
    if (roll(c.gullsPerMin)) fire('gull', { gain: 0.7 + Math.random() * 0.6, vary: vary() })
    if (roll(c.swellsPerMin)) fire('swell', { gain: c.swellGain * (0.8 + Math.random() * 0.4), vary: vary() })
    if (roll(c.padNotesPerMin)) {
      // the drone drifts between a warm daylight set and a darker one as
      // danger rises; random walks through a scale never audibly loop
      const BRIGHT = [57, 60, 62, 64, 67]
      const DARK = [45, 46, 48, 52, 53]
      const scale = Math.random() < c.padDark ? DARK : BRIGHT
      fire('pad', {
        midi: scale[Math.floor(Math.random() * scale.length)],
        dur: 3 + Math.random() * 3.5,
        gain: 0.8 + Math.random() * 0.4,
        vary: vary(),
      })
    }
    if (roll(c.pulsesPerMin)) fire('pulse', { gain: c.pulseGain / 0.3 })
  }

  play(cues: AudioCue[]): void {
    for (const cue of cues) {
      this.pushLog(cue.id)
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
    // a stopped clock would pile the calls up for the resume
    if (!this.ctx || !this.master || this.muted || this.ctx.state !== 'running') return
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
    // fade out the old bed, then stop every oscillator it started on the
    // audio clock; src.onended unhooks its nodes from the master
    if (this.bed) {
      const old = this.bed
      old.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4)
      const end = this.ctx.currentTime + 1.5
      old.src.stop(end)
      old.lfo.stop(end)
      old.drift?.stop(end)
      this.bed = null
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
    // at sea, the water's color itself drifts over minutes — no two
    // stretches of the crossing sound quite alike
    let drift: OscillatorNode | null = null
    let driftGain: GainNode | null = null
    if (id === 'amb-sea' || id === 'amb-storm') {
      drift = this.ctx.createOscillator()
      drift.frequency.value = 0.045
      driftGain = this.ctx.createGain()
      driftGain.gain.value = spec.hz * 0.35
      drift.connect(driftGain)
      driftGain.connect(f.frequency)
      drift.start()
    }
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    src.start()
    src.onended = () => {
      g.disconnect()
      f.disconnect()
      lfoGain.disconnect()
      driftGain?.disconnect()
    }
    this.bed = { src, f, g, lfo, lfoGain, drift, driftGain }
  }
}
