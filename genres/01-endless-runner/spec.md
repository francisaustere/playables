# 01 · Endless Runner

> Reference spec: the 9 other genres follow this one's level of detail. Common rules (`common/`) apply.

## 1. Pitch
The player runs forward on 3 lanes, automatically and faster and faster: switch lanes and jump to dodge obstacles,
grab coins, go through multiplier gates, and go as far as possible.
Archetype references (team only): Subway Surfers, Temple Run, mobile "gate runner" ads.

## 2. SOW coverage

| SOW mechanic | Where | Keys |
|---|---|---|
| Auto-scroll | §6 Scroll system | `difficulty.speed` |
| 3 lanes | §4, §6 Player | `player.lanes`, `player.laneWidth` |
| Obstacles with increasing speed | §6 Spawner, §8 | `entities[kind=obstacle]`, `levels.patterns`, `difficulty.*` |
| Distance | §6 Scoring, §9 | `rules.unitsPerMeter`, `rules.pointsPerMeter` |
| Multiplier gates (optional) | §6 Gates | `entities[kind=gate]`, `rules.gatesEnabled`, `rules.maxMultiplier` |

## 3. Core loop
Every 0.5–1.2 s a row arrives: read it, pick a lane (switch or jump), collect what's there. Speed rises for 3 minutes,
then stays at max: a typical first run lasts 30–60 s, a good run 2–3 min. Endless by default; `rules.targetDistance` > 0
turns it into a race with a finish line (win).

## 4. Stage and camera
- Stage 720 × 1280, `fit: contain` (portrait-native, the lanes need the vertical read distance).
- Top-down view, fixed camera. The world scrolls **downward** at `speed` (u/s); the player stays at `player.y`.
- Lane centers: `x = 360 + (i − (lanes − 1) / 2) × laneWidth` (3 lanes → 160, 360, 560).
- Rows spawn at `y = −100` (above the stage) and despawn at `y > 1380`.
- Background: lane separators as dashed `line` strokes scrolling with the world (pre-rendered dash tile, offset by
  scroll distance).

## 5. Controls

| Action | Keyboard | Mouse | Touch | Effect |
|---|---|---|---|---|
| `left` | ← / A | drag left (swipe) | swipe left | Move one lane left (no effect on the edge lane) |
| `right` | → / D | drag right (swipe) | swipe right | Move one lane right |
| `jump` | Space / ↑ / W | click (tap) or drag up | tap or swipe up | Jump (if `player.jumpEnabled`) |
| `pause` | Esc / P | pause button | pause button | Pause |

Swipes use the shared thresholds (`input.gestures.swipeMinDistance` 60 u, `swipeMaxDuration` 0.35 s) and fire as soon
as the threshold is crossed, so a fast player can chain swipes without lifting. Buffered for `input.bufferTime`.

## 6. Entities and systems

### Player
- Lane index `lane` (int) and visual `x` tweened to the lane center in `laneSwitchDuration` (ease-out). A new switch
  during a tween re-targets from the current `x` (no queue beyond the input buffer).
- Jump: `airTime` counts down from `jumpDuration`; while airborne, the player is drawn scaled up to `jumpScale`
  (parabola: `1 + (jumpScale − 1) × sin(π × t / jumpDuration)`) with a `line` ellipse shadow at ground level.
  While airborne, **jumpable** obstacles are ignored; non-jumpable ones still hit. Lane switch while airborne allowed
  only if `airControl`. Jump while airborne: ignored (buffered press kept until landing).
- Hitbox: AABB of `look.size × hitboxScale`, centered on the current `x` (so a mid-switch player can clip an obstacle in
  the lane it is leaving or entering: that's intended).
- Invulnerability after a hit (when `rules.lives` > 1): `invulnerableTime` s, player blinks (alpha 0.4 / 1 at 10 Hz),
  no damage.

### Rows and patterns (Spawner)
- A row is spawned each time the world has scrolled `rowGap` units since the previous row (`rowGap` from
  `difficulty.rowGap` at the current run time).
- A row is a pattern from `levels.patterns`: `lanes` is a string with one symbol per lane; each symbol maps to the
  entity with that `symbol`; `.` is empty. Patterns are picked at random weighted by `weight`, among those with
  `minTime` ≤ run time. Gate symbols are treated as `.` if `rules.gatesEnabled` is false. If `player.lanes` differs
  from a pattern's length, the pattern is skipped (patterns are validated once at boot; a remixer changing the number
  of lanes must update patterns: the game logs a warning in debug and falls back to single-obstacle rows).
- **Safe path rule (fairness)**: the spawner tracks `safeLanes` (lanes passable in the previous row). A candidate
  pattern is accepted only if one of its passable lanes is within `maxShift` lanes of a previous safe lane, with
  `maxShift = clamp(floor((rowGap / speed − reactionTime) / laneSwitchDuration), 0, lanes − 1)`. Passable = no
  non-jumpable obstacle (and no jumpable one either if `jumpEnabled` is false). Up to 8 tries, then an empty row.
