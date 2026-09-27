import { GameStatus, type GameState } from './state'
import type { Career } from './career'
import { LIMITS } from './outfit'
import type { Outpost } from './outposts'
import type { Village } from '../world/villages'

/**
 * Save format: everything needed to rebuild an expedition. The map itself is
 * NOT stored — it regenerates deterministically from the seed; only mutable
 * state (resources, position, fog, village status) is serialized. Fog is
 * bit-packed then base64'd (~6 KB for a 192x192 map).
 *
 * v7 is the 1.0 baseline. Any format change must bump SAVE_VERSION and add an
 * upgrade step in deserializeSave; never silently drop players' saves.
 * Pre-1.0 versions (<7) are rejected: none were ever public.
 */
export const SAVE_VERSION = 7

/** 'refit' marks a save taken on the Spain transition: resume on the outfit screen. */
export type SavePhase = 'at-sea' | 'refit'

export interface SaveData {
  version: typeof SAVE_VERSION
  seedStr: string
  /** mapFingerprint of the world the save was taken in; a mismatch means the seed no longer regenerates it */
  mapHash: number
  phase: SavePhase
  state: GameState
  explorer: { x: number; y: number }
  ships: { x: number; y: number }[]
  activeShip: number
  sailing: boolean
  career: Career
  outposts: Outpost[]
  fogSeenB64: string
  villages: Village[]
}

export function packBits(bits: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8))
  for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= 1 << (i & 7)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

export function unpackBits(b64: string, length: number): Uint8Array {
  const bin = atob(b64)
  const bits = new Uint8Array(length)
  for (let i = 0; i < length; i++) bits[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1
  return bits
}

/**
 * FNV-1a over the map's shape, tiles and village placement. Detects a seed
 * that regenerates a different world (a mapgen change) before a save is
 * restored onto it.
 */
export function mapFingerprint(
  tiles: ArrayLike<number>,
  width: number,
  height: number,
  villages: readonly { x: number; y: number; golden: boolean }[],
): number {
  let h = 0x811c9dc5
  const mix = (v: number) => {
    for (let b = 0; b < 4; b++) {
      h ^= (v >>> (b * 8)) & 0xff
      h = Math.imul(h, 0x01000193)
    }
  }
  mix(width)
  mix(height)
  for (let i = 0; i < tiles.length; i++) mix(tiles[i])
  mix(villages.length)
  for (const v of villages) {
    mix(v.x)
    mix(v.y)
    mix(v.golden ? 1 : 0)
  }
  return h >>> 0
}

export function serializeSave(data: {
  seedStr: string
  mapHash: number
  phase: SavePhase
  state: GameState
  explorer: { x: number; y: number }
  ships: { x: number; y: number }[]
  activeShip: number
  sailing: boolean
  career: Career
  outposts: Outpost[]
  fogSeen: Uint8Array
  villages: Village[]
}): string {
  const save: SaveData = {
    version: SAVE_VERSION,
    seedStr: data.seedStr,
    mapHash: data.mapHash,
    phase: data.phase,
    state: data.state,
    explorer: data.explorer,
    ships: data.ships,
    activeShip: data.activeShip,
    sailing: data.sailing,
    career: data.career,
    outposts: data.outposts,
    fogSeenB64: packBits(data.fogSeen),
    villages: data.villages,
  }
  return JSON.stringify(save)
}

const STATE_NUMBERS = [
  'food', 'crew', 'gold', 'goods', 'morale', 'fear', 'day', 'elapsed', 'citiesFound', 'villagesContacted',
] as const satisfies readonly (keyof GameState)[]
const STATUSES: readonly unknown[] = Object.values(GameStatus)
const MAX_SHIPS = LIMITS.ships[1]

const isFiniteXY = (p: { x?: unknown; y?: unknown } | null | undefined) =>
  !!p && Number.isFinite(p.x) && Number.isFinite(p.y)

export function deserializeSave(json: string): SaveData | null {
  try {
    const d = JSON.parse(json)
    if (!d || typeof d !== 'object' || d.version !== SAVE_VERSION) return null
    if (typeof d.seedStr !== 'string' || typeof d.fogSeenB64 !== 'string') return null
    if (!Number.isFinite(d.mapHash) || (d.phase !== 'at-sea' && d.phase !== 'refit')) return null
    if (!d.state || typeof d.state !== 'object') return null
    if (STATE_NUMBERS.some((k) => !Number.isFinite(d.state[k])) || !STATUSES.includes(d.state.status)) return null
    if (!isFiniteXY(d.explorer)) return null
    if (!Array.isArray(d.ships) || d.ships.length < 1 || d.ships.length > MAX_SHIPS || !d.ships.every(isFiniteXY)) return null
    if (!Number.isInteger(d.activeShip) || d.activeShip < 0 || d.activeShip >= d.ships.length) return null
    if (typeof d.sailing !== 'boolean') return null
    if (!Array.isArray(d.outposts)) return null
    if (!d.career || typeof d.career.banked !== 'number' || typeof d.career.voyages !== 'number') return null
    if (!Array.isArray(d.villages)) return null
    return d as SaveData
  } catch {
    return null
  }
}
