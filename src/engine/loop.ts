export interface LoopOptions {
  /** Called with anything update() or render() throws; the loop keeps running. */
  onError?: (err: unknown) => void
  /** While true, update() is skipped and time does not accumulate. */
  isPaused?: () => boolean
}

/**
 * Fixed-timestep game loop. `update(dt)` runs at a steady 60Hz (accumulator
 * pattern) so game logic is frame-rate independent; `render()` runs once per
 * animation frame. A throw never stops the next frame from being scheduled.
 */
export function startLoop(
  update: (dt: number) => void,
  render: () => void,
  opts: LoopOptions = {},
): () => void {
  const STEP = 1 / 60
  let last = performance.now() / 1000
  let acc = 0
  let running = true

  function fail(err: unknown) {
    acc = 0
    try {
      if (opts.onError) opts.onError(err)
      else console.error(err)
    } catch (inner) {
      console.error(err, inner)
    }
  }

  function frame() {
    if (!running) return
    const now = performance.now() / 1000
    const dt = Math.min(now - last, 0.25) // clamp big pauses (tab switch)
    last = now
    try {
      if (opts.isPaused?.()) {
        acc = 0
      } else {
        acc += dt
        while (acc >= STEP) {
          update(STEP)
          acc -= STEP
        }
      }
    } catch (err) {
      fail(err)
    }
    try {
      render()
    } catch (err) {
      fail(err)
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  return () => {
    running = false
  }
}
