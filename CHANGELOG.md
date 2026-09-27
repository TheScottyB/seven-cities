# Changelog

## 1.0.0

The first public release.

- **Hardening.** A crash shows a recovery card (Esc reloads, X discards the save) instead of
  a frozen frame. The game pauses when the window loses focus or the tab is hidden, saves
  on hide and page exit, and suspends audio while hidden. Held keys are released on blur,
  and browser shortcuts with Ctrl, Cmd or Alt are left to the browser.
- **Saves.** Save format v7 is the 1.0 baseline. A save is checked against the world it
  was taken in and an unreadable one is reported, not loaded. A save taken on the way to
  Spain resumes on the outfitting screen. Only one tab writes the save at a time, the
  outfitting screen warns before a new expedition replaces it, and the game says so when
  the browser blocks storage.
- **Controls.** One rule decides what `E` acts on, and the on-screen prompt reads the same
  rule. Keys work across keyboard layouts and input methods. Holding an arrow repeats on
  the outfitting screen. Mute is remembered, and the corner key hint drops `F` at sea.
- **Accessibility.** HUD warnings carry a `!` mark as well as a colour, the OS
  reduced-motion setting is respected, and touch-only devices get a keyboard-required
  notice. The page declares its language, a description and a labelled canvas.
- **Rules.** Village hostility, fort crew requirements and the final score breakdown each
  come from one shared definition, and the score shown at game over matches the one
  recorded in the Chronicle.
- **Tooling.** Strict TypeScript settings, a relative build base for hosting in any
  subfolder, an `npm run check` gate (typecheck, tests, build, and a check that the dev-only
  `window.__dbg` hook is stripped from production), and CI that runs it.
