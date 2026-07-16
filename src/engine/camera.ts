import { TILE_PX } from '../art/tileset'

export interface Camera {
  x: number
  y: number
}

/**
 * Integer pixel zoom for the world view — chunky tiles that actually fill
 * the window, like the machines this game remembers. Scales with window
 * width so a laptop gets 2x and a big desktop 3-4x.
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

/**
 * World tile coords -> screen pixels. viewW/viewH are the LOGICAL view size:
 * when the renderer scales the context by the zoom factor, pass the canvas
 * size divided by that zoom.
 */
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
