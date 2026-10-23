# 07 · Tower Defense

> Follows the Endless Runner reference spec. Common rules (`common/`) apply.

## 1. Pitch
Enemies walk a winding path toward your base in waves. Spend coins to build towers on the grid beside the path: fast
single-target blasters and slow area-damage mortars. Kills pay for more towers. Survive every wave.
Archetype references (team only): Bloons TD, Kingdom Rush, Plants vs. Zombies (lanes aside).

## 2. SOW coverage

| SOW mechanic | Where | Keys |
|---|---|---|
| Path by nodes | §4, §6 Path | `levels[].path` (waypoints in cell coordinates) |
| Tower placement on a grid | §4, §5, §6 Placement | `board.*`, `levels[].blocked`, `entities[kind=tower].cost` |
| Waves | §6 Waves | `levels[].waves[].groups[]`, `rules.autoStartDelay`, `difficulty.hpScale` |
| Single-target and area-of-effect fire | §6 Towers, Projectiles | `entities[kind=tower]` (`splashRadius` 0 vs > 0, `targeting`) |
| Base health | §6 Base, §9 | `levels[].baseHp`, `entities[kind=enemy].damage` |

## 3. Core loop
**Build phase**: place or sell towers, then start the wave (or let the auto-start timer do it). **Wave phase**:
enemies spawn and follow the path, towers fire automatically, kills give coins, leaks hurt the base; building and
selling stay possible during the wave. When every enemy of the wave is dead or has leaked: wave bonus, back to build
phase. 8 waves, 4–6 min. Win after the last wave; lose when base HP reaches 0.

## 4. Stage and camera
- Stage 720 × 1280, `fit: contain`, fixed camera.
- Board: `board.cols` × `board.rows` cells of `board.cellSize` (9 × 12 × 80 = 720 × 960), top at `board.originY`
  (150), left at `(720 − cols × cellSize) / 2`. Cell (c, r) center = origin + (c + 0.5, r + 0.5) × cellSize.
- Above the board (0–150): HUD. Below (`board.barTop` 1130 → 1280): tower bar.
- **Path**: polyline through the centers of the `path` nodes (cell coordinates, may be outside the board for entry and
  exit: here enter at row −1, exit at row 12). Segments must be horizontal or vertical (validated at boot; invalid
  path = debug error and fallback to a straight vertical path down the middle column).
- **Path cells** = every board cell crossed by a segment: drawn as `surface` with `line` borders (pre-rendered with the
  grid). Buildable cells drawn as faint `line` squares. Blocked cells (`blocked`) drawn as `neutral` squares.
- Base: `kind: base` look drawn at the last in-board path cell before the exit.

## 5. Controls

| Action | Keyboard | Mouse | Touch | Effect |
|---|---|---|---|---|
| Move cursor | ← → ↑ ↓ / WASD | click a cell | tap a cell | Cursor (a `player` square outline) on a cell; shows range preview |
| `tower1` / `tower2` | 1 / 2 | click the tower button | tap the tower button | Select that tower type **and** build it on the cursor cell if buildable and affordable |
| `place` | Enter | click the cursor cell again | tap the cursor cell again | Build the selected tower type on the cursor cell |
| `sell` | X / Delete / Backspace | click Sell | tap Sell | Sell the tower under the cursor |
| `nextWave` | Space / N | click Next wave | tap Next wave | Start the next wave now (build phase only) |
| `pause` | Esc / P | pause button | pause button | Pause |

Selected tower type defaults to the first one. A tower button press with no buildable cursor cell only selects the
type. The cursor is visible after the first key press or cell tap.

**New gestures**: `cellTap` (same as in 05 Grid & Match: a `tap` that reports the board cell under the pointer-down
position); `towerButton`, `sellButton`, `waveButton` are standard UI button taps.

## 6. Entities and systems

### Path
- Precompute segment lengths and cumulative distances once per level. An enemy stores `d` (distance traveled);
  `position(d)` = point on the polyline. `progress` = d / total length.

### Placement
- Buildable = inside the board, not a path cell, not blocked, no tower. Build: `coins −= cost`, tower created on the
  cell center, `place` sound. Not buildable or not affordable: `denied` sound + cursor shake.
- Sell: `coins += floor(cost × sellRefund)`, tower removed, `sell` sound.
- Bottom bar: one button per tower entity (look icon, cost, key label), the selected one outlined in `player`, dimmed
  when not affordable; when the cursor is on a tower: Sell button (+refund value) instead of building; Next wave button
  on the right (shows the auto-start countdown).

### Towers (`kind: tower`, data)
- `range` (u), `fireRate` (shots/s), `damage`, `splashRadius` (0 = single target), `projectileSpeed`, `targeting`
  (`first` = largest `d` in range, `closest`, `strongest` = highest current hp), `look`, `projectileLook`.
