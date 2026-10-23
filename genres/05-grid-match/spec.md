# 05 · Grid & Match

> Follows the Endless Runner reference spec. Common rules (`common/`) apply.

## 1. Pitch
Swap two neighbouring tiles to line up 3 or more of the same kind; matches clear, tiles fall, cascades chain. Reach the
level goal (a score or clearing every covered cell) before running out of moves.
Archetype references (team only): Bejeweled, Candy Crush, Puzzle & Dragons boards.

## 2. SOW coverage

| SOW mechanic | Where | Keys |
|---|---|---|
| Variable grid size | §4 Board layout, §6 Level setup | `levels[].cols`, `levels[].rows`, `levels[].layout`, `board.*` |
| Player turn / system turn | §3, §6 Turn state machine | `board.swapDuration`, `board.clearDuration`, `board.fallCellDuration`, `board.cascadePause` |
| Revealed / hidden cells | §6 Covers | `entities[kind=cover]`, `levels[].layout` (`c`, `C`) |
| Pattern validation | §6 Match detection | `rules.minMatch`, `rules.patterns[]` |
| Win and lose | §9 | `levels[].goal`, `levels[].target`, `levels[].moves` |

## 3. Core loop
**Player turn**: pick a tile and swap it with a neighbour (1–5 s of thinking). **System turn** (input locked, 0.3–2 s):
the swap is validated; if it makes no match it reverts (no move spent); otherwise matches clear, bonus tiles are
created, tiles fall, new tiles drop in, and any new matches resolve as a cascade with a growing multiplier. Then the
board is checked for a possible move (reshuffle if none) and the player plays again.
A run is a sequence of `levels` (4 by default, 3–6 min in total). Score accumulates across levels. Failing a level
ends the run.

## 4. Stage and camera
- Stage 720 × 1280, `fit: contain`. Fixed camera.
- **Board layout** (recomputed per level): `cellSize = min((board.maxWidth − (cols − 1) × cellGap) / cols,
  (board.maxHeight − (rows − 1) × cellGap) / rows)`. Board centered at x 360, `board.centerY`. Cell (c, r) center =
  board origin + (c, r) × (cellSize + cellGap) + cellSize / 2. Row 0 is the top.
- Tiles are drawn at `cellSize × board.tileScale × look.size` (**for board pieces, `look.size` is a ratio of the cell
  size**, not stage units, so tiles scale with the grid).
- Background: each existing cell drawn as a `surface` rounded square (pre-rendered per level). Holes (`#`) are not
  drawn.
- Above the board: goal panel (top-center HUD). Below: nothing but the controls hint on the first level.

## 5. Controls

| Action | Keyboard | Mouse | Touch | Effect |
|---|---|---|---|---|
| Move cursor | ← → ↑ ↓ / WASD (no tile selected) | – (pointer sets the cursor) | – | Cursor moves one cell, clamped, skipping holes |
| `select` | Space / Enter | click a tile | tap a tile | Select the tile under the cursor / pointer. Second select on a neighbour = swap. Select on the same tile = deselect. Select on a non-neighbour = moves the selection there |
| Swap | arrow while a tile is selected | drag from a tile | swipe from a tile | Swap the selected (or pressed) tile with the neighbour in that direction |
| `pause` | Esc / P | pause button | pause button | Pause |

The keyboard cursor (a `player` ring) is shown after the first key press and hidden after a pointer press; pointer
presses also move the cursor to the pressed cell so switching input mid-game is seamless.

**New gestures** (added to the shared vocabulary for board games, same thresholds as `tap` and `swipe`):
- `cellTap`: a `tap` that reports the board cell under the pointer-down position.
- `cellSwipeLeft/Right/Up/Down`: a `swipe` that reports the cell under the pointer-down position and its direction.
  Fires once when the threshold is crossed (so the swap starts while the finger is still down).
Presses outside the board are ignored (except UI buttons).

## 6. Entities and systems

### Level setup
- `levels[i]`: `cols`, `rows` (2–9 each), `tileTypes` (3–6, uses the first N `kind: tile` entities), `moves`,
  `goal` (`"score"` or `"covers"`), `target` (score to reach for `score` goals), `layout` (array of `rows` strings of
  `cols` symbols: `.` normal cell, `#` hole, a cover `symbol` = covered cell; empty array = all normal).
