/**
 * The original score, as pure data. Each theme is a list of timed notes —
 * no WebAudio here, so the music itself is unit-testable: which screens get
 * which theme, what mode each piece is in, that every note lands inside its
 * loop. The music player (music.ts) turns these into sound.
 */
export type ThemeId = 'title' | 'spain' | 'victory' | 'lament'
export type Voice = 'pluck' | 'bass' | 'flute' | 'bell'

export interface ScoreNote {
  /** start, in beats from the top of the loop */
  t: number
  /** length in beats */
  dur: number
  midi: number
  gain: number
  voice: Voice
}

export interface Theme {
  id: ThemeId
  bpm: number
  /** loop length in beats */
  beats: number
  notes: ScoreNote[]
}

/** Which piece the moment calls for — the score's one decision. */
export function musicFor(s: { screen: string; won: boolean; lost: boolean }): ThemeId | null {
  if (s.screen === 'start' || s.screen === 'outfit') return 'title'
  if (s.screen === 'spain') return 'spain'
  if (s.screen === 'over') return s.won ? 'victory' : 'lament'
  return null // in the New World, the wilderness is the music
}

const N = (t: number, dur: number, midi: number, gain: number, voice: Voice): ScoreNote => ({ t, dur, midi, gain, voice })

/** Lay a melodic line: [midi, beats] pairs, null midi rests. */
function line(notes: ScoreNote[], voice: Voice, gain: number, start: number, steps: [number | null, number][]): void {
  let t = start
  for (const [m, b] of steps) {
    if (m !== null) notes.push(N(t, b, m, gain, voice))
    t += b
  }
}

/**
 * TITLE — "The Seven Cities". E Phrygian dominant over the Andalusian
 * cadence (Am - G - F - E), guitar plucks under a wandering flute:
 * Spain leaning out over an unknown ocean.
 */
function buildTitle(): Theme {
  const notes: ScoreNote[] = []
  // bar roots (octave 2) and the third that colors each chord — the E bars
  // take a MAJOR third (G#): the flamenco sting in an otherwise minor land
  const bars: { root: number; third: number }[] = [
    { root: 45, third: 3 }, { root: 43, third: 4 }, { root: 41, third: 4 }, { root: 40, third: 4 },
    { root: 45, third: 3 }, { root: 43, third: 4 }, { root: 41, third: 4 }, { root: 40, third: 4 },
  ]
  bars.forEach((c, bi) => {
    const t0 = bi * 4
    notes.push(N(t0, 1.6, c.root, 0.5, 'bass'), N(t0 + 2, 1.6, c.root + 7, 0.38, 'bass'))
    const triad = [c.root + 12, c.root + 12 + c.third, c.root + 19, c.root + 24]
    ;[0, 2, 3, 2, 1, 2, 3, 2].forEach((ti, i) => notes.push(N(t0 + i * 0.5, 0.45, triad[ti], 0.2, 'pluck')))
  })
  line(notes, 'flute', 0.45, 0, [
    [69, 1], [72, 1], [71, 1.5], [null, 0.5],
    [67, 1], [71, 1], [74, 1], [72, 1],
    [72, 1], [69, 1], [67, 1], [69, 1],
    [68, 1.5], [64, 1.5], [null, 1],
    [76, 1], [74, 1], [72, 1], [71, 1],
    [72, 1], [71, 1], [69, 1], [67, 1],
    [69, 1], [67, 1], [65, 1], [67, 1],
    [68, 1], [64, 3],
  ])
  return { id: 'title', bpm: 96, beats: 32, notes }
}

/**
 * SPAIN — the harbor motif. G major in a lilting 3/4: gulls, rigging,
 * gold on the quay. Grows out of the 'home' cue's G-B-D chord.
 */
function buildSpain(): Theme {
  const notes: ScoreNote[] = []
  const bars: { root: number; third: number }[] = [
    { root: 43, third: 4 }, { root: 48, third: 4 }, { root: 50, third: 4 }, { root: 43, third: 4 },
    { root: 52, third: 3 }, { root: 48, third: 4 }, { root: 50, third: 4 }, { root: 43, third: 4 },
  ]
  bars.forEach((c, bi) => {
    const t0 = bi * 3
    notes.push(N(t0, 2.5, c.root, 0.5, 'bass'))
    notes.push(N(t0 + 1, 0.8, c.root + 12 + c.third, 0.22, 'pluck'))
    notes.push(N(t0 + 2, 0.8, c.root + 19, 0.22, 'pluck'))
  })
  line(notes, 'flute', 0.42, 0, [
    [74, 1], [79, 1], [78, 1],
    [76, 1], [72, 1], [76, 1],
    [74, 1.5], [69, 1.5],
    [71, 1], [67, 2],
    [71, 1], [76, 1], [74, 1],
    [72, 1], [76, 1], [79, 1],
    [78, 1.5], [74, 1.5],
    [67, 3],
  ])
  return { id: 'spain', bpm: 84, beats: 24, notes }
}

/** VICTORY — a C-major hymn of bells for the day the seventh city falls. */
function buildVictory(): Theme {
  const notes: ScoreNote[] = []
  const roots = [48, 41, 43, 48] // C F G C
  roots.forEach((r, bi) => notes.push(N(bi * 4, 3.5, r, 0.45, 'bass')))
  line(notes, 'bell', 0.35, 0, [
    [72, 1], [76, 1], [79, 1], [84, 1],
    [81, 1], [77, 1], [72, 2],
    [74, 1], [71, 1], [67, 2],
    [72, 4],
  ])
  notes.push(N(12, 4, 76, 0.2, 'bell'), N(12, 4, 79, 0.15, 'bell'))
  return { id: 'victory', bpm: 100, beats: 16, notes }
}

/** LAMENT — for the expeditions that chart no more. Slow, sparse A minor. */
function buildLament(): Theme {
  const notes: ScoreNote[] = []
  notes.push(N(0, 7, 45, 0.4, 'bass'), N(8, 7, 40, 0.35, 'bass'))
  notes.push(
    N(0, 0.6, 57, 0.18, 'pluck'), N(2, 0.6, 60, 0.18, 'pluck'), N(4, 0.6, 64, 0.18, 'pluck'),
    N(8, 0.6, 52, 0.18, 'pluck'), N(10, 0.6, 56, 0.18, 'pluck'), N(12, 0.6, 59, 0.18, 'pluck'),
  )
  line(notes, 'flute', 0.4, 0, [
    [69, 2], [67, 2], [65, 2], [64, 2],
    [null, 1], [72, 2], [71, 2], [69, 3],
  ])
  return { id: 'lament', bpm: 66, beats: 16, notes }
}

export function buildTheme(id: ThemeId): Theme {
  switch (id) {
    case 'title': return buildTitle()
    case 'spain': return buildSpain()
    case 'victory': return buildVictory()
    case 'lament': return buildLament()
  }
}
