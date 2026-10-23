# 08 · Bounce & Break

> Same structure and level of detail as `genres/01-endless-runner/spec.md`. Common rules (`common/`) apply.

## 1. Pitch
Keep the ball in play with a paddle, aim it with where it hits the paddle, and break every block of the grid; catch
falling power-ups to widen the paddle, split the ball or slow it down. Clear all levels to win.
Archetype references (team only): Breakout, Arkanoid, mobile brick breakers.

## 2. SOW coverage

| SOW mechanic | Where | Keys |
|---|---|---|
| Paddle | §5, §6 Paddle | `player.*`, `input.bindings.left/right/moveTo`, `input.mouseFollow` |
| Bounces on the edges | §6 Ball, collision system | `rules.fieldTop`, `rules.maxBounceAngle`, `rules.minVerticalRatio` |
| Grid of destructible blocks | §6 Blocks, §7 | `entities[kind=block]`, `levels.grid`, `levels.list[].rows` |
| Falling bonuses | §6 Power-ups | `entities[kind=powerup]`, `rules.powerupDropChance`, `entities[].dropChance` |

## 3. Core loop
Serve (ball rests on the paddle) → launch → the ball bounces between paddle, walls and blocks; every paddle touch is an
aiming decision; blocks break, sometimes a power-up falls and the player decides whether to chase it. A level lasts
45–120 s; 3 levels make a 4–6 min session. Losing the last ball of the last life ends the run.

## 4. Stage and camera
- Stage 720 × 1280, `fit: contain`. Fixed camera, no scrolling.
- Playfield: x 0..720, top wall at `rules.fieldTop` (140, leaves room for the HUD), no bottom wall.
- Grid: `levels.grid.columns` (8) × rows of the level, block `blockWidth × blockHeight` (80 × 36), `gap` 6, first row
  at `grid.top` (220). Grid width = `columns × blockWidth + (columns − 1) × gap` (682), centered: left =
  (720 − width) / 2 (19).
- Block center of cell (c, r): `x = left + c × (blockWidth + gap) + blockWidth / 2`,
  `y = grid.top + r × (blockHeight + gap) + blockHeight / 2`.
- Background: walls drawn as `line` strokes on left, right and top; static, pre-rendered.

## 5. Controls

| Action | Keyboard | Mouse | Touch | Effect |
|---|---|---|---|---|
| `left` / `right` | ← → / A D | – | – | Paddle moves at `player.speed` u/s |
| `moveTo` | – | drag, or plain move if `input.mouseFollow` | drag anywhere | Paddle center x follows the pointer x (instant, clamped) |
| `launch` | Space / ↑ / W | click (tap) | tap | Launches the served ball(s) |
| `pause` | Esc / P | pause button | pause button | Pause |

- A drag that moves more than `tapMaxMove` is not a tap: dragging never launches by accident.
- `mouseFollow` is a desktop comfort only (the paddle is fully playable with click-drag), so it does not break the
  "no hover-only interaction" rule.
- Paddle x is clamped to `[width/2, 720 − width/2]`.

## 6. Entities and systems

### Paddle (`player`)
- Rect `width × height` centered at (x, `player.y`). `widePaddle` multiplies width (capped at `maxWidth`), tweened over
  0.15 s.
- Velocity of the paddle is not transferred to the ball (aim comes only from the hit position: predictable).

### Ball (`entities[kind=ball]`)
- Circle of `radius`. Speed magnitude `v = min(curve(difficulty.ballSpeed, levelTime) × level.speedScale ×
  slowFactor, difficulty.maxBallSpeed)`, re-applied each step to the current direction (direction changes only on
  bounces).
- **Serve**: the ball sits on the paddle (y = paddle top − radius) and follows it. `launch` sends it at
  `launchAngle` degrees from vertical, on a random side.
- **Paddle bounce** (only if moving down and the circle overlaps the paddle rect): `offset = clamp((ball.x − paddle.x)
  / (paddleWidth / 2), −1, 1)`, angle = `offset × maxBounceAngle` from vertical, direction = (sin a, −cos a), ball
  placed above the paddle. Center hit = straight up, edge hit = 60°.
- **Walls**: left/right reflect vx, top (`fieldTop`) reflects vy; the ball is pushed back inside.
- **Anti-flat rule**: after any bounce, if `|dir.y| < minVerticalRatio`, set `|dir.y| = minVerticalRatio` (keeping its
  sign), re-normalize. Prevents endless horizontal bouncing.
- **Lost**: center y > 1280 + radius → returned to the pool. When no ball is left: lose a life (`ballLost`); lives > 0 →
  new serve, all timed power-ups end; lives = 0 → RESULT (lose).

### Collision (swept, no tunneling)
- Each step, each ball moves in `n = ceil(v × dt / rules.substepMaxMove)` substeps (max speed 1400 u/s → 4 substeps of
  ≤ 7 u, half the radius).
