export interface Fog {
  width: number
  height: number
  seen: Uint8Array
  revealedCount: number
}

export function makeFog(width: number, height: number): Fog {
  return { width, height, seen: new Uint8Array(width * height), revealedCount: 0 }
}

export function reveal(fog: Fog, cx: number, cy: number, radius: number): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue
      const x = cx + dx,
        y = cy + dy
      if (x < 0 || y < 0 || x >= fog.width || y >= fog.height) continue
      const i = y * fog.width + x
      if (!fog.seen[i]) {
        fog.seen[i] = 1
        fog.revealedCount++
      }
    }
  }
}

/** Unchecked lookup: the caller must keep (x, y) inside the fog's bounds. */
export function isSeen(fog: Fog, x: number, y: number): boolean {
  return fog.seen[y * fog.width + x] === 1
}
