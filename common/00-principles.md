# 00 · Principles

These rules apply to all 10 templates. A genre spec may add rules, never contradict these.

1. **Skeleton, not a finished game.** 100% of the mechanics of the archetype, 0% art direction. Every visual is a
   geometric primitive from the style guide (`07-style-guide.md`). A remixer must be able to say "make the player a cat"
   and only the draw function of the player changes.
2. **Everything tunable lives in `game_spec.json`.** No gameplay number, color, string, sound or timing is hard-coded
   (`02-game-spec.md`). The code reads the spec once at boot.
3. **YouTube Playables first.** SDK integrated correctly (`01-sdk.md`), works in every aspect ratio from 9:32 to 32:9
   (`05-layout.md`), same actions with keyboard/mouse and touch (`03-input.md`).
4. **30 FPS stable on a 3-year-old mid-range Android**, under 15 MB (trivially: there are no assets)
   (`04-performance.md`).
5. **Zero errors.** No exception at compile time or run time, no console error, no network request.
6. **Consistent family.** The 10 templates share the same state machine (`06-state-machine.md`), the same screens,
   the same HUD placement, the same palette roles, the same sounds. Opening two of them should feel like one product.
7. **Readable by the next prompter.** Clear English names, one responsibility per module, a short header comment per
   module (`09-remixability.md`).
8. **Safe for a 13+ general audience.** Neutral wording, no violence beyond abstract "hit / destroyed", YouTube
   Community Guidelines respected.

## Hard constraints (repeat them in every prompt sequence)

- No external network call, no CDN, no external font, no image file, no audio file. The only external script allowed
  is the Playables SDK tag.
- No `localStorage`, cookies or IndexedDB: saves go through the SDK.
- No in-game mute button: audio follows YouTube's setting.
- Do not lock orientation.
- Single page, relative paths only.
