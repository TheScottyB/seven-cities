import { describe, expect, it } from 'vitest'
import { BLENDABLE, buildEdgeKeys } from '../src/art/edges'

// Side bits in an edge key: 1=N, 2=E, 4=S, 8=W.
const EAST = 2
const WEST = 8

describe('edge ranks', () => {
  it('lists each blendable terrain once', () => {
    expect(new Set(BLENDABLE).size).toBe(BLENDABLE.length)
  })

  it('every blendable border is drawn exactly once, from the lower-ranked side', () => {
    for (const a of BLENDABLE) {
      for (const b of BLENDABLE) {
        if (a === b) continue
        const keys = buildEdgeKeys(new Uint8Array([a, b]), 2, 1)
        expect((keys[0] !== 0) !== (keys[1] !== 0)).toBe(true)
        if (keys[0] !== 0) expect(keys[0]).toBe(b * 16 + EAST)
        if (keys[1] !== 0) expect(keys[1]).toBe(a * 16 + WEST)
      }
    }
  })
})