- A `C` cell spawns a vertical trail of `coinTrailLength` coins spaced by `coinSpacing`, starting at the row.

### Obstacles
- `block` (X): non-jumpable, `rect` `hazard` 150 × 120. `barrier` (L): jumpable, flat `rect` `hazard` 180 × 36.
- Hit = lose one life (or the run if `lives` = 1): hit sound, flash, shake, the obstacle is destroyed (particles) so it
  can't hit twice.

### Pickups
- Coin: +`points` × current multiplier, `collect` sound, "+N" popup, counted in `coins`.

### Gates (optional)
- Occupy one lane, never block. Passing through sets `multiplier = min(max(multiplier, gate.multiplier),
  rules.maxMultiplier)` and restarts a timer of `gate.duration` s; when it ends, multiplier returns to 1. A higher gate
  replaces a lower one; the same value refreshes the timer.

### Systems (update order, every fixed step)
1. `inputSystem`: read actions → lane target / jump.
2. `scrollSystem`: `speed = curve(difficulty.speed, runTime)`, move all world entities by `speed × dt`, accumulate
   `distance += speed × dt / unitsPerMeter`.
3. `spawnSystem`: rows by scrolled distance (above).
4. `playerSystem`: lane tween, jump timer, invulnerability timer.
5. `collisionSystem`: player AABB vs obstacles / coins / gates (only entities with y in the player's band).
6. `scoringSystem`: `score += speed × dt / unitsPerMeter × pointsPerMeter × multiplier` (float, displayed and sent
   floored); multiplier timer.
7. `cleanupSystem`: despawn below the stage, return to pools.
8. `endSystem`: lives = 0 → RESULT (lose); `targetDistance` > 0 and reached → RESULT (win).

Tunneling: max speed 1400 u/s → 23 u per step, smaller than the thinnest obstacle (36 u): no swept test needed. If a
remixer pushes speed above 2000, collisions use the segment covered during the step.

## 7. game_spec parameters (genre sections)

| Key | Default | Unit | Effect | Safe range |
|---|---|---|---|---|
| `rules.lives` | 1 | – | Hits before game over | 1–5 |
| `rules.invulnerableTime` | 1.5 | s | Grace after a hit | 0.5–3 |
| `rules.targetDistance` | 0 | m | 0 = endless, > 0 = finish line (win) | 0–10000 |
| `rules.unitsPerMeter` | 100 | u/m | Distance scale | 50–200 |
| `rules.pointsPerMeter` | 1 | pts | Score per meter | 0–10 |
| `rules.reactionTime` | 0.25 | s | Used by the safe path rule | 0.1–0.5 |
| `rules.gatesEnabled` | true | – | Multiplier gates on/off | – |
| `rules.maxMultiplier` | 5 | × | Cap | 1–10 |
| `player.lanes` | 3 | – | Number of lanes (patterns must match) | 2–5 |
| `player.laneWidth` | 200 | u | Lane width | 120–240 |
| `player.y` | 1060 | u | Player line | 900–1150 |
| `player.startLane` | 1 | index | Start lane | 0..lanes−1 |
| `player.laneSwitchDuration` | 0.12 | s | Lane tween | 0.06–0.3 |
| `player.jumpEnabled` | true | – | Jump on/off | – |
| `player.jumpDuration` | 0.6 | s | Airtime | 0.3–1 |
| `player.jumpScale` | 1.3 | × | Visual height | 1.1–1.6 |
| `player.airControl` | true | – | Lane switch in the air | – |
| `player.hitboxScale` | 0.8 | × | Forgiveness | 0.5–1 |
| `entities[]` | 5 types | – | `kind` obstacle / pickup / gate, `symbol`, `jumpable`, `points`, `multiplier`, `duration`, `look` | – |
| `difficulty.speed` | 600 → 1400 over 180 s | u/s | Scroll speed curve | 300–2000 |
| `difficulty.rowGap` | 720 → 380 over 180 s | u | Distance between rows | ≥ 300 |
| `difficulty.coinTrailLength` | 4 | coins | Trail length | 1–8 |
| `difficulty.coinSpacing` | 90 | u | Trail spacing | 60–150 |
| `levels.patterns[]` | 13 patterns | – | `lanes`, `minTime` (s), `weight` | – |
| `limits.obstacles / pickups / gates` | 36 / 48 / 6 | – | Pool sizes | – |
| `audio.sfx.laneSwitch / land / gate` | recipes | – | Genre sounds | – |

## 8. Difficulty curve
- 0–10 s: single blocks only, wide gaps (720 u at 600 u/s = 1.2 s per row): a tutorial without text.
- 10–30 s: low barriers appear (teaches jump), coins in risky lanes.
- 20–60 s: double blocks and `LLL` rows (must jump), first gates at 15 s.
- 60–180 s: speed 1000 → 1400, gaps 440 → 380 u (≈ 0.27 s per row at max): expert territory. The safe path rule keeps
  every row passable.
- After 180 s: constant. A run ends by mistake, not by impossibility.

## 9. Win, lose, score
- Lose: lives reach 0. Win: only if `targetDistance` > 0 and reached.
- Score = Σ (meters × `pointsPerMeter` + coin points) × active multiplier. **`sendScore` = floor(score)**.
- Result screen also shows distance (m) and coins.
- `save.progress`: `{ "bestDistance": m, "totalCoins": n }`.

## 10. HUD and screens
- Top-left: score (hudScore), coins below (diamond icon + count, hudSecondary).
- Top-center: distance "123 m"; when a multiplier is active, a "×2" badge in `special` under it with a timer bar.
- Top-right: pause. Bottom: nothing (keep the lanes readable).
- Title: attract mode (lanes scroll at 300 u/s, no obstacles), hints from `text.controlsKeyboard` / `controlsTouch`.
- Result: score, best, distance, coins.

## 11. Feedback and sound

| Event | Visual | Sound |
|---|---|---|
| Lane switch | squash 0.1 s | `laneSwitch` |
| Jump | scale arc + shadow | `action` |
| Landing | squash | `land` |
| Coin | "+N" popup, small burst `pickup` | `collect` |
| Gate | burst `special`, badge pops | `gate` |
| Hit | flash, shake, obstacle bursts | `hit` |
| Multiplier ends | badge fades | – |
| Run over / finish | – | `lose` / `win` |

## 12. Edge cases
- Swipe left and right within the same step: both applied in order (net zero), no stuck tween.
- Jump pressed during a jump: buffered, fires on landing if within `bufferTime`.
- Hit by two obstacles in the same step: one life lost (invulnerability starts on the first).
- Pause mid-jump or mid-tween: everything frozen, resumes exactly.
- Resize mid-run: contain mode, nothing moves in stage space.
- Pool empty: the row is skipped (logged in debug only).
- `player.lanes` changed without matching patterns: fallback rows with one random block, debug warning.
- `difficulty.rowGap` set below what the safe path rule can satisfy: the rule still guarantees a reachable lane (it
  may produce empty rows).
- `jumpEnabled` false: `L` cells count as blocking for the safe path rule, tap does nothing in play.

## 13. Performance budget
- At max speed with 380 u gaps: ≈ 5 rows on screen, ≤ 15 obstacles + 20 coins + 2 gates + particles. Pools: 36 / 48
  / 6.
- Stress test: `debug.invincible` + `debug.timeScale` 1 for 3 min (max speed reached) on the reference device, then
  `difficulty.rowGap` forced to 300.

## 14. Remix hooks
- Theme: skins (`drawPlayer`, `drawObstacle`, `drawPickup`, `drawGate`) + palette. "Make it a space run with
  asteroids" = skins only.
- Layout: `player.lanes` + `laneWidth` + patterns. "Make it 5 lanes".
- Content: new obstacle = new entity with a new symbol + patterns using it. "Add a moving obstacle that switches lane"
  needs a new `behaviour` field + a system: acceptable for a remix prompt, not in the base.
- Rules: `targetDistance` (race), `lives`, `gatesEnabled`.
- Example remix prompts that must work: "Make the player a cat and the obstacles boxes", "Add a magnet power-up that
  attracts coins for 5 seconds", "Make it a 1000 m race", "Make it harder", "Use 4 lanes".

## 15. Acceptance criteria
- [ ] 3 lanes, lane switch by keys, swipe (touch) and mouse drag, same tween duration
- [ ] Jump by Space/Up/W, tap, swipe up; jumpable barriers ignored in the air, blocks still hit
- [ ] Rows follow `levels.patterns` and `minTime`; changing a pattern string changes the game
- [ ] 5 min autoplay test with `debug.invincible`: never a row with no reachable lane (log rejected patterns)
- [ ] Speed and gap follow the curves (debug overlay shows speed)
- [ ] Gates set and refresh the multiplier, cap at `maxMultiplier`, badge + timer shown
- [ ] Score = floor of distance points + coins, × multiplier; same value sent and saved as best
- [ ] `targetDistance` = 500 → finish screen with "Finish!" at 500 m
- [ ] `lives` = 3 → blinks and invulnerability after a hit
- [ ] `gatesEnabled` false and `jumpEnabled` false both work without errors

## 16. Prompt plan
- **p1** (core): remix preamble / common block, lanes, player (switch + jump), scroll, spawner with patterns and safe
  path rule, obstacles and collisions, death → Result, distance score. game_spec: meta, text, input, rules, player,
  entities.
- **p2** (systems): coins and trails, gates and multiplier, difficulty curves, lives and invulnerability, end
  conditions (target distance), save progress, pools and limits. game_spec: difficulty, levels, limits, audio.
- **p3** (UI and feel): HUD, title attract mode, result details, all feedback and sounds, debug overlay values,
  acceptance checklist.
