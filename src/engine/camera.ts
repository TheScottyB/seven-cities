import { TILE_PX } from '../art/tileset'

export interface Camera {
  x: number
  y: number
}

/**
 * Integer pixel zoom for the world view — chunky tiles that actually fill
 * the window, like the machines this game remembers. viewW is in CSS px
 * (window.innerWidth); floor(viewW / 420) is clamped to 2-4, so windows under
 * ~1260px get 2x, 1260-1679px (most laptops) get 3x, and 1680px+ gets 4x.
 */
export function zoomFor(viewW: number): number {
  return Math.max(2, Math.min(4, Math.floor(viewW / 420)))
}

/** Centre the camera on a world point (tile coords), clamped to map bounds. */
export function centerCamera(
  cam: Camera,
  worldX: number,
  worldY: number,
  viewW: number,
  viewH: number,
  mapW: number,
  mapH: number,
  zoom = 1,
): void {
  const halfW = viewW / 2 / (TILE_PX * zoom)
  const halfH = viewH / 2 / (TILE_PX * zoom)
  cam.x = clamp(worldX, halfW, mapW - halfW)
  cam.y = clamp(worldY, halfH, mapH - halfH)
}

function clamp(v: number, lo: number, hi: number) {
  if (hi < lo) return (lo + hi) / 2
  return Math.max(lo, Math.min(hi, v))
}