- Each step: `cooldown −= dt`; when ≤ 0 and a target exists in range: fire a projectile, `cooldown += 1 / fireRate`
  (no target: cooldown stays at 0, fires as soon as one enters). Targets are searched only when the tower can fire.
- The tower's top rotates toward its target (drawn as a short `line`-colored barrel; skins may ignore it).

### Projectiles
- Homing toward the target's current position at `projectileSpeed`. Hit when the distance ≤ `speed × dt` + enemy radius
  (no tunneling). If the target died before impact, the projectile continues to its last known position and resolves
  there.
- Impact: single (`splashRadius` 0): damage the target. Splash: damage every enemy within `splashRadius` of the impact
  point (`boom` sound, ring burst). Projectiles that outlive 3 s are recycled.

### Enemies (`kind: enemy`, data)
- `hp × curve(difficulty.hpScale, waveNumber)` at spawn, `speed` (u/s), `reward` (coins), `points` (score), `damage`
  (base HP lost on leak), `look`. HP bar (`bar` kit, 40 × 6 u above the enemy) shown once damaged.
- Death: `coins += reward`, `score += points`, burst, `destroy` sound, "+reward" popup in `pickup`.
- Leak (d ≥ total length): `baseHp −= damage`, `leak` sound, base flash, small shake; enemy recycled.

### Waves
- `levels[].waves[i].groups[]`: `{ enemy, count, interval, delay }`. A wave starts all its groups at once; each group
  waits `delay` s then spawns `count` enemies every `interval` s at the path start.
- Build phase between waves: the auto-start timer counts `rules.autoStartDelay` s (0 = no auto start). Starting early
  with `nextWave` gives `floor(timeLeft × earlyStartBonus)` coins.
- Wave cleared (all spawned, none alive): `coins += waveBonus`, `score += wavePoints × waveNumber`, then build phase (or
  win after the last wave).

### Systems (order, every fixed step)
1. `inputSystem` (cursor, build, sell, next wave). 2. `waveSystem` (timers, spawns, wave end).
3. `enemySystem` (move along path, leaks). 4. `towerSystem` (cooldowns, targeting, fire).
5. `projectileSystem` (move, impact, damage, deaths). 6. `economySystem` (rewards, score).
7. `endSystem` (base HP 0 → lose; last wave cleared → win). 8. `fxSystem`.

## 7. game_spec parameters (genre sections)

| Key | Default | Unit | Effect | Safe range |
|---|---|---|---|---|
| `rules.sellRefund` | 0.7 | ratio | Coins back on sell | 0–1 |
| `rules.autoStartDelay` | 20 | s | Build phase length (0 = manual only) | 0–60 |
| `rules.earlyStartBonus` | 2 | coins/s | Bonus per second skipped | 0–20 |
| `rules.waveBonus` | 25 | coins | Coins per cleared wave | 0–200 |
| `rules.wavePoints` | 100 | pts | × wave number, per cleared wave | 0–1000 |
| `rules.basePoints` | 50 | pts | Per base HP left on win | 0–500 |
| `board.cols / rows / cellSize` | 9 / 12 / 80 | cells / u | Grid (cols × cellSize ≤ 720) | 5–12 / 8–14 / 56–100 |
| `board.originY / barTop` | 150 / 1130 | u | Board top, tower bar top | – |
| `entities[kind=tower]` | blaster, mortar | – | `cost`, `range`, `fireRate`, `damage`, `splashRadius`, `projectileSpeed`, `targeting`, looks | – |
| `entities[kind=enemy]` | basic, fast, tank | – | `hp`, `speed`, `reward`, `points`, `damage`, `look` | speed ≤ 300 |
| `entities[kind=base]` | ring `positive` | – | Base look | – |
| `levels[]` | 1 map | – | `startCoins`, `baseHp`, `path`, `blocked`, `waves[]` | – |
| `difficulty.hpScale` | 1 → 2.2 over waves 1–8 | × | Enemy HP multiplier by wave number (`at` = wave) | 0.5–5 |
| `limits.enemies / projectiles / towers / particles / popups` | 60 / 80 / 108 / 96 / 16 | – | Pools (towers = cols × rows) | – |
| `audio.sfx.place / sell / shoot / boom / leak / waveStart / denied` | recipes | – | Genre sounds | – |

## 8. Difficulty curve
- W1–2 (basic): 2 blasters handle them; teaches placing near path corners (more time in range).
- W3 (fast): punishes too few towers; W4 mixes.
- W5 (tanks): needs focused damage; W6 (16 fast): needs coverage or splash.
- W7–8: everything, HP × 1.8–2.2. A player who saved for mortars at corners wins with base HP left.
Levers: `hpScale`, wave counts/intervals, `startCoins`, rewards.

