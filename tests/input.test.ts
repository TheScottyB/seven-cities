import { Input } from '../src/engine/input'

type KeyProps = { key: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; repeat?: boolean }

function setup() {
  const target = new EventTarget()
  const input = new Input(target)
  const down = (p: KeyProps) => target.dispatchEvent(Object.assign(new Event('keydown'), p))
  const up = (p: KeyProps) => target.dispatchEvent(Object.assign(new Event('keyup'), p))
  return { target, input, down, up }
}

test('blur clears held keys', () => {
  const { target, input, down } = setup()
  down({ key: 'ArrowRight' })
  expect(input.axis()).toEqual({ dx: 1, dy: 0 })
  target.dispatchEvent(new Event('blur'))
  expect(input.axis()).toEqual({ dx: 0, dy: 0 })
})

test('swallowHeld() ignores a held key, repeats included, until it is released', () => {
  const { input, down, up } = setup()
  down({ key: 'ArrowUp' })
  input.swallowHeld()
  expect(input.axis()).toEqual({ dx: 0, dy: 0 })
  down({ key: 'ArrowUp', repeat: true }) // the OS keeps auto-repeating the held key
  input.endFrame()
  expect(input.axis()).toEqual({ dx: 0, dy: 0 })
  expect(input.pressed('up')).toBe(false)
  up({ key: 'ArrowUp' })
  down({ key: 'ArrowUp' }) // a fresh press works normally
  expect(input.axis()).toEqual({ dx: 0, dy: -1 })
  expect(input.pressed('up')).toBe(true)
})

test('blur after swallowHeld() does not eat the next press', () => {
  const { target, input, down } = setup()
  down({ key: 'e' })
  input.swallowHeld()
  target.dispatchEvent(new Event('blur')) // released in another window: no keyup arrives
  down({ key: 'e' })
  expect(input.pressed('action')).toBe(true)
})

test('reset() clears held and pending presses', () => {
  const { input, down } = setup()
  down({ key: 'Enter' })
  input.reset()
  expect(input.pressed('enter')).toBe(false)
  expect(input.axis()).toEqual({ dx: 0, dy: 0 })
})

test('uppercase letters normalise (Caps Lock / Shift)', () => {
  const { input, down } = setup()
  down({ key: 'M' })
  expect(input.pressed('m')).toBe(true)
})

test('keyup in a different case still releases the key', () => {
  const { input, down, up } = setup()
  down({ key: 'm' })
  expect(input.pressed('m')).toBe(true)
  up({ key: 'M' })
  down({ key: 'm' })
  expect(input.pressed('m')).toBe(true)
})

test('movement follows physical position (AZERTY Z on KeyW is up)', () => {
  const { input, down } = setup()
  down({ key: 'z', code: 'KeyW' })
  expect(input.axis()).toEqual({ dx: 0, dy: -1 })
})

test('Colemak keeps S down and D right by label', () => {
  const { input, down, up } = setup()
  down({ key: 'r', code: 'KeyS' })
  expect(input.axis()).toEqual({ dx: 0, dy: 0 })
  expect(input.pressed('r')).toBe(true)
  up({ key: 'r', code: 'KeyS' })
  down({ key: 's', code: 'KeyD' })
  expect(input.axis()).toEqual({ dx: 0, dy: 1 })
  up({ key: 's', code: 'KeyD' })
  down({ key: 'd', code: 'KeyG' })
  expect(input.axis()).toEqual({ dx: 1, dy: 0 })
})

test('keepOnBlur holds keys and pending presses across blur', () => {
  const { target, input, down } = setup()
  input.keepOnBlur = true
  down({ key: 'ArrowRight' })
  down({ key: 'Enter' })
  target.dispatchEvent(new Event('blur'))
  expect(input.axis()).toEqual({ dx: 1, dy: 0 })
  expect(input.pressed('enter')).toBe(true)
})

test('mnemonic letters keep their label even on a movement position', () => {
  const { input, down } = setup()
  // Dvorak puts E where QWERTY has D.
  down({ key: 'e', code: 'KeyD' })
  expect(input.pressed('action')).toBe(true)
  expect(input.axis()).toEqual({ dx: 0, dy: 0 })
})

test('IME Process key falls back to the physical code', () => {
  const { input, down } = setup()
  down({ key: 'Process', code: 'KeyF' })
  expect(input.pressed('f')).toBe(true)
})

test('non-Latin layouts and shifted digits fall back to the code', () => {
  const { input, down } = setup()
  down({ key: 'а', code: 'KeyF' })
  down({ key: '!', code: 'Digit1' })
  down({ key: '@', code: 'Numpad2' })
  down({ key: 'у', code: 'KeyE' })
  expect(input.pressed('f')).toBe(true)
  expect(input.pressed('1')).toBe(true)
  expect(input.pressed('2')).toBe(true)
  expect(input.pressed('action')).toBe(true)
})

