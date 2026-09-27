/**
 * The state-free audio probes of window.__dbg: the offline renderers and the
 * soundscape readout. main.ts writes the __dbg literal itself, next to the state
 * it reads, and spreads these in, all under `if (import.meta.env.DEV)`, so
 * production drops this module.
 */
import { synthesize, type AudioPlayer } from '../audio/player'
import { buildTheme, type ThemeId } from '../audio/score'
import { scheduleThemeWindow } from '../audio/music'
import { sceneControls, type SceneInput } from '../audio/scene'
import { synthTexture, type TextureKind } from '../audio/texture'

/** rms and peak of an offline render's single channel. */
function level(d: Float32Array): { rms: number; peak: number } {
  let sum = 0
  let peak = 0
  for (let i = 0; i < d.length; i++) {
    sum += d[i] * d[i]
    peak = Math.max(peak, Math.abs(d[i]))
  }
  return { rms: Math.sqrt(sum / d.length), peak }
}

// Part of the STABLE __dbg API: add entries, never rename or remove one, and keep
// every signature and behaviour. The keys stay in this order; main.ts spreads
// them between `storage` and `setSeed`.
export function audioProbes(player: AudioPlayer, sceneInput: () => SceneInput) {
  return {
    audioLog: () => player.getLog(), // copy of the capped cue/music log: { id, at }[]
    renderCue: async (id: string) => { // offline-render a cue: rms plus Goertzel energies
      const off = new OfflineAudioContext(1, 2 * 44100, 44100)
      synthesize(off, off.destination, id as never, 0)
      const buf = await off.startRendering()
      const d = buf.getChannelData(0)
      const { rms } = level(d)
      const goertzel = (freq: number) => {
        const w = (2 * Math.PI * freq) / 44100
        const c = 2 * Math.cos(w)
        let s0 = 0, s1 = 0, s2 = 0
        const n = Math.min(d.length, 44100)
        for (let i = 0; i < n; i++) {
          s0 = d[i] + c * s1 - s2
          s2 = s1
          s1 = s0
        }
        return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2) / n
      }
      return { rms, e660: goertzel(660), e880: goertzel(880), e120: goertzel(120), e3000: goertzel(3000) }
    },
    audioScene: () => ({ // soundscape inputs, derived controls and texture firing counts; hostility counts moodOf-hostile villages
      input: sceneInput(),
      controls: sceneControls(sceneInput()),
      stats: player.getTextureStats(),
    }),
    renderTexture: async (kind: string, seconds = 3) => { // offline-render a texture: { rms, peak }
      const off = new OfflineAudioContext(1, Math.floor(seconds * 44100), 44100)
      synthTexture(off, off.destination, kind as TextureKind, 0.1, { midi: 57, dur: 1.6 })
      const buf = await off.startRendering()
      return level(buf.getChannelData(0))
    },
    renderTheme: async (id: string, seconds = 4) => { // offline-render a theme's opening: { rms, peak }
      const off = new OfflineAudioContext(1, Math.floor(seconds * 44100), 44100)
      scheduleThemeWindow(off, off.destination, buildTheme(id as ThemeId), 0, 0, seconds)
      const buf = await off.startRendering()
      return level(buf.getChannelData(0))
    },
  }
}