## 9. Win, lose, score
- Lose: base HP ≤ 0 (immediately, even mid-wave). Win: last wave cleared with base HP > 0.
- Score = Σ enemy `points` + Σ `wavePoints × waveNumber` + (win ? baseHp × `basePoints` : 0). **`sendScore` =
  floor(score).**
- `save.progress`: `{ "bestWave": n }` (highest wave reached).

## 10. HUD and screens
- Top-left: score, coins below (diamond icon).
- Top-center: `text.wave` "3/8" and base HP bar (`positive`, turns `hazard` under 30%).
- Top-right: pause. Bottom: tower bar (tower buttons, Sell when on a tower, Next wave with countdown).
- Range preview: circle outline (`player`, 30% alpha) of the selected tower type at the cursor, or of the tower under the
  cursor.
- Title: board and path drawn, a few enemies walking (attract mode, no towers), best score, best wave.
- Result: score, best, wave reached, towers built.

## 11. Feedback and sound

| Event | Visual | Sound |
|---|---|---|
| Build | tower pops in (squash) | `place` |
| Sell | tower shrinks, "+N" | `sell` |
| Can't build | cursor shake | `denied` |
| Fire | barrel recoil 0.05 s | `shoot` (max one per 0.05 s overall) |
| Splash impact | ring burst `player` | `boom` |
| Enemy hit | flash | – |
| Kill | burst `hazard`, "+reward" `pickup` | `destroy` |
| Leak | base flash, shake | `leak` |
| Wave start | "Wave 3" banner 1 s | `waveStart` |
| Win / lose | – | `win` / `lose` |

## 12. Edge cases
- Building on the cell an enemy is crossing: allowed only on non-path cells, so never blocked by enemies.
- Selling during a wave: allowed; its projectiles in flight still resolve.
- Target dies with projectiles in flight: they resolve at the last known position (splash still useful).
- Two lethal hits in the same step: reward and points granted once (dead flag).
- Base HP reaching 0 and the last enemy dying in the same step: lose (base checked first).
- `nextWave` during a wave: ignored. After the last wave: no button.
- Path node outside the board: allowed for entry/exit; cells outside are not drawn.
- Pool full: spawn delayed to the next step (enemies are never skipped, so waves stay fair); projectiles skipped.
- Resize: contain, nothing moves in stage space.

## 13. Performance budget
- ≤ 60 enemies, 80 projectiles, ~40 towers in practice. Targeting is O(towers × enemies) only for towers ready to fire.
- Static board (grid, path, blocked) pre-rendered once per level.
- Stress test: wave 8 with `debug.invincible` (base never loses HP) and 40 towers, `debug.timeScale` 1, 3 min of
  repeating wave 8 (spec copy with wave 8 duplicated ×5) on the reference device: ≥ 30 FPS.

## 14. Remix hooks
- Theme: tower, enemy, projectile and base skins: "Make it a garden defended by plants".
- Map: `path` and `blocked` arrays (draw a new path in cell coordinates), board size.
- Content: new tower = new entity (e.g. a slowing tower needs a new `slow` field + 2 lines in the projectile system).
- Example remix prompts that must work: "Add a third tower that shoots very fast but weak", "Make 12 waves",
  "Change the path to a spiral", "Enemies should be robots", "Give 300 starting coins".

## 15. Acceptance criteria
- [ ] Path follows `levels[0].path`; path and blocked cells are unbuildable
- [ ] Build with keyboard (arrows + 1/2 or Enter), mouse and touch (tap cell, tap tower button / tap cell again)
- [ ] Sell refunds `floor(cost × sellRefund)`; not affordable / not buildable gives feedback
- [ ] Blaster hits one enemy; mortar damages all in `splashRadius`
- [ ] Waves follow the groups (enemy, count, interval, delay); `hpScale` applied
- [ ] Auto-start timer and early start bonus work; `autoStartDelay` 0 = manual only
- [ ] Leaks reduce base HP; 0 → lose; last wave cleared → win
- [ ] Score formula as §9; shown = sent = best saved; bestWave saved
- [ ] Changing the path, a wave or a tower stat in the spec changes the game without code changes

## 16. Prompt plan
- **p1** (core): board grid, path polyline from nodes (temporary map inline), cursor and placement with all inputs,
  towers (single and splash), projectiles, enemies walking, one simple repeating wave, base HP, lose. game_spec: meta,
  board, entities (keys described in prose).
- **p2** (systems): levels (path, blocked, start coins, base HP), wave groups, build phase with auto-start and early
  bonus, hpScale, economy, sell, win, score, save progress, pools. game_spec: input, rules, levels, difficulty, limits,
  audio.
- **p3** (UI and feel): HUD, tower bar, range preview, Title attract and Result, feedback and sounds, debug overlay,
  acceptance checklist. game_spec: text.
