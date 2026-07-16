/**
 * Clickable regions for the canvas UI. Draw code registers a region for each
 * interactive element every frame; the click handler asks what was hit.
 * Pure data, no DOM — unit-testable.
 */
export interface HitRegion {
  id: string
  x: number
  y: number
  w: number
  h: number
}

const regions: HitRegion[] = []

/** Clear all regions; call at the start of every frame before drawing UI. */
export function beginHits(): void {
  regions.length = 0
}

export function addHit(id: string, x: number, y: number, w: number, h: number): void {
  regions.push({ id, x, y, w, h })
}

/** Topmost (most recently registered) region containing the point, or null. */
export function hitAt(x: number, y: number): string | null {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i]
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.id
  }
  return null
}

// The pointer's current rest: draw code brightens whatever it hovers.
let hover: string | null = null

export function setHover(id: string | null): void {
  hover = id
}

export function hovered(id: string): boolean {
  return hover === id
}
