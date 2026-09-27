// Leaf module: no imports, so the art layer can share these without pulling in
// the world or game code.

/** Sprite facings, in the order the sprite bank indexes them. Saves store these numbers. */
export const Facing = { S: 0, W: 1, E: 2, N: 3 } as const

/**
 * Length of the gait counter's wrap, in tiles travelled.
 *
 * This MUST stay commensurate with the walk cycle: the sprite bank picks its
 * frame with floor(gait * GAIT_RATE) & 3, so the wrap has to land on a whole
 * number of 4-frame cycles. 8 * 2.0 = 16 frame-steps = exactly 4 cycles. Pick
 * an incommensurate pair (2.2, say) and the figure visibly snaps mid-stride
 * every time the counter wraps.
 */
export const GAIT_CYCLE = 8
export const GAIT_RATE = 2.0
