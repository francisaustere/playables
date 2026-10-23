# 02 · game_spec.json conventions

> Provisional. YouTube gives us their official schema at kickoff; we will map these conventions onto it.

## Rules

1. **One file, `game_spec.json`, read once at boot.** The code never contains a gameplay number, color, string, sound
   or timing that is not in the spec. Derived values (e.g. `jumpVelocity` from `jumpHeight`) are computed at boot.
2. If the environment cannot `fetch` a local file, the same JSON is embedded as `const GAME_SPEC = {...}` in its own
   module (`spec.js`) and nowhere else. Either way there is exactly one source.
3. Missing keys fall back to the defaults of `common/game_spec.base.json` + the genre file, through one deep-merge at
   boot. A bad value never crashes the game: numbers are clamped to sane ranges.
4. **camelCase keys**, English, no abbreviations (`spawnInterval`, not `spwnInt`).
5. **Units are in the key name or fixed by convention**:
   - distances and sizes: **stage units** (see `05-layout.md`, stage is 720 × 1280 in portrait by default);
   - speeds: units per second (`...Speed`); accelerations: units per second² (`...Accel`, `gravity`);
   - time: **seconds** (`...Duration`, `...Interval`, `...Time`), never milliseconds;
   - angles: degrees; probabilities and ratios: 0..1 (`...Chance`, `...Ratio`);
   - colors: **palette token names** (`"player"`, `"hazard"`), never hex outside `style.palette`.
6. **Ranges** are `{ "min": a, "max": b }`. **Curves over time or level** are arrays of
   `{ "at": t, "value": v }` (linear interpolation, held after the last point).
7. **Lists of things** (enemy types, upgrades, waves, levels, events) are arrays of objects with an `id`, so a
   remixer can add one by copying an entry.
8. Every entity type has a `look` object: `{ "shape": "circle|rect|roundRect|triangle|diamond|hexagon|ring",
   "color": "<token>", "size": n }` (plus `w`/`h` for rects). The draw code reads only `look`.

## Top-level sections (in this order)

| Section | Owner | Content |
|---|---|---|
| `meta` | genre | `id`, `title`, `version`, `archetype`, `scoreLabel` |
| `display` | base (+ genre override) | `stage` {width, height}, `fit` (`contain`/`expand`), `maxDpr`, `safeMargin`, `targetFps` |
| `style` | base | `palette`, `fonts`, `stroke`, `radius`, `ui` sizes, `feedback` (flash, shake, popup) |
| `audio` | base (+ genre sfx) | `masterVolume`, `sfx` {name: synth recipe} |
| `text` | base (+ genre) | Every UI string |
| `input` | genre | Action → keys / pointer gesture bindings, gesture thresholds |
| `rules` | genre | Run structure: lives, duration, win/lose conditions, scoring |
| `player` | genre | Player physics and stats |
| `entities` | genre | Enemy / obstacle / pickup / projectile types |
| `difficulty` | genre | Curves over time or level |
| `levels` | genre (if any) | Level data (grids, paths, layouts, charts, story events) |
| `limits` | genre | Pool sizes and caps (max entities, particles, popups) |
| `debug` | base | `showFps`, `showHitboxes`, `invincible`, `startLevel`, `timeScale` |

Genres may add a section only when nothing above fits (e.g. `economy` for the Clicker, `story` for Narrative,
`chart` for Music Tap), and document it in their spec.

## In the repo

- `common/game_spec.base.json`: base sections, identical for the 10 games.
- `genres/NN/game_spec.json`: genre sections + overrides of `meta`, `display`, `text`, `audio.sfx`.
- `npm run build` deep-merges both into `dist/game_spec/NN.json` (the full file the game must end up with) and inlines
  the genre part (minified) into prompt 1 through `{{GAME_SPEC}}`.
