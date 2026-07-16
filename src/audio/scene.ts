/**
 * The living soundscape's brain: pure mapping from what the world is doing
 * to how the ambient textures should behave — how often the hull creaks,
 * when the gulls start, how dark and urgent the land drone grows. No
 * WebAudio here; the texture player consults these numbers.
 */
export interface SceneInput {
  screen: string
  sailing: boolean
  inStorm: boolean
  /** wind strength 0..1 */
  wind: number
  /** tiles to the nearest land while sailing (Infinity in open ocean) */
  distToLand: number
  /** 0..1: how close and how angry the nearest hostile village is */
  hostility: number
  /** 0..1: how deep into the larder crisis the expedition is */
  famine: number
}

export interface SceneControls {
  /** ship textures, events per minute */
  creaksPerMin: number
  clangsPerMin: number
  gullsPerMin: number
  swellsPerMin: number
  swellGain: number
  /** land drone: generative, so it never audibly loops */
  padNotesPerMin: number
  /** 0..1: how much of the drone draws from the dark scale */
  padDark: number
  pulsesPerMin: number
  pulseGain: number
  danger: number
}

const SILENT: SceneControls = {
  creaksPerMin: 0, clangsPerMin: 0, gullsPerMin: 0, swellsPerMin: 0, swellGain: 0,
  padNotesPerMin: 0, padDark: 0, pulsesPerMin: 0, pulseGain: 0, danger: 0,
}

export function sceneControls(s: SceneInput): SceneControls {
  if (s.screen !== 'playing' && s.screen !== 'walkin') return { ...SILENT }
  const danger = Math.min(1, Math.max(s.hostility, s.famine * 0.7))

  if (s.sailing) {
    const storm = s.inStorm ? 1 : 0
    // gulls announce the coast: silent in open ocean, insistent by the shore
    const near = s.distToLand <= 12 ? 1 - s.distToLand / 12 : 0
    return {
      creaksPerMin: 3 + s.wind * 10 + storm * 18,
      clangsPerMin: (s.wind > 0.5 ? (s.wind - 0.5) * 16 : 0) + storm * 14,
      gullsPerMin: near * 10,
      swellsPerMin: 4 + s.wind * 8 + storm * 6,
      swellGain: Math.min(1, 0.35 + 0.5 * s.wind + storm * 0.3),
      padNotesPerMin: 0, padDark: 0, pulsesPerMin: 0, pulseGain: 0,
      danger,
    }
  }

  // ashore (and walking among the huts): a low generative drone that
  // leans darker and gains a pulse as danger approaches
  return {
    creaksPerMin: 0, clangsPerMin: 0, gullsPerMin: 0, swellsPerMin: 0, swellGain: 0,
    padNotesPerMin: 5 + danger * 15,
    padDark: danger,
    pulsesPerMin: danger > 0.35 ? 20 + danger * 40 : 0,
    pulseGain: 0.08 + 0.3 * danger,
    danger,
  }
}