test('events without code (synthetic) still map', () => {
  const { input, down } = setup()
  for (const key of ['e', 'f', 'Enter', 'Escape', 'ArrowRight', '1']) down({ key })
  expect(input.pressed('action')).toBe(true)
  expect(input.pressed('f')).toBe(true)
  expect(input.pressed('enter')).toBe(true)
  expect(input.pressed('esc')).toBe(true)
  expect(input.pressed('right')).toBe(true)
  expect(input.pressed('1')).toBe(true)
})

test('modifier shortcuts are left to the browser', () => {
  const { target, input, down } = setup()
  const ev = Object.assign(new Event('keydown', { cancelable: true }), { key: 'e', ctrlKey: true })
  target.dispatchEvent(ev)
  expect(ev.defaultPrevented).toBe(false)
  expect(input.pressed('action')).toBe(false)
  down({ key: 'f', ctrlKey: true })
  expect(input.pressed('f')).toBe(false)

  down({ key: 'd', metaKey: true })
  down({ key: 'a', altKey: true })
  expect(input.axis()).toEqual({ dx: 0, dy: 0 })
})

test('Shift is not treated as a shortcut modifier', () => {
  const { input, down } = setup()
  down({ key: 'D' })
  expect(input.axis()).toEqual({ dx: 1, dy: 0 })
})

test('Meta keyup resets held keys', () => {
  const { input, down, up } = setup()
  down({ key: 'ArrowLeft' })
  down({ key: 'Meta' })
  up({ key: 'Meta' })
  expect(input.axis()).toEqual({ dx: 0, dy: 0 })
})

test('WASD, arrows, Space/E, Escape and Enter', () => {
  const { input, down, up } = setup()
  const cases: [string, string][] = [
    ['w', 'up'],
    ['a', 'left'],
    ['s', 'down'],
    ['d', 'right'],
    ['ArrowUp', 'up'],
    ['ArrowLeft', 'left'],
    ['ArrowDown', 'down'],
    ['ArrowRight', 'right'],
    [' ', 'action'],
    ['e', 'action'],
    ['E', 'action'],
    ['Escape', 'esc'],
    ['Enter', 'enter'],
  ]
  for (const [key, want] of cases) {
    down({ key })
    expect(input.pressed(want), key).toBe(true)
    up({ key })
  }
})

test('handled keys suppress the browser default', () => {
  const target = new EventTarget()
  new Input(target)
  const ev = Object.assign(new Event('keydown', { cancelable: true }), { key: ' ' })
  target.dispatchEvent(ev)
  expect(ev.defaultPrevented).toBe(true)
})

test('one edge per physical press', () => {
  const { input, down, up } = setup()
  down({ key: 'Enter' })
  down({ key: 'Enter' })
  expect(input.pressed('enter')).toBe(true)
  expect(input.pressed('enter')).toBe(false)
  input.endFrame()
  down({ key: 'Enter', repeat: true })
  expect(input.pressed('enter')).toBe(false)
  up({ key: 'Enter' })
  down({ key: 'Enter' })
  expect(input.pressed('enter')).toBe(true)
})

test('auto-repeat feeds pressedOrRepeat but not pressed', () => {
  const { input, down } = setup()
  down({ key: 'ArrowDown' })
  expect(input.pressedOrRepeat('down')).toBe(true)
  input.endFrame()
  down({ key: 'ArrowDown', repeat: true })
  expect(input.pressed('down')).toBe(false)
  expect(input.pressedOrRepeat('down')).toBe(true)
  expect(input.pressedOrRepeat('down')).toBe(false)
  down({ key: 'ArrowDown', repeat: true })
  input.endFrame()
  expect(input.pressedOrRepeat('down')).toBe(false)
})

test('explicit resource management (using / Symbol.dispose) detaches listeners', () => {
  const target = new EventTarget()
  let leaked: Input
  {
    using input = new Input(target)
    leaked = input
    target.dispatchEvent(Object.assign(new Event('keydown'), { key: 'ArrowRight' }))
    expect(input.axis()).toEqual({ dx: 1, dy: 0 })
  }
  expect(leaked.axis()).toEqual({ dx: 0, dy: 0 })
  target.dispatchEvent(Object.assign(new Event('keydown'), { key: 'ArrowLeft' }))
  expect(leaked.axis()).toEqual({ dx: 0, dy: 0 })
})

test('Tab maps to tab with default prevented, and H / ? register for help', () => {
  const { target, input, down } = setup()
  const tabEv = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Tab', code: 'Tab' })
  target.dispatchEvent(tabEv)
  expect(tabEv.defaultPrevented).toBe(true)
  expect(input.pressed('tab')).toBe(true)

  down({ key: 'h', code: 'KeyH' })
  expect(input.pressed('h')).toBe(true)
  down({ key: '?', code: 'Slash' })
  expect(input.pressed('?')).toBe(true)
})
