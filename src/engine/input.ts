export class Input {
  private held = new Set<string>()
  private edge = new Set<string>()
  private repeat = new Set<string>()
  /** keys still physically down after swallowHeld(); ignored until released */
  private swallowed = new Set<string>()
  /** A driver that sends its own keydown/keyup pairs keeps them across blur and hide. */
  keepOnBlur = false

  constructor(target: EventTarget = window) {
    target.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent
      // Leave browser/OS shortcuts (Ctrl+R, Cmd+W, Alt+Tab) to the browser.
      if (ke.ctrlKey || ke.metaKey || ke.altKey) return
      const k = key(ke)
      if (this.swallowed.has(k)) {
        if (HANDLED.has(k)) ke.preventDefault()
        return
      }
      if (ke.repeat || this.held.has(k)) this.repeat.add(k)
      else this.edge.add(k)
      this.held.add(k)
      if (HANDLED.has(k)) ke.preventDefault()
    })
    target.addEventListener('keyup', (e) => {
      const ke = e as KeyboardEvent
      const k = key(ke)
      this.held.delete(k)
      this.swallowed.delete(k)
      // macOS swallows keyups for keys released while Cmd was down.
      if (ke.key === 'Meta') this.reset()
    })
    // Keyups that land in another window never arrive; drop everything held.
    target.addEventListener('blur', () => {
      if (!this.keepOnBlur) this.reset()
    })
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && !this.keepOnBlur) this.reset()
      })
    }
  }

  /** Forget all held and pending keys. */
  reset(): void {
    this.held.clear()
    this.edge.clear()
    this.repeat.clear()
    this.swallowed.clear()
  }

  /**
   * Forget every key now held and ignore each one — auto-repeats included —
   * until it is released, so the press that dismissed a pause does nothing else.
   */
  swallowHeld(): void {
    const held = [...this.held]
    this.reset()
    for (const k of held) this.swallowed.add(k)
  }

  /** Normalized-ish movement axis from WASD / arrow keys. */
  axis(): { dx: number; dy: number } {
    let dx = 0,
      dy = 0
    if (this.held.has('left')) dx -= 1
    if (this.held.has('right')) dx += 1
    if (this.held.has('up')) dy -= 1
    if (this.held.has('down')) dy += 1
    return { dx, dy }
  }

  /** True once per physical key press (consumed on read). */
  pressed(k: string): boolean {
    if (this.edge.has(k)) {
      this.edge.delete(k)
      return true
    }
    return false
  }

  /** Like pressed(), but also true for OS auto-repeat while the key is held. */
  pressedOrRepeat(k: string): boolean {
    const hit = this.edge.delete(k)
    return this.repeat.delete(k) || hit
  }

  /** Clear per-frame edge state. Call at the end of each update. */
  endFrame(): void {
    this.edge.clear()
    this.repeat.clear()
  }
}

const HANDLED = new Set(['left', 'right', 'up', 'down', 'action', '1', '2', '3', 'esc'])

const PHYSICAL_MOVE: Record<string, string> = {
  KeyW: 'up',
  KeyA: 'left',
  KeyS: 'down',
  KeyD: 'right',
}

// Letters whose on-screen labels name the character, not the key position.
const MNEMONIC = new Set(['f', 'm', 'c', 'r', 'e'])

/**
 * Map a key event to a logical key. Keydown and keyup must go through here
 * alike so a press released under a different case/layout still clears.
 * `code` may be absent (synthetic events), so every branch works from `key`.
 */
function key(e: KeyboardEvent): string {
  const raw = e.key ?? ''
  const k = raw.length === 1 ? raw.toLowerCase() : raw
  const move = e.code ? PHYSICAL_MOVE[e.code] : undefined
  // a label that is itself a movement letter wins (Colemak S sits on KeyD)
  if (move && !MNEMONIC.has(k) && !/^[wasd]$/.test(k)) return move
  const foreign = k === 'Process' || k === 'Unidentified' || (k.length === 1 && !/[a-z0-9 ]/.test(k))
  return logical((foreign && e.code && fromCode(e.code)) || k)
}

function logical(k: string): string {
  switch (k) {
    case 'ArrowLeft':
    case 'a':
      return 'left'
    case 'ArrowRight':
    case 'd':
      return 'right'
    case 'ArrowUp':
    case 'w':
      return 'up'
    case 'ArrowDown':
    case 's':
      return 'down'
    case 'e':
    case ' ':
      return 'action'
    case 'Escape':
      return 'esc'
    case 'Enter':
      return 'enter'
    default:
      return k
  }
}

/** Layout-independent fallback for IME, non-Latin layouts and shifted digits. */
function fromCode(code: string): string | undefined {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase()
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code)
  return digit ? digit[1] : undefined
}
