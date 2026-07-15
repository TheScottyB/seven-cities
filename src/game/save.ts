import type { GameState } from './state'
import type { Career } from './career'
import type { Village } from '../world/villages'

/**
 * Save format: everything needed to rebuild an expedition. The map itself is
 * NOT stored — it regenerates deterministically from the seed; only mutable
 * state (resources, position, fog, village status) is serialized. Fog is
 * bit-packed then base64'd (~6 KB for a 192x192 map).
 */
export interface SaveData {
  version: 5
  seedStr: string
  state: GameState
  explorer: { x: number; y: number }
  ship: { x: number; y: number }
  sailing: boolean
  career: Career
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

export function serializeSave(data: {
  seedStr: string
  state: GameState
  explorer: { x: number; y: number }
  ship: { x: number; y: number }
  sailing: boolean
  career: Career
  fogSeen: Uint8Array
  villages: Village[]
}): string {
  const save: SaveData = {
    version: 5,
    seedStr: data.seedStr,
    state: data.state,
    explorer: data.explorer,
    ship: data.ship,
    sailing: data.sailing,
    career: data.career,
    fogSeenB64: packBits(data.fogSeen),
    villages: data.villages,
  }
  return JSON.stringify(save)
}

export function deserializeSave(json: string): SaveData | null {
  try {
    const d = JSON.parse(json)
    if (!d || typeof d !== 'object' || d.version !== 5) return null
    if (typeof d.seedStr !== 'string' || typeof d.fogSeenB64 !== 'string') return null
    if (!d.state || typeof d.state.food !== 'number' || typeof d.state.goods !== 'number' || typeof d.state.fear !== 'number') return null
    if (!d.explorer || typeof d.explorer.x !== 'number' || typeof d.explorer.y !== 'number') return null
    if (!d.ship || typeof d.ship.x !== 'number' || typeof d.ship.y !== 'number') return null
    if (typeof d.sailing !== 'boolean') return null
    if (!d.career || typeof d.career.banked !== 'number' || typeof d.career.voyages !== 'number') return null
    if (!Array.isArray(d.villages)) return null
    return d as SaveData
  } catch {
    return null
  }
}
