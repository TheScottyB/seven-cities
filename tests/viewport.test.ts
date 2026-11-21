import { afterEach, describe, expect, test, vi } from 'vitest'
import { createViewport } from '../src/app/viewport'

function stubEnv(w: number, h: number, dpr: number, reducedMotion = false) {
  vi.stubGlobal('window', { innerWidth: w, innerHeight: h, devicePixelRatio: dpr })
  vi.stubGlobal('matchMedia', () => ({ matches: reducedMotion }))
  const canvas = { width: 0, height: 0, style: { width: '', height: '' } } as unknown as HTMLCanvasElement
  const transforms: number[][] = []
  const ctx = {
    setTransform: (...args: number[]) => transforms.push(args),
  } as unknown as CanvasRenderingContext2D
  return { canvas, ctx, transforms }
}

describe('createViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('sizes the backing store in device pixels, computes integer devZoom, and notifies onResize', () => {
    const { canvas, ctx, transforms } = stubEnv(1400, 800, 1.5)
    const onResize = vi.fn()
    const view = createViewport(canvas, ctx, onResize)
    view.resize()

    expect(view.dpr).toBe(1.5)
    expect(view.cssW).toBe(1400)
    expect(view.cssH).toBe(800)
    expect(canvas.width).toBe(2100)
    expect(canvas.height).toBe(1200)
    expect(canvas.style.width).toBe('1400px')
    expect(canvas.style.height).toBe('800px')
    expect(Number.isInteger(view.devZoom)).toBe(true)
    expect(view.devZoom).toBe(5) // zoomFor(1400) = 3, round(3 * 1.5) = 5
    expect(onResize).toHaveBeenCalledOnce()

    view.uiTransform()
    expect(transforms).toEqual([[1.5, 0, 0, 1.5, 0, 0]])
  })

  test('clamps zero or degenerate dimensions to at least 1px and sane dpr', () => {
    const { canvas, ctx } = stubEnv(0, 0, 0)
    const view = createViewport(canvas, ctx, () => {})
    view.resize()

    expect(view.dpr).toBe(1)
    expect(view.cssW).toBe(1)
    expect(view.cssH).toBe(1)
    expect(canvas.width).toBe(1)
    expect(canvas.height).toBe(1)
    expect(view.devZoom).toBeGreaterThanOrEqual(2)
  })

  test('uiClock holds at 0 when prefers-reduced-motion is active', () => {
    const { canvas, ctx } = stubEnv(1280, 720, 1, true)
    const view = createViewport(canvas, ctx, () => {})
    expect(view.uiClock()).toBe(0)
  })
})
