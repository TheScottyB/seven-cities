import { describe, expect, it } from 'vitest'
import { zoomFor, centerCamera, type Camera } from '../src/engine/camera'
import { originFor } from '../src/engine/renderer'

describe('world zoom', () => {
  it('scales with window width, clamped to a chunky-but-sane range', () => {
    expect(zoomFor(640)).toBe(2) // small laptop window still gets 2x
    expect(zoomFor(1280)).toBe(3)
    expect(zoomFor(1680)).toBe(4)
    expect(zoomFor(3840)).toBe(4) // capped — tiles never become billboards
  })

  it('camera clamping accounts for the zoomed (smaller) tile footprint', () => {
    const cam: Camera = { x: 0, y: 0 }
    // 1600px wide at 2x zoom shows 50 tiles; centre cannot go below 25
    centerCamera(cam, 0, 0, 1600, 800, 150, 150, 2)
    expect(cam.x).toBe(25)
    expect(cam.y).toBe(12.5)
    // the same window at 4x shows half as much world
    centerCamera(cam, 0, 0, 1600, 800, 150, 150, 4)
    expect(cam.x).toBe(12.5)
    expect(cam.y).toBe(6.25)
  })

})

describe('screen origin', () => {
  it('snaps a fractional camera on an odd-sized view to whole pixels', () => {
    // 400.5 - 165.92 = 234.58 and 200.5 - 78.56 = 121.94 before snapping
    expect(originFor({ x: 10.37, y: 4.91 }, 801, 401)).toEqual({ ox: 235, oy: 122 })
  })
})
