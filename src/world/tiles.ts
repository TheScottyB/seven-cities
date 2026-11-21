export const TILE = {
  OCEAN: 0,
  BEACH: 1,
  GRASS: 2,
  FOREST: 3,
  JUNGLE: 4,
  DESERT: 5,
  HIGHLAND: 6,
  MOUNTAIN: 7,
  RIVER: 8,
} as const

export type TileId = (typeof TILE)[keyof typeof TILE]

export interface TileInfo {
  readonly color: string
  /** movement multiplier; 0 means impassable on foot */
  readonly speed: number
  readonly walkable: boolean
}

const INFO = {
  [TILE.OCEAN]: { color: '#1b4a8a', speed: 0, walkable: false },
  [TILE.BEACH]: { color: '#e0d18a', speed: 1.0, walkable: true },
  [TILE.GRASS]: { color: '#4c9a3a', speed: 1.0, walkable: true },
  [TILE.FOREST]: { color: '#2f6b2a', speed: 0.6, walkable: true },
  [TILE.JUNGLE]: { color: '#1f5230', speed: 0.45, walkable: true },
  [TILE.DESERT]: { color: '#d9b45a', speed: 0.8, walkable: true },
  [TILE.HIGHLAND]: { color: '#8a7a52', speed: 0.7, walkable: true },
  [TILE.MOUNTAIN]: { color: '#6d6d6d', speed: 0, walkable: false },
  // stepping onto a river means taking to canoes — rivers are fast inland highways
  [TILE.RIVER]: { color: '#3a7ac0', speed: 1.8, walkable: true },
} as const satisfies Record<TileId, TileInfo>

const INFO_BY_CODE: Readonly<Record<number, TileInfo>> = INFO

export function tileInfo(t: number): TileInfo {
  return INFO_BY_CODE[t] ?? INFO[TILE.OCEAN]
}

export function isWalkable(t: number): boolean {
  return INFO_BY_CODE[t]?.walkable === true
}
