import { makeRng } from './rng'

/**
 * Fractal value noise in [0, 1]. Builds a seeded 256x256 lattice of random
 * values and samples it with smoothed bilinear interpolation over 4 octaves.
 */
export function makeNoise2D(seed: number, gridSize = 8): (x: number, y: number) => number {
  const rng = makeRng(seed)
  const size = 256
  const grid = new Float32Array(size * size)
  for (let i = 0; i < grid.length; i++) grid[i] = rng()

  const at = (xi: number, yi: number) => grid[(yi & 255) * size + (xi & 255)]
  const smooth = (t: number) => t * t * (3 - 2 * t)

  const sample = (x: number, y: number) => {
    const x0 = Math.floor(x),
      y0 = Math.floor(y)
    const fx = smooth(x - x0),
      fy = smooth(y - y0)
    const v00 = at(x0, y0),
      v10 = at(x0 + 1, y0)
    const v01 = at(x0, y0 + 1),
      v11 = at(x0 + 1, y0 + 1)
    const top = v00 + (v10 - v00) * fx
    const bot = v01 + (v11 - v01) * fx
    return top + (bot - top) * fy
  }

  return (x: number, y: number) => {
    let amp = 1,
      freq = 1 / gridSize,
      sum = 0,
      norm = 0
    for (let o = 0; o < 4; o++) {
      sum += sample(x * freq, y * freq) * amp
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return sum / norm
  }
}
