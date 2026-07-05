/**
 * Fixed-timestep game loop. `update(dt)` runs at a steady 60Hz (accumulator
 * pattern) so game logic is frame-rate independent; `render()` runs once per
 * animation frame.
 */
export function startLoop(update: (dt: number) => void, render: () => void): () => void {
  const STEP = 1 / 60
  let last = performance.now() / 1000
  let acc = 0
  let running = true

  function frame() {
    if (!running) return
    const now = performance.now() / 1000
    acc += Math.min(now - last, 0.25) // clamp big pauses (tab switch)
    last = now
    while (acc >= STEP) {
      update(STEP)
      acc -= STEP
    }
    render()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  return () => {
    running = false
  }
}
