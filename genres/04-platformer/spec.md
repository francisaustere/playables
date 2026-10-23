# 04 · Platformer

> Follows the Endless Runner reference spec. Common rules (`common/`) apply.

## 1. Pitch
Run, jump and double-jump up a tile level to reach the goal: stomp the patrolling enemies, avoid spikes and the bottomless
pit, grab coins, beat the clock for a time bonus.
Archetype references (team only): Super Mario Bros., Celeste (feel), Doodle-style vertical climbs.

## 2. SOW coverage

| SOW mechanic | Where | Keys |
|---|---|---|
| Gravity | §6 Player physics | `player.gravity`, `player.maxFall` |
| Collisions | §6 Tile collisions | `levels.tileSize`, `levels.list[].rows` |
| Acceleration | §6 Player physics | `player.accel`, `player.decel`, `player.airAccel`, `player.runSpeed` |
| Single and double jump | §6 Jump | `player.jumpHeight`, `player.doubleJumpHeight`, `player.maxJumps` |
| Kill zone at the bottom | §6 Kill zone | `rules.killZoneOffset` |
| 1 patrolling enemy | §6 Enemies | `entities[kind=enemy]` (`patroller`) |

Extras (cheap, expected by the archetype): coyote time, jump buffer, variable jump height, coins, spikes,
checkpoints, goal.

## 3. Core loop
Read the next platform, run, jump (double jump for the bigger gaps), land, repeat; stomp or avoid the patroller on the
way. A level takes 30–60 s; the run = `levels.list` in order (2 levels by default), lives shared across levels.

## 4. Stage and camera
- Stage 720 × 1280, **`fit: expand`** (override, justified: the camera scrolls anyway, so wide screens simply show more
  of the level; nothing spawns, so fairness is not affected). **Portrait** because the levels climb vertically, which
  suits the Shorts feed; levels are data, so a remixer can draw wide horizontal levels.
- World = level grid: `cols × tileSize` by `rows × tileSize` (tile 64). Row 0 is the top.
- Camera: follows the player center with a deadzone (`camera.deadzoneW × deadzoneH`, centered); outside it, the camera
  moves toward the player by `min(1, camera.lerp × dt)` of the distance. Clamped to the level bounds; on an axis where
  the view is larger than the level, the level is centered.
- Tiles are pre-rendered once per level to an offscreen canvas (`levels.tileLook`: `surface` fill, `line` outline).

## 5. Controls

| Action | Keyboard | Mouse | Touch | Effect |
|---|---|---|---|---|
| `left` / `right` | ← → / A D | click-hold on-screen buttons | on-screen buttons (bottom-left) | Run |
| `jump` | Space / ↑ / W | click on-screen jump button | on-screen button (bottom-right) | Jump / double jump; release early = shorter jump |
| `pause` | Esc / P | pause button | pause button | Pause |

### New gestures (defined here, to add to `common/03-input.md` if approved)
- `button:<name>`: a virtual on-screen button, square of `input.touchButtons.size` (128 u), `alpha` 0.45, anchored to
  the visible screen corners + safe margin: `left` and `right` side by side at the bottom-left (separated by `gap`),
  `jump` at the bottom-right. A pointer down on a button holds the action; a pointer that slides from `left` to
  `right` switches (hit test on `pointermove`); multi-touch: run and jump at the same time. Mouse clicks work the same.
- Visibility: if `showOnlyAfterTouch`, the buttons appear once a touch pointer has been used (or from the start when
  `matchMedia('(pointer: coarse)')` matches) and hide again after a keyboard input.

## 6. Entities and systems

### Tiles and level data
- `levels.list[].rows`: array of strings, one char per tile. `#` = solid (`levels.solidSymbol`), `.` = empty, `P` =
  player start (`levels.playerSymbol`), other symbols map to the entity with that `symbol` (`E` patroller, `C` coin,
  `^` spikes, `K` checkpoint, `G` goal). Rows must have equal length (validated at load: shorter rows padded with `.`
  and a debug warning).

