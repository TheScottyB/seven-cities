# Changelog

## 1.1.0

1984 *Seven Cities of Gold* authenticity, cartography, accessibility, and polish.

- **Landmark discoveries & Royal Fame.** Each generated world now places 5–7 deterministic
  geographic landmarks (cordillera peaks, river mouths, capes, bays, and offshore islands)
  with 1984-meets-Pythonesque names. Charting them awards `+50` fame per landmark, rings a
  procedural `'discover'` bell triad, and tallies on the Spain Court and Game Over screens.
- **Save format v8 (`v7 → v8` upgrade).** Persists discovered landmark IDs alongside full
  expedition state while transparently upgrading existing v7 saves on read.
- **Cartographer's World Chart (`Tab` / minimap click).** Full-screen parchment chart
  displaying charted terrain, Cities of Gold, villages, labeled landmarks, mission forts,
  moored caravels, and explorer position.
- **Shareable seeds & presets.** Boot directly into any world via `?seed=<name>` URL links
  or cycle curated presets (`1492`, `1519`, `6767`) with `P` on the title screen.
- **In-game controls card (`H` / `?`).** Quick keyboard and survival reference overlay
  without leaving your expedition.
- **Walk-in emotes & bump reaction.** Villagers react with overhead pixel emote pills
  (`Shiny!`, `6-7!`, `Ni!`, `A shrubbery?`, `Run away!`), and crowding wary villagers spooks
  them slightly.
- **Audio & accessibility.** Added `'discover'` and `'camp'` procedural cues, a visually
  hidden `aria-live="polite"` status region mirroring key canvas notices, and an optional
  headless Chromium smoke workflow (`.github/workflows/smoke.yml`).

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
  rule. Arrow keys move on every keyboard layout, and `W A S D` also move by key position
  on QWERTY, AZERTY and similar layouts. Keys still register with an input method active.
  Holding `←` or `→` repeats the adjustment on the outfitting screen. Mute is remembered, and the corner key hint drops
  `F` at sea.
- **Accessibility.** HUD warnings carry a `!` mark as well as a colour, the OS
  reduced-motion setting is respected, and touch-only devices get a keyboard-required
  notice. The page declares its language, a description and a labelled canvas.
- **Rules.** Village hostility, fort crew requirements and the final score breakdown each
  come from one shared definition. A village is hostile below an effective temperament of
  0.3 in the parley panel and the soundscape alike, and the score shown at game over
  matches the one recorded in the Chronicle.
- **Tooling.** Strict TypeScript 7 settings, Node 26 LTS, Vite 8, Vitest 5, and supply-chain-hardened
  pnpm 12 (zero dependency build scripts, `blockExoticSubdeps`, `trustPolicy: no-downgrade`),
  a relative build base for hosting in any subfolder, a `pnpm check` gate (typecheck, tests,
  build, and a check that the dev-only `window.__dbg` hook is stripped from production), and CI
  that runs it.
