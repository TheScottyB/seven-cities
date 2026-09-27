/**
 * The sound director: pure logic that decides WHAT should be heard, given
 * where the game was and where it is now. Produces AudioCue data only — no
 * WebAudio imports — so every audio decision is unit-testable.
 */
import type { Screen } from '../game/screen'

export type CueId =
  | 'trade'
  | 'gift'
  | 'attack'
  | 'city-found'
  | 'victory'
  | 'defeat'
  | 'board'
  | 'landfall'
  | 'storm-enter'
  | 'walkin-enter'
  | 'home'
  | 'low-food'
  | 'driven-off'
  | 'amb-sea'
  | 'amb-storm'
  | 'amb-river'
  | 'amb-land'
  | 'amb-none'

export interface AudioCue {
  id: CueId
  gain?: number
}

export interface AudioSnapshot {
  screen: Screen
  sailing: boolean
  inStorm: boolean
  onRiver: boolean
  lowFood: boolean
  citiesFound: number
  won: boolean
  lost: boolean
}

export type GameEvent = 'trade' | 'gift' | 'attack' | 'driven-off'

export function ambienceFor(s: AudioSnapshot): CueId {
  if (s.screen !== 'playing' && s.screen !== 'walkin') return 'amb-none'
  if (s.screen === 'walkin') return 'amb-land'
  if (s.sailing && s.inStorm) return 'amb-storm'
  if (s.sailing) return 'amb-sea'
  if (s.onRiver) return 'amb-river'
  return 'amb-land'
}

export function direct(prev: AudioSnapshot, next: AudioSnapshot, events: GameEvent[] = []): AudioCue[] {
  const cues: AudioCue[] = []

  // ambience: emitted only when the bed actually changes
  const prevAmb = ambienceFor(prev)
  const nextAmb = ambienceFor(next)
  if (prevAmb !== nextAmb) cues.push({ id: nextAmb })

  // one-shot transitions
  if (!prev.sailing && next.sailing) cues.push({ id: 'board' })
  if (prev.sailing && !next.sailing && next.screen === 'playing' && prev.screen === 'playing')
    cues.push({ id: 'landfall' })
  if (next.sailing && !prev.inStorm && next.inStorm) cues.push({ id: 'storm-enter' })
  if (prev.screen !== 'walkin' && next.screen === 'walkin') cues.push({ id: 'walkin-enter' })
  if (prev.screen !== 'spain' && next.screen === 'spain') cues.push({ id: 'home' })
  // the larder bell: rings when provisions first run low, re-arms on recovery
  if (!prev.lowFood && next.lowFood) cues.push({ id: 'low-food' })
  if (next.citiesFound > prev.citiesFound) cues.push({ id: 'city-found' })
  if (!prev.won && next.won) cues.push({ id: 'victory' })
  if (!prev.lost && next.lost) cues.push({ id: 'defeat' })

  // explicit game events
  for (const e of events) cues.push({ id: e })

  return cues
}
