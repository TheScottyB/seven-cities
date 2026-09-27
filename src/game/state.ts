import { CITIES_OF_GOLD } from '../world/villages'

// Plain object rather than an enum (erasableSyntaxOnly); the numeric values are persisted in saves.
export const GameStatus = { Playing: 0, Won: 1, Lost: 2 } as const
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus]

export interface GameState {
  food: number
  crew: number
  gold: number
  goods: number
  morale: number
  /** 0-100: how far word of your violence has spread among the peoples */
  fear: number
  day: number
  elapsed: number
  citiesFound: number
  villagesContacted: number
  status: GameStatus
}

export const SECONDS_PER_DAY = 20

/** provisions below this read as running low */
export const LOW_FOOD = 80

/** provisions a crew of this size eats per game day — the outfitter's arithmetic */
export function dailyAppetite(crew: number): number {
  return (0.2 + crew * 0.04) * SECONDS_PER_DAY
}

export function makeState(init: Partial<GameState> = {}): GameState {
  return {
    food: 420,
    crew: 100,
    gold: 0,
    goods: 100,
    morale: 100,
    fear: 0,
    day: 1,
    elapsed: 0,
    citiesFound: 0,
    villagesContacted: 0,
    status: GameStatus.Playing,
    ...init,
  }
}

export function tick(s: GameState, dt: number): void {
  if (s.status !== GameStatus.Playing) return
  s.elapsed += dt
  s.day = 1 + Math.floor(s.elapsed / SECONDS_PER_DAY)

  // famine bites: a base camp cost plus a per-man share —
  // ~24 food per day for a 25-man expedition (see dailyAppetite)
  const eaten = (dt * dailyAppetite(s.crew)) / SECONDS_PER_DAY
  s.food = Math.max(0, s.food - eaten)
  if (s.food <= 0) {
    s.crew = Math.max(0, s.crew - dt * 2)
    s.morale = Math.max(0, s.morale - dt * 3)
  }

  s.crew = Math.max(0, s.crew)
  s.morale = Math.max(0, s.morale)

  if (s.citiesFound >= CITIES_OF_GOLD) {
    s.status = GameStatus.Won
    return
  }
  if (s.crew <= 0 || s.morale <= 0) {
    s.status = GameStatus.Lost
  }
}

export interface ScoreParts {
  gold: number
  charted: number
  villages: number
  days: number
}

/** The score broken into whole-number parts; score() is their sum. */
export function scoreParts(s: GameState, tilesCharted: number): ScoreParts {
  return {
    gold: Math.floor(s.gold),
    charted: Math.floor(tilesCharted * 0.5),
    villages: s.villagesContacted * 20,
    days: -s.day * 5,
  }
}

export function score(s: GameState, tilesCharted: number): number {
  const p = scoreParts(s, tilesCharted)
  return p.gold + p.charted + p.villages + p.days
}
