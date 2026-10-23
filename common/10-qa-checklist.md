# 10 · Common QA checklist (run on every template, before each submission)

Copy into `genres/NN/log.md` and tick. A template ships only when this list and the genre's acceptance criteria are
all green.

## SDK and lifecycle
- [ ] SDK script tag is the first script; game runs with and without `ytgame` (no error in a plain browser)
- [ ] `firstFrameReady` then `gameReady` each called exactly once, `gameReady` when Title accepts input
- [ ] `sendScore` called at each Result with an integer; in-game Best = best value sent
- [ ] Save survives a reload (best score, genre progress); a corrupted save starts fresh without error
- [ ] SDK pause → game frozen, audio silent, save done; resume lands on the Paused screen
- [ ] Audio follows the YouTube setting at start and when toggled; no in-game mute button
- [ ] Playables test suite passes (when available)

## Spec
- [ ] Every number / color / string / sound / timing used by the game is in `game_spec.json`
- [ ] Changing 3 random values in the spec (one physics, one difficulty, one color) changes the game as expected
- [ ] Removing an optional key does not crash (defaults apply)

## Input parity
- [ ] Full run playable with keyboard only, with mouse only (if the genre allows), with touch only
- [ ] Every UI button reachable with keys; Esc/P pauses
- [ ] No page scroll, zoom, text selection or context menu on mobile

## Layout
- [ ] 9:32, 9:21, 9:16, 3:4, 1:1, 4:3, 16:9, 21:9, 32:9: nothing cropped, nothing stretched, input aligned
- [ ] Rotate phone during play and during pause: correct relayout, state kept

## Performance
- [ ] Reference Android: ≥ 30 FPS during the stress test (3 min hardest difficulty, `debug.invincible`)
- [ ] Desktop Chrome: 60 FPS; no growing memory over 5 runs (DevTools heap snapshot)
- [ ] Bundle < 2 MB; no network request other than the SDK (DevTools Network)

## Robustness
- [ ] Zero errors and warnings in the console over 5 runs, including pause/resume and resize spam
- [ ] Restart 10 times quickly: no leftover entity, timer or sound from a previous run
- [ ] Tab switch / app background during play: no jump in time, no death on return

## Style and content
- [ ] Only palette tokens, only primitives, system font; consistent with the other templates (side by side check)
- [ ] All text in English, neutral wording, appropriate for 13+
