import type { WalkinScene } from '../game/walkin'
import type { Tileset } from '../art/tileset'
import { TILE } from '../world/tiles'
import { drawVillager, drawChief, drawHut, drawExplorer, drawShadow } from '../art/sprites'

const SCENE_PX = 40 // walk-in tiles render larger than the overworld

export function drawWalkin(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  scene: WalkinScene,
  tileset: Tileset,
  hostileNote: string,
): void {
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, viewW, viewH)

  const sw = scene.w * SCENE_PX
  const sh = scene.h * SCENE_PX
  const ox = (viewW - sw) / 2
  const oy = (viewH - sh) / 2

  // village ground: grass variants scaled up
  const grass = tileset.get(TILE.GRASS)!
  for (let ty = 0; ty < scene.h; ty++) {
    for (let tx = 0; tx < scene.w; tx++) {
      const v = ((tx * 73856093) ^ (ty * 19349663)) >>> 0
      ctx.drawImage(grass[v % grass.length], ox + tx * SCENE_PX, oy + ty * SCENE_PX, SCENE_PX, SCENE_PX)
    }
  }
  // a worn path up the middle
  ctx.fillStyle = 'rgba(160,130,80,0.25)'
  ctx.fillRect(ox + (scene.w / 2 - 0.6) * SCENE_PX, oy, 1.2 * SCENE_PX, sh)

  ctx.strokeStyle = '#f4c430'
  ctx.lineWidth = 2
  ctx.strokeRect(ox - 2, oy - 2, sw + 4, sh + 4)

  const sx = (x: number) => ox + x * SCENE_PX
  const sy = (y: number) => oy + y * SCENE_PX

  for (const [hx, hy] of scene.huts) {
    drawShadow(ctx, sx(hx + 0.5), sy(hy + 0.8), SCENE_PX * 0.45)
    drawHut(ctx, sx(hx + 0.5), sy(hy + 0.5), SCENE_PX)
  }

  // the chief's mat
  ctx.fillStyle = 'rgba(244,196,48,0.18)'
  ctx.beginPath()
  ctx.ellipse(sx(scene.chief.x), sy(scene.chief.y + 0.25), SCENE_PX * 0.9, SCENE_PX * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  drawShadow(ctx, sx(scene.chief.x), sy(scene.chief.y + 0.3), SCENE_PX * 0.3)
  drawChief(ctx, sx(scene.chief.x), sy(scene.chief.y), SCENE_PX)

  for (const vg of scene.villagers) {
    if (vg.appeased) continue
    drawShadow(ctx, sx(vg.x), sy(vg.y + 0.18), SCENE_PX * 0.2)
    drawVillager(ctx, sx(vg.x), sy(vg.y), SCENE_PX)
  }

  drawShadow(ctx, sx(scene.px), sy(scene.py + 0.2), SCENE_PX * 0.24)
  // reuse the overworld conquistador at scene scale via transform
  ctx.save()
  ctx.translate(sx(scene.px), sy(scene.py))
  ctx.scale(SCENE_PX / 16, SCENE_PX / 16)
  drawExplorer(ctx, 0, 0)
  ctx.restore()

  ctx.font = "16px 'Courier New', monospace"
  ctx.textAlign = 'center'
  ctx.fillStyle = scene.hostile ? '#c0504d' : '#c9c9d2'
  ctx.fillText(hostileNote, viewW / 2, oy - 16)
  ctx.fillStyle = '#7a7a86'
  ctx.font = "14px 'Courier New', monospace"
  ctx.fillText('Walk to the chief to parley — or walk out the way you came (Esc leaves)', viewW / 2, oy + sh + 26)
  ctx.textAlign = 'left'
}
