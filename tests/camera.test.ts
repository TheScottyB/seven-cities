import { describe, expect, it } from 'vitest'
import { zoomFor, centerCamera, worldToScreen, type Camera } from '../src/engine/camera'

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

  it('worldToScreen maps the camera centre to the middle of the logical view', () => {
    const cam: Camera = { x: 10, y: 10 }
    const p = worldToScreen(cam, 800, 400, 10, 10)
    expect(p.sx).toBe(400)
    expect(p.sy).toBe(200)
  })
})