- **Generation**: fill cells top-left to bottom-right; for each cell pick a random type among `tileTypes`, excluding
  any type that would create a horizontal or vertical run of `minMatch` with already placed tiles. Then check that at
  least one valid move exists; if not, regenerate (max `rules.shuffleTries`, then accept and let the shuffle handle it).
- Grid stored as flat typed arrays (`type`, `bonus`, `cover` per cell; −1 = empty), sized from `limits.tiles`.

### Tiles
- `kind: tile` entities: identity = shape + color (shape alone must be enough to tell them apart: color-blind safe).
  The 6 defaults use 5 role colors + `text`; this is the only genre allowed more than 4 role colors on screen, since
  tile identity is the game.
- A tile has a type, an optional `bonus` (`lineClear`, `bomb`, `colorBomb`), and an animated position (from → to).

### Covers (hidden / revealed cells)
- A covered cell holds a tile that is **hidden** (drawn as the cover look, with layer dots) and **locked**: it can't be
  selected or swapped, isn't part of matches, doesn't fall.
- A match **orthogonally adjacent** to a covered cell, or a bonus effect hitting it, removes one layer (once per
  cascade step per cell). At 0 layers the cover is gone: the tile is revealed and becomes normal (it can immediately
  match in the next cascade step).
- Holes and covered cells split columns into **segments** for gravity (see Gravity).

### Turn state machine (inside PLAY)
`IDLE` (player turn, input on) → `SWAPPING` (`swapDuration`) → `CHECK` → either `REVERTING` (`swapDuration`, invalid
swap, `invalid` sound, no move spent) → `IDLE`, or `CLEARING` (`clearDuration`) → `FALLING` (`fallCellDuration` per
cell fallen, max of the column) → `CASCADE_CHECK` (`cascadePause`) → `CLEARING` again if new matches, else
`SETTLE` (goal check, deadlock check) → `IDLE` / `LEVEL_CLEAR` / RESULT.
Input is **locked** in every state except IDLE: swap and select presses are dropped (not buffered); cursor movement
still works.

### Match detection (pattern validation)
- Scan rows and columns for runs of ≥ `minMatch` same-type, unlocked tiles (bonus tiles keep their type, except
  `colorBomb` which has no type).
- Group overlapping runs (shared cells) into match groups. For each group, find the **first** pattern in
  `rules.patterns` (priority order) that fits: `line` of `size` = a single run of length ≥ size; `LT` = a horizontal
  and a vertical run sharing a cell, total cells ≥ size. Award `pattern.points` + cells × `pointsPerTile`, × cascade
  multiplier.
- If `bonusesEnabled` and `pattern.bonus` is set: the group's cells clear except one that becomes a tile with that
  bonus: the swapped tile's cell if it's in the group, else the group's middle cell.
- **Colour bomb swap**: swapping a `colorBomb` with any tile is always valid: clears every tile of that tile's type
  (colorBomb + colorBomb: clears the whole board).

### Bonus effects (when cleared by a match or by another effect; chains are resolved in the same clear step)
- `lineClear`: clears its whole row if created from a horizontal run, column if vertical (stored in the tile).
- `bomb`: clears cells within Chebyshev distance `radius` (3 × 3 by default).
- `colorBomb`: clears all tiles of a random present type when hit by an effect.
- Every cell cleared by an effect scores `pointsPerTile` × cascade multiplier and damages adjacent covers like a match.

### Gravity and refill
- For each column, from the bottom: segments are maximal runs of non-hole, non-covered cells. In each segment, tiles
  compact downward; empty cells at the top of the segment get new random tiles (types among `tileTypes`) that start
  above the segment's top and fall in. (Segments under a cover refill from just below it: simple and predictable.)

### Cascades
- Cascade depth `d` starts at 0 for the swap's matches and +1 for each following clear step.
  `cascadeMultiplier = min(1 + d × cascadeStep, maxCascadeMultiplier)`.

### Deadlock
- At SETTLE: brute-force every swappable pair (right and down neighbours); a pair is valid if it creates a run of
  `minMatch` or involves a `colorBomb`. If none: show `text.shuffle` for 1 s, shuffle the types of unlocked non-bonus
  tiles (Fisher–Yates) until no immediate match and a move exists (max `shuffleTries`, then regenerate those cells).

### Hint
- After `rules.hintDelay` s in IDLE without input: the two tiles of one valid move pulse (scale 1 ± 0.08 at 2 Hz) until
  the next input.

