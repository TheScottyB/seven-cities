export enum GameStatus {
  Playing,
  Won,
  Lost,
}

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

const SECONDS_PER_DAY = 20

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
  // ~24 food per day for a 25-man expedition
  const eaten = dt * (0.2 + s.crew * 0.04)
  s.food = Math.max(0, s.food - eaten)
  if (s.food <= 0) {
    s.crew = Math.max(0, s.crew - dt * 2)
    s.morale = Math.max(0, s.morale - dt * 3)
  }

  s.crew = Math.max(0, s.crew)
  s.morale = Math.max(0, s.morale)

  if (s.citiesFound >= 7) {
    s.status = GameStatus.Won
    return
  }
  if (s.crew <= 0 || s.morale <= 0) {
    s.status = GameStatus.Lost
  }
}

export function score(s: GameState, tilesCharted: number): number {
  return Math.floor(s.gold + tilesCharted * 0.5 + s.villagesContacted * 20 - s.day * 5)
}
