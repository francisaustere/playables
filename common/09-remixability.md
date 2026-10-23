# 09 · Code that is easy to remix

The next person (or Gemini) will change the template with prompts like "make it about space", "add a second enemy",
"make it harder". The code must make those changes local and safe.

## Module layout (names are a target, PB may organize files its own way)

| Module | Responsibility |
|---|---|
| `spec` | Loads and merges `game_spec.json`, clamps values, exposes `SPEC` (read-only) |
| `platform` | SDK wrapper with stubs (`01-sdk.md`) |
| `viewport` | Canvas sizing, stage transform, safe areas |
| `input` | Actions from keys and pointers (`03-input.md`) |
| `audio` | Sound kit from recipes (`08-audio.md`) |
| `save` | Load/save, versioning |
| `pool` | Generic object pool |
| `draw` | Primitive helpers: `shape(look, x, y, scale)`, `text(...)`, `button(...)`, `bar(...)` |
| `ui` | Screens (Title, Paused, Result) and HUD |
| `game` | State machine (`06-state-machine.md`) |
| `world` / `systems/*` | Genre gameplay: one system per mechanic (spawner, movement, collision, scoring, difficulty...) |
| `skins` | **One draw function per entity type** (`drawPlayer`, `drawObstacle`...), reading only `look` |

## Rules

- Gameplay never draws; skins never change state. A remix of the look touches `skins` + `style` only.
- Entity types are data: adding an enemy = adding an entry in `entities` (+ optionally a skin). The code iterates the
  list, no `if (type === 'enemy2')` scattered around.
- Names are plain English and match the spec keys (`spawnInterval` in the spec ↔ `spawnInterval` in the code).
- Each module starts with a 2–4 line comment: what it does, which spec sections it reads.
- No dead code, no commented-out experiments, no `console.log` left in (except behind `debug`).
- Constants that are not gameplay (e.g. pool growth, event names) are declared once at the top of their module.