### Systems (order, every fixed step)
1. `inputSystem` (IDLE only for select/swap; cursor always). 2. `turnSystem` (turn state machine timers).
3. `matchSystem` (on CHECK / CASCADE_CHECK). 4. `clearSystem` (patterns, bonuses, covers, scoring).
5. `gravitySystem` (on FALLING). 6. `goalSystem` and `deadlockSystem` (on SETTLE). 7. `fxSystem` (particles,
popups, hint pulse).

## 7. game_spec parameters (genre sections)

| Key | Default | Unit | Effect | Safe range |
|---|---|---|---|---|
| `rules.minMatch` | 3 | tiles | Shortest valid run | 3–5 |
| `rules.pointsPerTile` | 20 | pts | Per cleared tile | 1–100 |
| `rules.cascadeStep` | 0.5 | × | Multiplier added per cascade | 0–1 |
| `rules.maxCascadeMultiplier` | 4 | × | Cap | 1–10 |
| `rules.movePoints` | 50 | pts | Per unused move at level clear | 0–500 |
| `rules.bonusesEnabled` | true | – | Bonus tiles on/off | – |
| `rules.hintDelay` | 5 | s | Idle time before hint (0 = off) | 0–15 |
| `rules.shuffleTries` | 20 | – | Generation / shuffle attempts | 5–100 |
| `rules.patterns[]` | line5, cross, line4, line3 | – | `shape` (line/LT), `size`, `bonus`, `points`, priority = order | – |
| `board.maxWidth / maxHeight` | 660 / 820 | u | Board area | – |
| `board.centerY` | 700 | u | Board center | 600–760 |
| `board.cellGap` | 6 | u | Gap between cells | 0–16 |
| `board.tileScale` | 0.78 | × | Tile size in its cell | 0.5–1 |
| `board.swapDuration` | 0.15 | s | Swap / revert tween | 0.08–0.4 |
| `board.clearDuration` | 0.2 | s | Clear animation | 0.1–0.5 |
| `board.fallCellDuration` | 0.06 | s | Fall time per cell | 0.03–0.15 |
| `board.cascadePause` | 0.08 | s | Pause between cascade steps | 0–0.3 |
| `board.levelClearDelay` | 1.2 | s | Before LEVEL_CLEAR screen | 0.5–3 |
| `entities[]` | 6 tiles, 3 bonuses, 2 covers | – | `kind` tile / bonus / cover, `effect`, `radius`, `symbol`, `layers`, `look` (size = ratio of cell) | – |
| `levels[]` | 4 levels | – | `cols`, `rows`, `tileTypes`, `moves`, `goal`, `target`, `layout` | cols/rows 2–9 |
| `limits.tiles / particles / popups` | 81 / 96 / 16 | – | Pool and array sizes | tiles = max cols × rows |
| `audio.sfx.swap / invalid / match / bonus / cover / shuffle` | recipes | – | Genre sounds (`match` pitch × (1 + 0.12 × depth)) | – |

## 8. Difficulty curve
Difficulty is the level list, not time:
- L1 6 × 6, 4 types, score goal: many cascades, teaches swapping (bonuses appear naturally).
- L2 7 × 8, 5 types, covers in a ring: teaches "match next to covered cells".
- L3 8 × 9, holes and 2-layer covers: segmented gravity, planning.
- L4 9 × 9, 6 types, high score goal: fewer natural matches, bonuses matter.
More types = fewer matches and cascades (the strongest lever), then moves, then target.

## 9. Win, lose, score
- Level clear: goal reached (`score` goal: score earned **in this level** ≥ `target`; `covers` goal: no cover left).
  The level clears as soon as the goal is met at SETTLE (remaining cascades resolve first). Unused moves × `movePoints` are added, then `LEVEL_CLEAR` screen, then the
  next level.
- Lose: moves reach 0 at SETTLE with the goal not met → RESULT (`text.lose`).
- Win: last level cleared → RESULT (`text.win`).
- **`sendScore` = floor(run score)** (all levels).
- `save.progress`: `{ "highestLevel": n }` (index of the furthest level reached, shown on the title).

## 10. HUD and screens
- Top-left: run score, and level "L2/4" below.
- Top-center: goal panel: `text.goalScore` + progress bar (level score / target) or `text.goalCovers` + remaining count;
  moves left below it in large digits (`hazard` color at ≤ 3 moves).
