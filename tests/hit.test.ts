import { describe, expect, it } from 'vitest'
import { beginHits, addHit, hitAt } from '../src/ui/hit'

describe('canvas hit regions', () => {
  it('finds the region under a point, or nothing', () => {
    beginHits()
    addHit('go', 100, 200, 80, 30)
    expect(hitAt(140, 215)).toBe('go')
    expect(hitAt(99, 215)).toBeNull()
    expect(hitAt(140, 231)).toBeNull()
  })

  it('the most recently drawn region wins where panels overlap', () => {
    beginHits()
    addHit('under', 0, 0, 500, 500)
    addHit('over', 100, 100, 50, 50)
    expect(hitAt(120, 120)).toBe('over')
    expect(hitAt(10, 10)).toBe('under')
  })

  it('beginHits clears the previous frame completely', () => {
    beginHits()
    addHit('stale', 0, 0, 50, 50)
    beginHits()
    expect(hitAt(10, 10)).toBeNull()
  })
})
