import { GameMap } from '../world/mapgen'
import { Fog, isSeen } from '../world/fog'
import { Explorer } from '../game/explorer'
import type { Village } from '../world/villages'
import { Camera, worldToScreen } from './camera'
import { TILE_PX } from '../art/tileset'
import { drawExplorer, drawVillage, drawShip } from '../art/sprites'

export interface RenderCtx {
  ctx: CanvasRenderingContext2D
  viewW: number
  viewH: number
  tileset: Map<number, HTMLCanvasElement>
}

/** How close (in tiles) the explorer must be for a tile to count as "in view". */
const VIEW_RADIUS = 5

export function renderWorld(
  rc: RenderCtx,
  cam: Camera,
  map: GameMap,
  fog: Fog,
  villages: Village[],
  explorer: Explorer,
  ship: { x: number; y: number },
  sailing: boolean,
): void {
  const { ctx, viewW, viewH, tileset } = rc
  ctx.fillStyle = '#05060a'
  ctx.fillRect(0, 0, viewW, viewH)

  const cols = Math.ceil(viewW / TILE_PX) + 2
  const rows = Math.ceil(viewH / TILE_PX) + 2
  const startX = Math.floor(cam.x - cols / 2)
  const startY = Math.floor(cam.y - rows / 2)

  for (let ty = startY; ty < startY + rows; ty++) {
    for (let tx = startX; tx < startX + cols; tx++) {
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue
      const { sx, sy } = worldToScreen(cam, viewW, viewH, tx, ty)
      if (!isSeen(fog, tx, ty)) {
        ctx.fillStyle = '#05060a'
        ctx.fillRect(sx, sy, TILE_PX, TILE_PX)
        continue
      }
      const img = tileset.get(map.tiles[ty * map.width + tx])!
      ctx.drawImage(img, sx, sy)
      // dim tiles that are charted but outside the explorer's current sight
      const d = Math.hypot(tx + 0.5 - explorer.x, ty + 0.5 - explorer.y)
      if (d > VIEW_RADIUS) {
        ctx.fillStyle = 'rgba(4,6,12,0.45)'
        ctx.fillRect(sx, sy, TILE_PX, TILE_PX)
      }
    }
  }

  for (const v of villages) {
    if (!isSeen(fog, v.x, v.y)) continue
    const { sx, sy } = worldToScreen(cam, viewW, viewH, v.x + 0.5, v.y + 0.5)
    ctx.globalAlpha = v.depleted ? 0.55 : 1
    drawVillage(ctx, sx, sy, v.golden, v.visited)
    ctx.globalAlpha = 1
  }

  // the moored ship, once its waters are charted
  if (!sailing && isSeen(fog, Math.floor(ship.x), Math.floor(ship.y))) {
    const p = worldToScreen(cam, viewW, viewH, ship.x, ship.y)
    drawShip(ctx, p.sx, p.sy)
  }

  const { sx, sy } = worldToScreen(cam, viewW, viewH, explorer.x, explorer.y)
  if (sailing) drawShip(ctx, sx, sy)
  else drawExplorer(ctx, sx, sy)
}

/** Small charted-territory minimap in the corner. */
export function renderMinimap(
  rc: RenderCtx,
  map: GameMap,
  fog: Fog,
  explorer: Explorer,
  villages: Village[],
  ship?: { x: number; y: number },
): void {
  const { ctx, viewW } = rc
  const size = 120
  const px = viewW - size - 12
  const py = 52
  const scale = size / map.width
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(px - 2, py - 2, size + 4, size + 4)
  const step = 2
  for (let y = 0; y < map.height; y += step) {
    for (let x = 0; x < map.width; x += step) {
      if (!isSeen(fog, x, y)) continue
      const t = map.tiles[y * map.width + x]
      ctx.fillStyle = t === 0 ? '#1b4a8a' : '#3f6b34'
      ctx.fillRect(px + x * scale, py + y * scale, step * scale + 0.5, step * scale + 0.5)
    }
  }
  // charted villages: gold squares for Cities of Gold, brown for the rest
  for (const v of villages) {
    if (!isSeen(fog, v.x, v.y)) continue
    ctx.fillStyle = v.golden ? '#f4c430' : v.depleted ? '#6a5138' : '#b07840'
    ctx.fillRect(px + v.x * scale - 1, py + v.y * scale - 1, 3, 3)
  }
  ctx.fillStyle = '#ff5555'
  ctx.fillRect(px + explorer.x * scale - 1, py + explorer.y * scale - 1, 3, 3)
  if (ship) {
    ctx.fillStyle = '#cfe6ff'
    ctx.fillRect(px + ship.x * scale - 1, py + ship.y * scale - 1, 3, 3)
  }
}