- Top-right: pause. Bottom: nothing.
- LEVEL_CLEAR: `text.levelClear`, move bonus counted up, "Next" button (confirm).
- Title: a small static 6 × 6 board in the background, highest level reached.
- Result: score, best, level reached.

## 11. Feedback and sound

| Event | Visual | Sound |
|---|---|---|
| Select | tile scale 1.1 + `player` outline | `uiTap` |
| Swap | tween | `swap` |
| Invalid swap | tween back + small horizontal shake of both tiles | `invalid` |
| Match | tiles shrink to 0 + burst in tile color, "+N" popup at group center | `match` (pitch rises with depth) |
| Bonus created / triggered | flash on the cell, line or ring sweep | `bonus` |
| Cover layer removed | cover cracks (layer dot removed), burst `line` | `cover` |
| Cascade ≥ 2 | "×1.5" popup in `special` | – |
| Shuffle | all tiles fade out/in | `shuffle` |
| Level clear / win / lose | – | `win` / `win` / `lose` |

## 12. Edge cases
- Swipe toward a hole, a covered cell or outside the board: ignored (no move, no revert).
- Swipe on a covered tile: ignored. Tap on a covered tile: ignored.
- Both run directions from one swap (each tile makes a match): both groups resolve in the same clear step.
- A run longer than 5: matches `line5`.
- A bonus effect clears another bonus: chain in the same step (each cell cleared once).
- Goal reached and moves = 0 on the same move: win (goal checked first).
- Pause during a system turn: frozen; the turn finishes after resume.
- Level with more `tileTypes` than tile entities: clamped to the number of tile entities.
- Layout with wrong dimensions: missing cells = `.`, extra ignored, debug warning.
- No valid move after `shuffleTries` shuffles (tiny boards): regenerate the unlocked cells.

## 13. Performance budget
- 81 cells max, matching and deadlock checks on typed arrays, only at state changes (never every frame).
- Particles: 8 per cleared tile, capped at 96 (a colour bomb on a full 9 × 9 board must not exceed the pool: extra
  bursts are skipped).
- Stress test: L4 with `debug.invincible` (moves never decrease) for 3 min of colour bomb + colour bomb swaps
  (give the player bombs in debug via `rules.patterns` with line3 → colorBomb).

## 14. Remix hooks
- Theme: tile skins (`drawTile` per type) + palette: "Make the tiles fruits".
- Rules: `minMatch`, `patterns` (e.g. remove bonuses), `levels` (new boards in ASCII), `moves`.
- Content: new cover kind with more `layers`, new bonus effect (new `effect` value + one function).
- Example remix prompts that must work: "Make it about candy", "Add a 5th level with a heart-shaped board",
  "Matches of 4 should clear the whole column", "Give 30 moves per level", "Remove the special tiles".

## 15. Acceptance criteria
- [ ] Board size, holes and covers come from `levels[].layout`; 6 × 6 to 9 × 9 all fit the stage
- [ ] Swap by swipe (touch), drag (mouse), tap-tap, and keyboard (cursor + Space + arrow)
- [ ] Invalid swap reverts and costs no move; input locked during the system turn
- [ ] No match on a freshly generated board; there is always a valid move (deadlock → shuffle)
- [ ] line4 → lineClear, LT → bomb, line5 → colorBomb; effects chain; colorBomb swap clears a type
- [ ] Covers hide the tile, block swaps and gravity, lose a layer per adjacent match, reveal the tile at 0
- [ ] Cascade multiplier shown and applied, capped
- [ ] Score goal and covers goal both clear the level; out of moves → lose; last level → win
- [ ] Score shown = value sent = best saved; highest level saved
- [ ] Changing a level's `cols`/`rows`/`layout` in the spec changes the board without code changes

## 16. Prompt plan
- **p1** (core): board layout from cols/rows, generation without matches, cursor/select/swap with all inputs, turn
  state machine, match detection (lines), clear, gravity, refill, cascades, moves, simple score. game_spec: meta,
  input, board, entities.
- **p2** (systems): levels and layouts (holes, covers), patterns and bonus tiles with effects, cascade multiplier,
  goals and level sequence, deadlock + shuffle, hint, save progress. game_spec: rules, levels, limits, audio.
- **p3** (UI and feel): HUD goal panel, LEVEL_CLEAR and Result screens, feedback and sounds, debug overlay,
  acceptance checklist. game_spec: text.
