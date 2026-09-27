import type { GameMap } from './mapgen'
import { TILE } from './tiles'

/**
 * Chebyshev rings from the tile under (x, y) to the nearest non-ocean tile:
 * 0 on land, Infinity when nothing lies within maxR.
 */
export function nearestLandDist(map: GameMap, x: number, y: number, maxR = 14): number {
  const ex = Math.floor(x)
  const ey = Math.floor(y)
  const land = (tx: number, ty: number) =>
    tx >= 0 && ty >= 0 && tx < map.width && ty < map.height && map.tiles[ty * map.width + tx] !== TILE.OCEAN
  if (land(ex, ey)) return 0
  for (let r = 1; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) if (land(ex + dx, ey - r) || land(ex + dx, ey + r)) return r
    for (let dy = -r + 1; dy <= r - 1; dy++) if (land(ex - r, ey + dy) || land(ex + r, ey + dy)) return r
  }
  return Infinity
}