### Player physics
- Hitbox = `player.look.w × look.h` (44 × 56), positioned by its bottom-center (enemies use their `look.w × h` too).
- Horizontal: `dir ∈ {−1, 0, 1}` from actions (both pressed = 0). Target `dir × runSpeed`; `vx` moves toward it at
  `accel` (ground, dir ≠ 0), `decel` (ground, dir = 0) or `airAccel` (in the air, both cases).
- Vertical: `vy += gravity × dt`, capped at `maxFall`.
- Jump velocities computed at boot: `jumpV = sqrt(2 × gravity × jumpHeight)`, `doubleJumpV = sqrt(2 × gravity ×
  doubleJumpHeight)` (220 u ≈ 3.4 tiles, + 150 u with the double jump).
- **Jump buffer**: a jump press is remembered `jumpBuffer` s. **Coyote time**: `coyoteTimer = coyoteTime` when leaving
  the ground without jumping.
- Jump resolution each step, if a buffered press exists:
  - grounded or `coyoteTimer > 0` → `vy = −jumpV`, `jumpsUsed = 1`, consume the press, `coyoteTimer = 0`;
  - else if `jumpsUsed < maxJumps` → `vy = −doubleJumpV`, `jumpsUsed += 1`, consume (`doubleJump` sound).
  - Falling off a ledge: when the coyote timer expires, `jumpsUsed = 1` (only the air jump remains).
- **Variable height**: when `jump` is released while `vy < 0`, `vy *= jumpCut` (once per jump).
- Landing resets `jumpsUsed = 0` (`land` sound + squash if the landing speed > 300 u/s).

### Tile collisions
- Axis-separated AABB vs solid tiles: move X, resolve (snap to the tile edge, `vx = 0`), then move Y, resolve (landing:
  grounded, `vy = 0`; ceiling: `vy = 0`). Only tiles overlapping the swept box are tested.
- Max fall 1400 u/s → 23 u per step < tile 64: no tunneling.

### Enemies (`entities[kind=enemy]`, `patroller`)
- Spawn on their `E` tile, walk at `speed` in the initial direction (toward the player start side), gravity like the
  player, collide with tiles. Turn around on a wall; if `turnAtEdges`, also turn when the tile under the leading foot is
  empty.
- **Stomp**: player overlaps the enemy, `vy > 0` and the player's bottom at the previous step ≤ enemy top +
  `stompTolerance` → enemy dies (burst, `stomp` sound, +`points`), player `vy = −stompBounce`, `jumpsUsed = 1`
  (double jump still available after a stomp).
- Otherwise contact = **hurt** (if not invulnerable): lose one life, knockback `vx = ±hurtKnockback.x` away from the
  enemy, `vy = −hurtKnockback.y`, invulnerable `rules.invulnerableTime` (blink 10 Hz).

### Hazards, pickups, checkpoints, goal
- Spikes (`kind: hazardTile`): touching = lose one life and **respawn** at the last checkpoint (no knockback: avoids
  standing on spikes during invulnerability). Hitbox: bottom half of the tile.
- **Kill zone**: player top > `rows × tileSize + rules.killZoneOffset` → lose one life, respawn at the last checkpoint.
- Respawn: position = checkpoint (or `P`), `vx = vy = 0`, invulnerable `invulnerableTime`, camera snaps.
- Coin: +`points`, `collect` sound, popup.
- Checkpoint (`K`): first touch sets the respawn point (ring fills with `special`, `checkpoint` sound).
- Goal (`G`): touch → level clear: `timeBonus = max(0, timeBonusMax − levelTime × timeBonusPerSecond)` added to the
  score → LEVEL_CLEAR (or RESULT win after the last level).

### Systems (update order, every fixed step)
1. `inputSystem`: dir, jump press/release (buffer).
2. `playerSystem`: horizontal accel, gravity, jump resolution, timers.
3. `tileCollisionSystem`: player.
4. `enemySystem`: movement, tile collisions, turning.
5. `contactSystem`: enemies (stomp / hurt), spikes, coins, checkpoint, goal.
6. `killZoneSystem`.
7. `cameraSystem`.
8. `endSystem`: lives 0 → RESULT lose.

## 7. game_spec parameters (genre sections)

