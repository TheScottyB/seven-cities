# Sound Design & Agent-Testability Plan

**Status:** Design — not yet implemented.

## Direction

Fully **procedural audio via WebAudio** — no sample files, consistent with the project's
zero-asset art approach. Oscillators + filtered noise cover everything a 1984-inspired
exploration game needs, and it keeps the bundle tiny.

### Sound inventory

| Cue | Trigger | Synthesis sketch |
|---|---|---|
| Surf ambience | on/near ocean tiles | looped pink noise, slow LFO on a low-pass filter |
| Storm howl | inside a storm cell | surf layer + band-passed noise sweep, gain by proximity |
| River babble | on a river (canoeing) | light high-passed noise, faster LFO |
| Sail creak | boarding / heading change at sea | short saw burst through resonant filter |
| Trade chime | successful trade | two-note major pluck (triangle osc, fast decay) |
| Gift/rumor | gift resolved | soft ascending arpeggio |
| Attack drums | attack resolved | low sine thump ×3 + noise snap |
| City fanfare | golden city discovered | 4-note brass-ish square swell |
| Starvation/mutiny warning | food = 0 or morale < 25 | low pulsing drone while the condition holds |
| Victory / defeat | game over | fanfare major / minor descent |

### Architecture (the part that matters)

```
game events/state ──► sound DIRECTOR (pure) ──► AudioCue[] ──► WebAudio PLAYER (thin)
```

- **`src/audio/director.ts` — pure and unit-testable.** `direct(prev: GameState+ctx, next) →
  AudioCue[]` where a cue is data: `{ id: 'trade-chime', gain: 0.8 }`. All the *decisions*
  (what plays, when, at what intensity, debouncing, ambience crossfades) live here, with
  zero WebAudio imports. This is the same pure-logic discipline as `world/` and `game/`.
- **`src/audio/player.ts` — thin adapter.** Maps cue ids to synthesis graphs on an
  `AudioContext`. Kept dumb enough that bugs are audible, not logical.

## How agents can test sound

Three layers, weakest to strongest:

1. **Unit tests on the director (cheap, deterministic).** Because the director is pure,
   vitest asserts the mapping: entering a storm emits `storm-howl` once (not every frame);
   trade emits `trade-chime`; leaving the ocean crossfades ambience. This catches ~90% of
   audio *logic* bugs with zero audio hardware.

2. **Cue log in the dev hook (integration, headless-friendly).** The player records every
   cue it receives to a ring buffer exposed as `__dbg.audioLog()` (dev builds only, like
   the rest of the hook). The existing playthrough bot then asserts *in the real game*:
   after sailing into a storm, `audioLog` contains `storm-howl`; after a trade, `trade-chime`.
   No sound card needed — the assertion is on the cue stream, exactly where the
   director/player boundary sits.

3. **OfflineAudioContext rendering (the strong claim: it actually makes sound).**
   WebAudio's `OfflineAudioContext` renders a synthesis graph to a raw buffer
   deterministically, with no speakers and no realtime clock. An agent test renders each
   cue and asserts on the buffer: RMS energy above a floor (not silence), duration within
   spec, and FFT energy concentrated in the expected band (the trade chime peaks near its
   note frequencies; the storm howl is broadband noise). This proves the synthesis graphs
   produce the intended *signal*, not just that code ran. It runs headless in the existing
   Playwright harness via `page.evaluate`.

What agents genuinely cannot judge is *aesthetics* — whether the chime is pleasant. The
mitigation is the same as for the art: keep synthesis parameters as named constants,
verify the physics (signal), and let a human tune the taste.

## Implementation order (when picked up)

1. Director + unit tests (pure, TDD).
2. Player with cue log + `__dbg.audioLog()`; bot playthrough asserts cues during a run.
3. OfflineAudioContext spectral tests for each cue.
4. Mute toggle (`M`), master gain, and autoplay-policy handling (first keypress unlocks
   the context — the game is keyboard-driven, so this is free).
