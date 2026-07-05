export class Input {
  private held = new Set<string>()
  private edge = new Set<string>()

  constructor(target: EventTarget = window) {
    target.addEventListener('keydown', (e) => {
      const k = key(e as KeyboardEvent)
      if (!this.held.has(k)) this.edge.add(k)
      this.held.add(k)
      if (HANDLED.has(k)) (e as KeyboardEvent).preventDefault()
    })
    target.addEventListener('keyup', (e) => this.held.delete(key(e as KeyboardEvent)))
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

  /** Clear per-frame edge state. Call at the end of each update. */
  endFrame(): void {
    this.edge.clear()
  }
}

const HANDLED = new Set(['left', 'right', 'up', 'down', 'action', '1', '2', '3', 'esc'])

function key(e: KeyboardEvent): string {
  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left'
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right'
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up'
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down'
    case 'e':
    case 'E':
    case ' ':
      return 'action'
    case 'Escape':
      return 'esc'
    case 'Enter':
      return 'enter'
    default:
      return e.key
  }
}
