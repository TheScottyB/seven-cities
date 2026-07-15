import { GameMap } from '../world/mapgen'
import { stormCenter, type Weather } from '../game/weather'
import { Fog, isSeen } from '../world/fog'
import { Explorer } from '../game/explorer'
import type { Village } from '../world/villages'
import { Camera, worldToScreen } from './camera'
import { TILE_PX, type Tileset } from '../art/tileset'
import { drawExplorer, drawVillage, drawShip, drawCanoe, drawFort, drawShadow } from '../art/sprites'
import type { Outpost } from '../game/outposts'
import { TILE } from '../world/tiles'

export interface RenderCtx {
  ctx: CanvasRenderingContext2D
  viewW: number
  viewH: number
  tileset: Tileset
}

/** How close (in tiles) the explorer must be for a tile to count as "in view". */
const VIEW_RADIUS = 5

/** deterministic per-tile hash for variant selection */
function tileHash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0
}

export function renderWorld(
  rc: RenderCtx,
  cam: Camera,
  map: GameMap,
  fog: Fog,
  villages: Village[],
  explorer: Explorer,
  ships: { x: number; y: number }[],
  activeShip: number,
  sailing: boolean,
  outposts: Outpost[],
): void {
  const { ctx, viewW, viewH, tileset } = rc
  ctx.fillStyle = '#05060a'
  ctx.fillRect(0, 0, viewW, viewH)

  const cols = Math.ceil(viewW / TILE_PX) + 2
  const rows = Math.ceil(viewH / TILE_PX) + 2
  const startX = Math.floor(cam.x - cols / 2)
  const startY = Math.floor(cam.y - rows / 2)

  // water shimmer: cycle ocean/river variants slowly over time
  const waterFrame = Math.floor(performance.now() / 450)
  const landAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false
    const t = map.tiles[y * map.width + x]
    return t !== TILE.OCEAN && t !== TILE.RIVER
  }

  for (let ty = startY; ty < startY + rows; ty++) {
    for (let tx = startX; tx < startX + cols; tx++) {
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue
      const { sx, sy } = worldToScreen(cam, viewW, viewH, tx, ty)
      if (!isSeen(fog, tx, ty)) {
        ctx.fillStyle = '#05060a'
        ctx.fillRect(sx, sy, TILE_PX, TILE_PX)
        continue
      }
      const t = map.tiles[ty * map.width + tx]
      const variants = tileset.get(t)!
      const water = t === TILE.OCEAN || t === TILE.RIVER
      const idx = (tileHash(tx, ty) + (water ? waterFrame : 0)) % variants.length
      ctx.drawImage(variants[idx], sx, sy)

      // shoreline foam where the sea meets land
      if (t === TILE.OCEAN) {
        ctx.fillStyle = 'rgba(232,240,248,0.4)'
        if (landAt(tx, ty - 1)) ctx.fillRect(sx, sy, TILE_PX, 2)
        if (landAt(tx, ty + 1)) ctx.fillRect(sx, sy + TILE_PX - 2, TILE_PX, 2)
        if (landAt(tx - 1, ty)) ctx.fillRect(sx, sy, 2, TILE_PX)
        if (landAt(tx + 1, ty)) ctx.fillRect(sx + TILE_PX - 2, sy, 2, TILE_PX)
      } else if (t !== TILE.RIVER) {
        // soft seams where land terrains change — defines the country
        const at = (x: number, y: number) =>
          x < 0 || y < 0 || x >= map.width || y >= map.height ? t : map.tiles[y * map.width + x]
        ctx.fillStyle = 'rgba(10,14,10,0.16)'
        const e = at(tx + 1, ty), so = at(tx, ty + 1)
        if (e !== t && e !== TILE.OCEAN && e !== TILE.RIVER) ctx.fillRect(sx + TILE_PX - 1, sy, 1, TILE_PX)
        if (so !== t && so !== TILE.OCEAN && so !== TILE.RIVER) ctx.fillRect(sx, sy + TILE_PX - 1, TILE_PX, 1)
      }

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
    drawShadow(ctx, sx, sy + TILE_PX * 0.32, TILE_PX * 0.46)
    drawVillage(ctx, sx, sy, v.golden, v.visited)
    ctx.globalAlpha = 1
  }

  // mission forts on the trail
  for (const o of outposts) {
    if (!isSeen(fog, Math.floor(o.x), Math.floor(o.y))) continue
    const p = worldToScreen(cam, viewW, viewH, o.x + 0.5, o.y + 0.5)
    drawShadow(ctx, p.sx, p.sy + TILE_PX * 0.3, TILE_PX * 0.45)
    drawFort(ctx, p.sx, p.sy)
  }

  // the moored fleet, once its waters are charted
  ships.forEach((sh, i) => {
    if (sailing && i === activeShip) return // the flagship is under you
    if (!isSeen(fog, Math.floor(sh.x), Math.floor(sh.y))) return
    const p = worldToScreen(cam, viewW, viewH, sh.x, sh.y)
    drawShadow(ctx, p.sx, p.sy + TILE_PX * 0.3, TILE_PX * 0.42)
    drawShip(ctx, p.sx, p.sy)
  })

  const { sx, sy } = worldToScreen(cam, viewW, viewH, explorer.x, explorer.y)
  const underfoot = map.tiles[Math.floor(explorer.y) * map.width + Math.floor(explorer.x)]
  drawShadow(ctx, sx, sy + TILE_PX * 0.34, TILE_PX * 0.34)
  if (sailing) drawShip(ctx, sx, sy)
  else if (underfoot === TILE.RIVER) drawCanoe(ctx, sx, sy)
  else drawExplorer(ctx, sx, sy)
}

