import type { WalkinScene } from '../game/walkin'
import { moodOf } from '../game/encounter'
import type { Tileset } from '../art/tileset'
import { tileIndex } from '../art/relief'
import { TILE } from '../world/tiles'
import { tileHash } from '../world/rng'
import { drawExplorerSprite, type SpriteBank } from '../art/spritebank'
import { font } from './font'
import {
  drawVillager,
  drawChief,
  drawHut,
  drawShadow,
  drawFire,
  drawPots,
  drawRack,
  drawCrop,
  drawIdol,
} from '../art/sprites'

/** roofs alternate through weathered browns; a City of Gold gilds them all */
const ROOFS = ['#7a4a24', '#6f451f', '#835028']

export function drawWalkin(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  scene: WalkinScene,
  tileset: Tileset,
  moodNote: string,
  sprites: SpriteBank,
  t = 0,
): void {
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, viewW, viewH)

  // integer scaling only — the walk-in draws the biggest sprites in the game,
  // and a fractional factor is exactly what softens them. The view is in CSS
  // px under the caller's device-pixel-ratio transform, so the scale and the
  // origin are chosen in DEVICE px and converted back.
  // Vertical budget: a top band for the toast (y 8-42) and the mood banner
  // above the scene, and room for the help line below it.
  const TOP = 92
  const BOTTOM = 44
  const dpr = ctx.getTransform().a || 1
  const fit = Math.min(Math.floor(((viewW - 24) * dpr) / scene.w), Math.floor(((viewH - TOP - BOTTOM) * dpr) / scene.h))
  const SCENE_PX = (16 * Math.max(1, Math.floor(fit / 16))) / dpr
  const sw = scene.w * SCENE_PX
  const sh = scene.h * SCENE_PX
  // integer origin + nearest-neighbour scaling: no seams between ground tiles
  const ox = Math.round(((viewW - sw) / 2) * dpr) / dpr
  const oy = Math.round((TOP + (viewH - TOP - BOTTOM - sh) / 2) * dpr) / dpr
  const sx = (x: number) => ox + x * SCENE_PX
  const sy = (y: number) => oy + y * SCENE_PX

  // village ground: grass variants scaled up, crisp like the overworld
  const smoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  const grass = tileset.get(TILE.GRASS)!
  for (let ty = 0; ty < scene.h; ty++) {
    for (let tx = 0; tx < scene.w; tx++) {
      const v = tileHash(tx, ty)
      // a kept plaza: bare turf with the odd wildflower, not the wild country's
      // rocks. tileIndex keeps the pick on the decor axis of the atlas.
      const frame = tileIndex(TILE.GRASS, v % 9 === 0 ? 1 : 0, 0, 0)
      ctx.drawImage(grass[frame], ox + tx * SCENE_PX, oy + ty * SCENE_PX, SCENE_PX, SCENE_PX)
    }
  }
  ctx.imageSmoothingEnabled = smoothing

  // the plaza: generations of feet have packed the earth at the center
  for (const [rx, ry, a] of [[0.3, 0.3, 0.1], [0.24, 0.24, 0.1], [0.17, 0.18, 0.12]] as const) {
    ctx.fillStyle = `rgba(190,150,95,${a})`
    ctx.beginPath()
    ctx.ellipse(sx(scene.w / 2), sy(scene.h / 2 + 0.3), sw * rx, sh * ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // the worn path: soft-edged footprints from the entrance up to the chief,
  // wavering slightly the way real paths do
  ctx.fillStyle = 'rgba(180,142,88,0.16)'
  for (let py = scene.h - 0.15; py > scene.chief.y; py -= 0.4) {
    const wobble = Math.sin(py * 1.7) * 0.22
    ctx.beginPath()
    ctx.arc(sx(scene.w / 2 + wobble), sy(py), SCENE_PX * 0.52, 0, Math.PI * 2)
    ctx.fill()
  }

  // furniture below the buildings so huts overlap it naturally
  for (const p of scene.props) {
    if (p.kind === 'crop') drawCrop(ctx, sx(p.x), sy(p.y), SCENE_PX)
  }

  for (let i = 0; i < scene.huts.length; i++) {
    const [hx, hy] = scene.huts[i]
    drawShadow(ctx, sx(hx + 0.5), sy(hy + 0.8), SCENE_PX * 0.45)
    drawHut(ctx, sx(hx + 0.5), sy(hy + 0.5), SCENE_PX, scene.golden ? '#f4c430' : ROOFS[i % ROOFS.length])
  }

  for (const p of scene.props) {
    if (p.kind === 'fire') drawFire(ctx, sx(p.x), sy(p.y), SCENE_PX, t)
    else if (p.kind === 'pots') drawPots(ctx, sx(p.x), sy(p.y), SCENE_PX)
    else if (p.kind === 'rack') drawRack(ctx, sx(p.x), sy(p.y), SCENE_PX)
  }

  // the chief's mat — and, in a City of Gold, the idol that started the rumors
  ctx.fillStyle = 'rgba(244,196,48,0.18)'
  ctx.beginPath()
  ctx.ellipse(sx(scene.chief.x), sy(scene.chief.y + 0.25), SCENE_PX * 0.9, SCENE_PX * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  if (scene.golden) drawIdol(ctx, sx(scene.chief.x + 1.3), sy(scene.chief.y + 0.15), SCENE_PX, t)
  drawShadow(ctx, sx(scene.chief.x), sy(scene.chief.y + 0.3), SCENE_PX * 0.3)
  drawChief(ctx, sx(scene.chief.x), sy(scene.chief.y), SCENE_PX)

  scene.villagers.forEach((vg, i) => {
    if (vg.appeased) return
    // hostile crowds press forward with urgency in their step
    const bob = (scene.hostile ? Math.sin(t * 10 + i * 1.7) * 0.05 : Math.sin(t * 2.6 + i * 1.3) * 0.02) * SCENE_PX
    const vx = sx(vg.x)
    const vy = sy(vg.y) + bob
    drawShadow(ctx, vx, sy(vg.y + 0.18), SCENE_PX * 0.2)
    drawVillager(ctx, vx, vy, SCENE_PX, i)
    if (vg.emote && vg.emoteT > 0) {
      ctx.font = font(11)
      const ew = ctx.measureText(vg.emote).width + 10
      const ex = Math.max(ox + 4 + ew / 2, Math.min(ox + sw - 4 - ew / 2, vx))
      const ey = Math.max(oy + 14, vy - SCENE_PX * 0.55)
      ctx.fillStyle = 'rgba(10,12,22,0.88)'
      ctx.fillRect(ex - ew / 2, ey - 9, ew, 16)
      ctx.strokeStyle = scene.hostile ? 'rgba(192,80,77,0.85)' : 'rgba(244,196,48,0.65)'
      ctx.lineWidth = 1
      ctx.strokeRect(ex - ew / 2 + 0.5, ey - 8.5, ew - 1, 15)
      ctx.fillStyle = scene.hostile ? '#f0908c' : '#f4e0a0'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(vg.emote, ex, ey - 1)
    }
  })

  // the conquistador at the largest size he is ever drawn — integer-scaled,
  // so the walk-in shows off the sprite work rather than softening it
  const scale = SCENE_PX / 16
  ctx.save()
  ctx.translate(Math.round(sx(scene.px) * dpr) / dpr, Math.round(sy(scene.py) * dpr) / dpr)
  ctx.scale(scale, scale)
  ctx.imageSmoothingEnabled = false
  drawExplorerSprite(ctx, sprites, 0, 7, scene.facing, scene.moving ? scene.gait : 0)
  ctx.restore()

  // the light of the moment: hostile dusk-red, wary overcast, friendly warmth
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, sw, sh)
  ctx.clip()
  if (scene.hostile) {
    ctx.fillStyle = 'rgba(150,30,25,0.08)'
    ctx.fillRect(ox, oy, sw, sh)
    const vig = ctx.createRadialGradient(
      ox + sw / 2, oy + sh / 2, Math.min(sw, sh) * 0.35,
      ox + sw / 2, oy + sh / 2, Math.max(sw, sh) * 0.72,
    )
    vig.addColorStop(0, 'rgba(120,20,16,0)')
    vig.addColorStop(1, 'rgba(120,20,16,0.32)')
    ctx.fillStyle = vig
    ctx.fillRect(ox, oy, sw, sh)
  } else if (moodOf(scene.mood) === 'friendly') {
    ctx.fillStyle = 'rgba(255,214,120,0.05)'
    ctx.fillRect(ox, oy, sw, sh)
  } else {
    ctx.fillStyle = 'rgba(28,30,58,0.06)'
    ctx.fillRect(ox, oy, sw, sh)
  }
  ctx.restore()

  // the frame, broken at the south gate where the path lets you out
  const gap = SCENE_PX * 1.9
  ctx.strokeStyle = scene.hostile ? '#c0504d' : '#f4c430'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(ox + sw / 2 - gap / 2, oy + sh + 2)
  ctx.lineTo(ox - 2, oy + sh + 2)
  ctx.lineTo(ox - 2, oy - 2)
  ctx.lineTo(ox + sw + 2, oy - 2)
  ctx.lineTo(ox + sw + 2, oy + sh + 2)
  ctx.lineTo(ox + sw / 2 + gap / 2, oy + sh + 2)
  ctx.stroke()
  // the gate itself brightens faintly, just inside the frame — the way you
  // came stays the way out
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, sw, sh)
  ctx.clip()
  ctx.fillStyle = 'rgba(210,175,110,0.25)'
  ctx.beginPath()
  ctx.ellipse(ox + sw / 2, oy + sh, gap / 2, SCENE_PX * 0.3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // the mood, spoken plainly in a banner above the scene
  ctx.font = font(16)
  const noteW = Math.min(ctx.measureText(moodNote).width + 44, viewW - 16)
  const nx = (viewW - noteW) / 2
  const ny = oy - 44
  ctx.fillStyle = 'rgba(10,12,22,0.88)'
  ctx.fillRect(nx, ny, noteW, 32)
  ctx.strokeStyle = scene.hostile ? 'rgba(192,80,77,0.8)' : 'rgba(244,196,48,0.6)'
  ctx.lineWidth = 1
  ctx.strokeRect(nx + 0.5, ny + 0.5, noteW - 1, 31)
  // explicit baseline, centred on the plate: the inherited one varies by frame
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = scene.hostile ? '#e08a86' : '#c9c9d2'
  ctx.fillText(moodNote, viewW / 2, ny + 16)

  ctx.fillStyle = '#7a7a86'
  ctx.font = font(14)
  ctx.fillText('Walk to the chief to parley — or walk out the way you came (Esc leaves)', viewW / 2, oy + sh + 30)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}
