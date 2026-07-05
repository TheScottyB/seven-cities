import { TILE_PX } from '../art/tileset'

export interface Camera {
  x: number
  y: number
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
): void {
  const halfW = viewW / 2 / TILE_PX
  const halfH = viewH / 2 / TILE_PX
  cam.x = clamp(worldX, halfW, mapW - halfW)
  cam.y = clamp(worldY, halfH, mapH - halfH)
}

export function worldToScreen(cam: Camera, viewW: number, viewH: number, wx: number, wy: number) {
  return {
    sx: (wx - cam.x) * TILE_PX + viewW / 2,
    sy: (wy - cam.y) * TILE_PX + viewH / 2,
  }
}

function clamp(v: number, lo: number, hi: number) {
  if (hi < lo) return (lo + hi) / 2
  return Math.max(lo, Math.min(hi, v))
}
