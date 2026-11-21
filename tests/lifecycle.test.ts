import {
  makeLifecycle,
  isIgnoredKey,
  offerGesture,
  routeKey,
  routeClick,
  pauseForFocus,
  takeFirstUnlock,
  standAside,
} from '../src/app/lifecycle'

const unlocks = (result: boolean) => vi.fn(() => result)

test('the first trusted unlock is swallowed once, and only that one', () => {
  const lc = makeLifecycle(false)
  offerGesture(lc, true, unlocks(true))
  expect(lc.gestured).toBe(true)
  expect(lc.audioPrimed).toBe(true)
  expect(takeFirstUnlock(lc)).toBe(true)
  expect(takeFirstUnlock(lc)).toBe(false)
  // a later unlock (a woken context) is not swallowed again
  offerGesture(lc, true, unlocks(true))
  expect(takeFirstUnlock(lc)).toBe(false)
})

test('a synthetic event can unlock but is never the swallowed press', () => {
  const lc = makeLifecycle(false)
  const unlock = unlocks(true)
  offerGesture(lc, false, unlock)
  expect(unlock).toHaveBeenCalledOnce()
  expect(lc.gestured).toBe(true)
  expect(lc.audioPrimed).toBe(false)
  expect(takeFirstUnlock(lc)).toBe(false)
})

test('a failed unlock primes nothing', () => {
  const lc = makeLifecycle(false)
  offerGesture(lc, true, unlocks(false))
  expect(lc.gestured).toBe(true)
  expect(lc.audioPrimed).toBe(false)
  expect(lc.swallowStart).toBe(false)
})

test('after a crash a gesture counts but never touches audio', () => {
  const lc = makeLifecycle(false)
  lc.crashed = true
  const unlock = unlocks(true)
  offerGesture(lc, true, unlock)
  expect(unlock).not.toHaveBeenCalled()
  expect(lc.gestured).toBe(true)
  expect(lc.swallowStart).toBe(false)
})

test('keys: any key clears touch-only; crash routes to the recovery card unless a bot drives', () => {
  const lc = makeLifecycle(true)
  expect(routeKey(lc, true, unlocks(false))).toBe('play')
  expect(lc.touchOnly).toBe(false)
  lc.paused = true
  expect(routeKey(lc, true, unlocks(false))).toBe('unpause')
  expect(lc.paused).toBe(false) // the routed press ended the pause
  expect(routeKey(lc, true, unlocks(false))).toBe('play')
  lc.crashed = true
  lc.paused = true
  expect(routeKey(lc, true, unlocks(false))).toBe('recovery')
  expect(lc.paused).toBe(true) // the recovery card's keys leave a pause alone
  lc.driven = true
  expect(routeKey(lc, true, unlocks(false))).toBe('unpause')
  expect(lc.paused).toBe(false)
  expect(routeKey(lc, true, unlocks(false))).toBe('play')
})

test('clicks: ignored after a crash, end a pause, else reach the hit regions', () => {
  const lc = makeLifecycle(true)
  expect(routeClick(lc, true, unlocks(false))).toBe('hit')
  expect(lc.touchOnly).toBe(true) // only a key proves a keyboard
  lc.paused = true
  expect(routeClick(lc, true, unlocks(false))).toBe('unpause')
  expect(lc.paused).toBe(false) // the routed click ended the pause
  expect(routeClick(lc, true, unlocks(false))).toBe('hit')
  lc.paused = true
  lc.crashed = true
  lc.driven = true
  expect(routeClick(lc, true, unlocks(false))).toBe('ignore')
  expect(lc.paused).toBe(true)
})

test('blur and hide pause only mid-expedition, and not while crashed or driven', () => {
  for (const screen of ['start', 'outfit', 'spain', 'over'] as const) {
    expect(pauseForFocus(makeLifecycle(false), screen)).toBe(false)
  }
  const lc = makeLifecycle(false)
  expect(pauseForFocus(lc, 'playing')).toBe(true)
  expect(lc.paused).toBe(true)
  expect(pauseForFocus(lc, 'walkin')).toBe(false) // already paused
  const walk = makeLifecycle(false)
  expect(pauseForFocus(walk, 'walkin')).toBe(true)
  const crashed = makeLifecycle(false)
  crashed.crashed = true
  expect(pauseForFocus(crashed, 'playing')).toBe(false)
  const driven = makeLifecycle(false)
  driven.driven = true
  expect(pauseForFocus(driven, 'playing')).toBe(false)
  expect(driven.paused).toBe(false)
})

test('standAside clears every gate a bot would trip on', () => {
  const lc = makeLifecycle(true)
  lc.paused = true
  lc.swallowStart = true
  standAside(lc)
  expect(lc).toEqual({
    crashed: false,
    paused: false,
    gestured: true,
    audioPrimed: true,
    swallowStart: false,
    touchOnly: false,
    driven: true,
  })
  // primed, so a bot's (untrusted or trusted) key is never swallowed afterwards
  offerGesture(lc, true, unlocks(true))
  expect(takeFirstUnlock(lc)).toBe(false)
  expect(pauseForFocus(lc, 'playing')).toBe(false)
})

test('isIgnoredKey filters OS/browser shortcuts and bare modifiers but allows Shift+letter and normal keys', () => {
  expect(isIgnoredKey({ key: 'r', ctrlKey: true })).toBe(true)
  expect(isIgnoredKey({ key: 'Tab', metaKey: true })).toBe(true)
  expect(isIgnoredKey({ key: 'Tab', altKey: true })).toBe(true)
  for (const mod of ['Shift', 'Control', 'Alt', 'Meta']) {
    expect(isIgnoredKey({ key: mod })).toBe(true)
  }
  expect(isIgnoredKey({ key: 'M' })).toBe(false)
  expect(isIgnoredKey({ key: 'Enter' })).toBe(false)
  expect(isIgnoredKey({ key: 'Escape' })).toBe(false)
})