- Per substep: walls → paddle → blocks. Blocks: test only the cells around the ball (grid lookup, 3 × 3 cells).
  Circle vs AABB; on overlap, reflect along the axis of least penetration (x for side hits, y for top/bottom; corner:
  reflect both if both penetrations are within 2 u), push the ball out, and **stop testing blocks for this substep**
  (one block hit per substep, so a ball never destroys two blocks through one face).

### Blocks (`entities[kind=block]`)
- Built at level start from `levels.list[i].rows`: one string per row, one symbol per column; symbol → entity with that
  `symbol`; `.` = empty. Rows longer or shorter than `columns` are cut / padded with `.`.
- Hit: `hp −= 1`, `blockHit` sound, flash. `hp` reaches 0: destroyed, `+points`, particles, `destroy` sound, power-up
  roll. Damaged blocks are drawn with alpha `0.45 + 0.55 × hp / maxHp`.
- `hp: 0` at definition = indestructible (steel): bounces only, never counts toward clearing.
- Level cleared when no destructible block is left.

### Power-ups (`entities[kind=powerup]`)
- On block destruction: drop chance = the block's `dropChance` if set, else `rules.powerupDropChance`. Type chosen by
  `weight`. Falls at `fallSpeed`; caught when it overlaps the paddle; lost below the stage.
- Effects (data-driven by `effect`):
  - `widePaddle`: width × `value` for `duration` s (catching again refreshes the timer, no stacking).
  - `multiBall`: each ball in play spawns `value` copies at ±20° from its direction (respecting `limits.balls`).
  - `slowBall`: `slowFactor = value` for `duration` s (refresh, no stacking).
- `powerup` sound + burst on catch. Timed effects end on life loss and on level change.

### Systems (update order, every fixed step)
1. `inputSystem`: paddle movement (keys or pointer), launch.
2. `paddleSystem`: clamp, width tween.
3. `ballSystem`: speed from curve, substepped movement + collisions (walls, paddle, blocks).
4. `blockSystem`: destruction, scoring, drop rolls.
5. `powerupSystem`: fall, catch, timers.
6. `lifeSystem`: lost balls, serve, life loss.
7. `levelSystem`: clear check → LEVEL_CLEAR (after `levelClearDelay`) → next level or RESULT (win).

## 7. game_spec parameters (genre sections)

| Key | Default | Unit | Effect | Safe range |
|---|---|---|---|---|
| `rules.lives` | 3 | – | Lives | 1–9 |
| `rules.fieldTop` | 140 | u | Top wall y | 100–300 |
| `rules.maxBounceAngle` | 60 | ° | Angle at paddle edge | 30–75 |
| `rules.launchAngle` | 20 | ° | Serve angle | 0–45 |
| `rules.minVerticalRatio` | 0.3 | – | Anti-flat rule | 0.15–0.6 |
| `rules.substepMaxMove` | 7 | u | Max move per substep | ≤ ball radius |
| `rules.powerupDropChance` | 0.12 | 0..1 | Default drop chance | 0–1 |
| `rules.lifeBonus` | 500 | pts | Per life left on win | 0–5000 |
| `rules.levelClearDelay` | 1.2 | s | Pause before LEVEL_CLEAR | 0.5–3 |
| `player.y / width / height` | 1140 / 160 / 28 | u | Paddle | – |
| `player.speed` | 1100 | u/s | Keyboard speed | 600–2000 |
| `player.maxWidth` | 320 | u | Cap for wide paddle | – |
| `input.mouseFollow` | true | – | Paddle follows mouse without click | – |
| `entities[]` | ball, 5 blocks, 3 power-ups | – | `radius`, `symbol`, `hp`, `points`, `dropChance`, `effect`, `value`, `duration`, `weight`, `fallSpeed`, `look` | – |
| `difficulty.ballSpeed` | 700 → 1150 over 150 s | u/s | Speed over level time | 400–1400 |
| `difficulty.maxBallSpeed` | 1400 | u/s | Hard cap | ≤ 2000 |
| `levels.grid` | 8 cols, 80 × 36, gap 6, top 220 | u | Grid geometry | – |
| `levels.list[]` | 3 levels | – | `rows`, `speedScale` | – |
| `limits.balls / blocks / powerups` | 6 / 96 / 8 | – | Pools | – |
| `audio.sfx.paddle / wall / blockHit / ballLost / levelClear` | recipes | – | Genre sounds | – |

## 8. Difficulty curve
- Within a level: ball speed 700 → 900 u/s over the first minute, 1150 at 150 s (pressure to finish).
  `levelTime` restarts at each level.
- Across levels: `speedScale` 1 → 1.1 → 1.2, tougher blocks (hp 2 then 3), steel blocks that make angles harder in
  level 3.
- `slowBall` is the comeback tool; `multiBall` is the reward.

