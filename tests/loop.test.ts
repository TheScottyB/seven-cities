import { startLoop } from '../src/engine/loop'

let frames: FrameRequestCallback[] = []
let clock = 0

beforeEach(() => {
  frames = []
  clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Advance the clock by `ms` and run the one pending frame. */
function tick(ms: number) {
  clock += ms
  const pending = frames
  frames = []
  expect(pending).toHaveLength(1)
  pending[0](clock)
}

test('runs fixed steps from accumulated time', () => {
  const update = vi.fn()
  const render = vi.fn()
  startLoop(update, render)
  tick(50) // 3 steps of 1/60s
  expect(update).toHaveBeenCalledTimes(3)
  expect(render).toHaveBeenCalledTimes(1)
})

test('a throwing update reports once, resets the accumulator and keeps going', () => {
  let throwNext = true
  const update = vi.fn(() => {
    if (throwNext) {
      throwNext = false
      throw new Error('boom')
    }
  })
  const render = vi.fn()
  const onError = vi.fn()
  startLoop(update, render, { onError })

  tick(50)
  expect(update).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
  expect(render).toHaveBeenCalledTimes(1)
  expect(frames).toHaveLength(1)

  // The leftover ~2 steps were dropped; a single step's worth of time runs once.
  tick(1000 / 60 + 0.1)
  expect(update).toHaveBeenCalledTimes(2)
  expect(onError).toHaveBeenCalledTimes(1)
})

test('a throwing render is reported and the next frame is still scheduled', () => {
  const onError = vi.fn()
  startLoop(
    () => {},
    () => {
      throw new Error('draw')
    },
    { onError },
  )
  tick(20)
  expect(onError).toHaveBeenCalledTimes(1)
  expect(frames).toHaveLength(1)
})

test('without onError, errors go to console.error', () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {})
  startLoop(() => {
    throw new Error('x')
  }, () => {})
  tick(20)
  expect(err).toHaveBeenCalledTimes(1)
  expect(frames).toHaveLength(1)
})

test('while paused, update is skipped but render runs and time does not bank', () => {
  let paused = true
  const update = vi.fn()
  const render = vi.fn()
  startLoop(update, render, { isPaused: () => paused })

  tick(100)
  tick(100)
  expect(update).not.toHaveBeenCalled()
  expect(render).toHaveBeenCalledTimes(2)
  expect(frames).toHaveLength(1)

  paused = false
  tick(1000 / 60 + 0.1)
  expect(update).toHaveBeenCalledTimes(1)
})

test('stop function halts the loop', () => {
  const render = vi.fn()
  const stop = startLoop(() => {}, render)
  stop()
  tick(20)
  expect(render).not.toHaveBeenCalled()
  expect(frames).toHaveLength(0)
})
