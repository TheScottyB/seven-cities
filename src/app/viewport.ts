/**
 * Canvas sizing: the backing store in device px, the view in CSS px, the
 * integer device zoom for the world, the UI transform and the panels' clock.
 */
import { zoomFor } from '../engine/camera'

export interface Viewport {
  /** Device pixels per CSS pixel; the backing store is sized in device px. */
  dpr: number
  /** The view in CSS px: every UI layer and hit region is laid out in these. */
  cssW: number
  cssH: number
  /** Device px per art px for the world: always an integer, so tiles stay crisp at any dpr. */
  devZoom: number
  /** Re-read the window and resize the backing store; calls `onResize` last. */
  resize(): void
  /** UI layers draw in CSS px; the transform maps them onto the device-px backing store. */
  uiTransform(): void
  /** Seconds for the panels' decorative motion; held at 0 under the OS reduced-motion setting. */
  uiClock(): number
}

/** Nothing is measured until the first resize(). */
export function createViewport(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  onResize: () => void,
): Viewport {
  const reduceMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  const view: Viewport = {
    dpr: 1,
    cssW: 0,
    cssH: 0,
    devZoom: 2,
    resize: () => {
      view.dpr = window.devicePixelRatio || 1
      view.cssW = window.innerWidth
      view.cssH = window.innerHeight
      canvas.width = Math.round(view.cssW * view.dpr)
      canvas.height = Math.round(view.cssH * view.dpr)
      canvas.style.width = view.cssW + 'px'
      canvas.style.height = view.cssH + 'px'
      view.devZoom = Math.max(2, Math.round(zoomFor(view.cssW) * view.dpr))
      onResize()
    },
    uiTransform: () => ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0),
    uiClock: () => (reduceMotion?.matches ? 0 : performance.now() / 1000),
  }
  return view
}