| Key | Default | Unit | Effect | Safe range |
|---|---|---|---|---|
| `display.fit` | expand | – | More level visible on wide screens | – |
| `input.touchButtons.size / gap / alpha` | 128 / 24 / 0.45 | u, u, 0..1 | On-screen buttons | 96–180 |
| `input.touchButtons.showOnlyAfterTouch` | true | – | Hide on desktop | – |
| `rules.lives` | 3 | – | Lives for the run | 1–9 |
| `rules.invulnerableTime` | 1.5 | s | After hurt / respawn | 0.5–3 |
| `rules.killZoneOffset` | 256 | u | Distance below the level before death | 0–1000 |
| `rules.timeBonusMax / timeBonusPerSecond` | 1000 / 10 | pts, pts/s | Time bonus at the goal | 0–5000 / 0–100 |
| `player.look.w / h` | 44 / 56 | u | Hitbox and drawn size | 32–60 / 40–64 |
| `player.gravity / maxFall` | 2600 / 1400 | u/s², u/s | Fall | 1200–5000 / 800–2000 |
| `player.runSpeed` | 420 | u/s | Top speed | 200–700 |
| `player.accel / decel / airAccel` | 3000 / 3600 / 2000 | u/s² | Run feel | 800–8000 |
| `player.jumpHeight / doubleJumpHeight` | 220 / 150 | u | Jump heights | 120–400 / 0–300 |
| `player.maxJumps` | 2 | – | 1 = single, 2 = double, 3 = triple | 1–3 |
| `player.jumpCut` | 0.45 | × | Short hop on early release | 0.2–1 |
| `player.coyoteTime / jumpBuffer` | 0.1 / 0.12 | s | Forgiveness | 0–0.2 |
| `player.stompBounce / stompTolerance` | 700 / 16 | u/s, u | Stomp | 300–1200 / 4–32 |
| `player.hurtKnockback` | 360, 600 | u/s | Hurt push | – |
| `camera.lerp / deadzoneW / deadzoneH` | 8 / 120 / 200 | 1/s, u | Camera feel | 2–20 / 0–400 |
| `entities[]` | patroller, coin, spikes, checkpoint, goal | – | `symbol`, `speed`, `turnAtEdges`, `points`, `look` | – |
| `levels.tileSize` | 64 | u | Tile size | 32–96 |
| `levels.list[].rows` | 2 levels (12 × 24, 16 × 18) | – | Level grids | – |
| `limits.enemies / pickups` | 24 / 64 | – | Pools | – |
| `audio.sfx.doubleJump / stomp / land / checkpoint / levelClear` | recipes | – | Genre sounds | – |

## 8. Difficulty curve
Difficulty is level data:
- Level 1 (vertical climb, 12 × 24): first platform has a patroller (stomp lesson), single jumps of 3 tiles, one gap
  of 2 tiles + 3 up (row 17 → row 14), tight with a running single jump, comfortable with the double jump, checkpoint at mid height, pit next to the start.
- Level 2 (16 × 18): spikes to jump over on the ground, a pit with a patroller guarding the landing, two double-jump
  gaps, tighter platforms, checkpoint, goal at the top right.
- Jump reach used by the level design: single 220 u (3 tiles with 28 u margin), double 370 u; horizontal ≈ 5 tiles at
  full speed.

## 9. Win, lose, score
- Lose: lives reach 0. Win: goal of the last level.
- Score = coins + stomps + time bonuses. **`sendScore` = score**.
- `save.progress`: `{ "bestLevel": index reached }`.

## 10. HUD and screens
- Top-left: score; lives below as small `player` squares.
- Top-center: "Level 1/2" and the level time `m:ss`.
- Top-right: pause.
- Bottom: on-screen buttons (§5), drawn as `surface` rounded squares with `line` outline and arrow / up icons in
  `text`, pressed = `line` fill.
- Title: attract mode = level 1 seen from the start, the camera slowly panning up to the goal and back; hints from
  `text.controls*`.
- LEVEL_CLEAR: `text.levelClear`, time, time bonus, button `text.next`.
- Result: score, best, level reached.

## 11. Feedback and sound