/** Roaming storm cells: a dark squall with animated rain, once its waters are charted. */
export function renderStorms(
  rc: RenderCtx,
  cam: Camera,
  weather: Weather,
  t: number,
  map: GameMap,
  fog: Fog,
): void {
  const { ctx, viewW, viewH } = rc
  for (const s of weather.storms) {
    const c = stormCenter(s, t, map.width, map.height)
    const cx = Math.max(0, Math.min(map.width - 1, Math.floor(c.x)))
    const cy = Math.max(0, Math.min(map.height - 1, Math.floor(c.y)))
    if (!isSeen(fog, cx, cy)) continue
    const p = worldToScreen(cam, viewW, viewH, c.x, c.y)
    const rp = s.r * TILE_PX
    if (p.sx < -rp || p.sy < -rp || p.sx > viewW + rp || p.sy > viewH + rp) continue
    // squall shadow
    const grad = ctx.createRadialGradient(p.sx, p.sy, rp * 0.2, p.sx, p.sy, rp)
    grad.addColorStop(0, 'rgba(16,20,38,0.55)')
    grad.addColorStop(1, 'rgba(16,20,38,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(p.sx, p.sy, rp, 0, Math.PI * 2)
    ctx.fill()
    // slanted rain, animated
    ctx.strokeStyle = 'rgba(210,222,240,0.35)'
    ctx.lineWidth = 1
    const anim = (performance.now() / 60) % TILE_PX
    ctx.beginPath()
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const rr = rp * (0.25 + ((i * 37) % 60) / 100)
      const x = p.sx + Math.cos(a) * rr
      const y = p.sy + Math.sin(a) * rr + anim
      ctx.moveTo(x, y)
      ctx.lineTo(x - 3, y + 6)
    }
    ctx.stroke()
  }
}

/** Small charted-territory minimap in the corner. */
export function renderMinimap(
  rc: RenderCtx,
  map: GameMap,
  fog: Fog,
  explorer: Explorer,
  villages: Village[],
  ships: { x: number; y: number }[] = [],
  outposts: Outpost[] = [],
  top = 52,
): void {
  const { ctx, viewW } = rc
  const size = 120
  const px = viewW - size - 12
  const py = top
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
  ctx.fillStyle = '#cfe6ff'
  for (const sh of ships) ctx.fillRect(px + sh.x * scale - 1, py + sh.y * scale - 1, 3, 3)
  ctx.fillStyle = '#e8d8a0'
  for (const o of outposts) ctx.fillRect(px + o.x * scale - 1, py + o.y * scale - 1, 3, 3)
}