## 9. Win, lose, score
- Lose: no ball left and no life left. Win: last level cleared; `+lifeBonus × lives` added.
- Score = Σ block points (+ life bonus on win). **`sendScore` = score** (integer by construction).
- Result shows score, best, level reached.
- `save.progress`: `{ "highestLevel": n }`.

## 10. HUD and screens
- Top-left: score; lives below (small paddle icons ×N, `player` color).
- Top-center: "Level 2/3" (`text.level`).
- Top-right: pause. Bottom: during serve, `text.tapToLaunch` above the paddle (hint, `textMuted`).
- Active timed power-ups: small hexagon icon + shrinking bar under the level label.
- LEVEL_CLEAR screen: `text.levelClear`, score so far, "Tap or press Space" → next level.
- Title: attract mode = level 1 grid drawn, ball bouncing on its own (no scoring). Result: score, best, level reached.

## 11. Feedback and sound

| Event | Visual | Sound |
|---|---|---|
| Launch | – | `action` |
| Paddle hit | paddle squash | `paddle` |
| Wall hit | – | `wall` |
| Block damaged | block flash | `blockHit` |
| Block destroyed | burst in the block color, "+N" popup | `destroy` |
| Power-up caught | burst, icon in HUD | `powerup` |
| Ball lost | shake | `ballLost` |
| Level clear | burst on remaining paddle | `levelClear` |
| Result | – | `win` / `lose` |

## 12. Edge cases
- Ball hits a block corner exactly: both axes reflect (2 u tolerance), ball pushed out of the block.
- Ball squeezed between paddle and wall: the paddle bounce only applies when moving down; the wall pushes out first.
- Pointer moves the paddle fast onto the ball from the side: paddle collision only counts if the ball is above the
  paddle center line and moving down; otherwise ignored (ball passes, likely lost: fair).
- Ball trapped above steel blocks in a loop: the anti-flat rule + `maxBounceAngle` keep it moving; no extra logic.
- `multiBall` at the `limits.balls` cap: extra copies skipped.
- Last block destroyed while another ball is falling below: level clear wins (lives untouched).
- Life lost while a power-up capsule falls: capsule keeps falling, can still be caught after the serve.
- Pause during serve or mid-flight: everything frozen; resume exact.
- `levels.list` with a row longer than `columns`: cut. Level with no destructible block: counted as cleared at once
  (debug warning).
- Extreme speed (spec > 2000): substeps grow automatically, `maxBallSpeed` still caps.

## 13. Performance budget
- ≤ 96 blocks (8 × 12), ≤ 6 balls, ≤ 8 capsules, particles 64. Blocks drawn in one pass per color; the grid is
  redrawn to an offscreen canvas only when a block changes.
- Stress test: level 3 with `debug.invincible` (ball never lost: bounces on the bottom), 6 balls through `multiBall`,
  speed 1400, 3 min.

## 14. Remix hooks
- Theme: skins (`drawPaddle`, `drawBall`, `drawBlock`, `drawPowerup`) + palette.
- Levels: edit `levels.list[].rows`, add symbols in `entities`. "Draw a heart with the blocks" = data only.
- Power-ups: new `effect` = one handler in `powerupSystem` + one entity.
- Example remix prompts: "Make it space-themed with asteroids as blocks", "Add a power-up that makes the ball go
  through blocks for 5 s", "Add 2 more levels shaped like letters", "Make the paddle a curved shield", "Make it easier".

## 15. Acceptance criteria
- [ ] Paddle moves with ← → / A D, with click-drag and touch drag, and with plain mouse move when `mouseFollow`
- [ ] Launch with Space/Up/W, click, tap; a drag never launches
- [ ] Center hit sends the ball straight up, edge hit at `maxBounceAngle`; no horizontal loop
- [ ] At 1400 u/s the ball never passes through a block, the paddle or a wall (5 min `debug.invincible` test)
- [ ] Blocks need `hp` hits, steel never breaks, points added, level clears without steel
- [ ] Each power-up type works, timers refresh without stacking, effects end on life loss
- [ ] Losing the last ball costs one life; 0 lives → Result; last level cleared → win + life bonus
- [ ] Editing a row string in `levels.list` changes the grid
- [ ] Score shown = score sent = best saved; `highestLevel` saved

## 16. Prompt plan
- **p1** (core): paddle, ball serve/launch, bounce rules, substepped collisions, block grid from level rows, block hp
  and points, lives. game_spec: meta, input, rules, player, entities.
- **p2** (systems): levels and LEVEL_CLEAR, difficulty curve, power-ups (drop, fall, catch, effects, timers), win/lose
  and life bonus, save, pools. game_spec: text, difficulty, levels, limits, audio.
- **p3** (UI and feel): HUD, serve hint, power-up timers, title attract mode, result, feedback and sounds, debug
  overlay, acceptance.