| Event | Visual | Sound |
|---|---|---|
| Jump / double jump | stretch 0.1 s; double jump: 4 particles under the feet | `action` / `doubleJump` |
| Landing (> 300 u/s) | squash, 3 dust particles (`line`) | `land` |
| Stomp | enemy flattens (scale y 0.3, 0.15 s) then bursts, "+100" | `stomp` |
| Hurt | flash, shake, blink | `hit` |
| Death (pit / spikes) | burst at the death position, camera snaps to the checkpoint | `hit` |
| Coin | "+10" popup | `collect` |
| Checkpoint | ring fills | `checkpoint` |
| Goal | burst `positive` | `levelClear` |

## 12. Edge cases
- Left and right held together: dir = 0 (decel).
- Jump pressed just before landing: buffered, fires on landing (`jumpBuffer`). Pressed just after leaving a ledge:
  coyote jump, still keeps the double jump.
- Head bump on a ceiling during a double jump: `vy = 0`, falls; no extra jump granted.
- Stomp and hurt in the same step (two enemies): the stomp wins, invulnerability is not triggered.
- Stomp on an enemy while invulnerable: allowed (stomp is not damage).
- Enemy walking off a ledge when `turnAtEdges` is false: falls; below the kill zone it is despawned silently.
- Respawn while an enemy stands on the checkpoint: player invulnerable for `invulnerableTime`, no instant death.
- Pause while a touch button is held: released; on resume the player must press again.
- Corner case of AABB resolution (landing exactly on a tile corner): X resolved first, so the player slides off
  rather than snagging.
- Level with no `P`: start at the first empty tile of the bottom row (debug warning). No `G`: level never ends
  (debug warning).
- `maxJumps` 1: double jump disabled cleanly; `maxJumps` 3: triple jump works.

## 13. Performance budget
- Tiles pre-rendered; only tiles near moving bodies are tested. ≤ 24 enemies, ≤ 64 pickups.
- Stress test: a 64 × 64 level filled with 24 patrollers and 64 coins (debug level), `debug.invincible`, 3 min of
  play on the reference device ≥ 30 FPS; offscreen tile canvas ≤ 4096 px per side (larger levels split in chunks).

## 14. Remix hooks
- Theme: skins (`drawPlayer`, `drawEnemy`, `drawCoin`, `drawSpikes`, `drawCheckpoint`, `drawGoal`) + `levels.tileLook`.
- Feel: `player.*` (floaty moon jump, fast runner, triple jump).
- Content: levels are strings; a new symbol = a new entity entry.
- Example remix prompts that must work: "Make it a ninja in a bamboo forest", "Add a third level that goes right
  instead of up", "Add moving platforms", "Remove the double jump", "Add a flying enemy that moves up and down".

## 15. Acceptance criteria
- [ ] Run with acceleration and deceleration (keys, on-screen buttons with touch and mouse); left+right = stop
- [ ] Single jump, double jump, short hop on early release; coyote time and jump buffer noticeable and tunable
- [ ] No tunneling, no snagging on tile corners, head bumps stop the jump
- [ ] Falling into the pit or touching spikes costs a life and respawns at the checkpoint
- [ ] Patroller turns at walls and edges; stomp kills it and bounces; side contact hurts with knockback
- [ ] Goal → LEVEL_CLEAR with time bonus → level 2; goal of level 2 → win; lives 0 → lose
- [ ] Editing a row string changes the level; `maxJumps` 1 and 3 work
- [ ] Camera deadzone + lerp, clamped to the level, centered when the view is larger
- [ ] Touch buttons: run and jump together (multi-touch), slide from left to right switches
- [ ] Score shown = value sent with `sendScore` = best saved

## 16. Prompt plan
- **p1** (core): player physics (accel, gravity, jump, double jump, coyote, buffer, variable height), tile collisions,
  on-screen buttons, camera, enemies, stomp/hurt, spikes, kill zone, checkpoint, goal, using a small test grid.
  game_spec: meta, display, input, rules, player, camera, entities.
- **p2** (systems): level loading from strings, 2 levels, LEVEL_CLEAR flow, lives across levels, coins, time bonus,
  score and save, pools, tile pre-render, sounds. game_spec: levels, limits, audio.
- **p3** (UI and feel): HUD, title attract pan, level clear and result screens, feedback, debug values, acceptance
  checklist. game_spec: text.
