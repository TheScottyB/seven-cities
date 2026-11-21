/**
 * The shell's lifecycle gates as plain data and rules: the blur/hide pause, the
 * crash latch, the first-gesture audio unlock and the start press it swallows. No DOM.
 */
import type { Screen } from '../game/screen'

export interface Lifecycle {
  /** Set by the loop's error handler; the canvas shows only the recovery card from then on. */
  crashed: boolean
  /** Blur or hide during play: the simulation holds until the next key or click. */
  paused: boolean
  /** Any key or click so far; the title stops asking for one. */
  gestured: boolean
  /** The first unlock has happened (or a bot primed audio); only that one is swallowed. */
  audioPrimed: boolean
  /** The pending gesture struck up the title theme; a start action it carried is dropped. */
  swallowStart: boolean
  /** A phone or tablet with no keyboard: the title asks for one before offering a run. */
  touchOnly: boolean
  /** DEV: a bot drives through __dbg, so blur/hide pauses would only eat its keys. */
  driven: boolean
}

export function makeLifecycle(touchOnly: boolean): Lifecycle {
  return {
    crashed: false,
    paused: false,
    gestured: false,
    audioPrimed: false,
    swallowStart: false,
    touchOnly,
    driven: false,
  }
}

/**
 * Every key or click offers the browser audio (`unlock`, true when it started or
 * woke audio); the first success is remembered. A synthetic event cannot start
 * audio, so it is never the press that gets swallowed.
 */
export function offerGesture(lc: Lifecycle, trusted: boolean, unlock: () => boolean): void {
  lc.gestured = true
  if (lc.crashed) return // the card keeps audio silent
  if (unlock() && !lc.audioPrimed && trusted) {
    lc.audioPrimed = true
    lc.swallowStart = true
  }
}

/** Where a keydown goes: the recovery card's keys, the press that ends a pause, or the game. */
export type KeyRoute = 'recovery' | 'unpause' | 'play'

/** The key or click that ends a pause clears it here; the caller drops that press. */
function endPause(lc: Lifecycle): 'unpause' {
  lc.paused = false
  return 'unpause'
}

const BARE_MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

/**
 * Browser/OS shortcuts (Cmd+Tab, Ctrl+R, Alt+Tab) and bare modifier presses
 * must not unpause the game, clear touch-only mode, or consume the first audio
 * unlock gesture. Shift+letter (e.g. Shift+M) has key === 'M' and passes through.
 */
export function isIgnoredKey(e: {
  key?: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}): boolean {
  return !!(e.ctrlKey || e.metaKey || e.altKey || (e.key && BARE_MODIFIERS.has(e.key)))
}

export function routeKey(lc: Lifecycle, trusted: boolean, unlock: () => boolean): KeyRoute {
  lc.touchOnly = false
  offerGesture(lc, trusted, unlock)
  // a driving bot's keys go to Input; step() still runs update() after a crash
  if (lc.crashed && !lc.driven) return 'recovery'
  return lc.paused ? endPause(lc) : 'play'
}

/** Where a canvas click goes: nowhere after a crash, into ending a pause, or to the hit regions. */
export type ClickRoute = 'ignore' | 'unpause' | 'hit'

export function routeClick(lc: Lifecycle, trusted: boolean, unlock: () => boolean): ClickRoute {
  offerGesture(lc, trusted, unlock)
  if (lc.crashed) return 'ignore'
  return lc.paused ? endPause(lc) : 'hit'
}

/** Pause for blur/hide, only mid-expedition; true when this call paused. */
export function pauseForFocus(lc: Lifecycle, screen: Screen): boolean {
  if (lc.paused || lc.crashed || lc.driven) return false
  if (screen !== 'playing' && screen !== 'walkin') return false
  lc.paused = true
  return true
}

/** Read and clear the pending swallow, once per update: true when this frame's press struck up the title theme. */
export function takeFirstUnlock(lc: Lifecycle): boolean {
  const first = lc.swallowStart
  lc.swallowStart = false
  return first
}

/** A bot is driving: clear every lifecycle gate so no key it sends is eaten (Input.keepOnBlur is the caller's). */
export function standAside(lc: Lifecycle): void {
  lc.driven = true
  lc.paused = false
  lc.audioPrimed = true
  lc.gestured = true
  lc.swallowStart = false
  lc.touchOnly = false
}
