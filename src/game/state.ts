export enum GameStatus {
  Playing,
  Won,
  Lost,
}

export interface GameState {
  food: number
  crew: number
  gold: number
  morale: number
  day: number
  elapsed: number
  citiesFound: number
  villagesContacted: number
  status: GameStatus
}

const FOOD_PER_SEC = 0.5
const SECONDS_PER_DAY = 20

export function makeState(init: Partial<GameState> = {}): GameState {
  return {
    food: 420,
    crew: 100,
    gold: 0,
    morale: 100,
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

  const eaten = FOOD_PER_SEC * dt * (s.crew / 100)
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
