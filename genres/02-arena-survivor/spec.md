# 02 · Arena Survivor (Survive & Explore)

> Follows the Endless Runner reference spec. Common rules (`common/`) apply.

## 1. Pitch
Top-down arena bigger than the screen: move in 8 directions, shoot (automatically at the nearest enemy, or aimed),
collect the XP gems dropped by an ever-growing horde, and survive until the timer ends.
Archetype references (team only): Vampire Survivors, Brotato, twin-stick arena shooters.

## 2. SOW coverage

| SOW mechanic | Where | Keys |
|---|---|---|
| Top-down view | §4 | `display.fit`, `world.*` |
| 8-direction movement | §5, §6 Player | `input.bindings.move`, `player.speed`, `player.accel` |
| Camera follows | §4 Camera | `world.cameraLerp` |
| Auto fire and directional fire | §5, §6 Weapon | `rules.fireMode`, `weapon.*`, `input.bindings.aim` |
| Walls | §4, §6 Collisions | `world.wallThickness`, `world.obstacles` |
| Item pickup with magnet | §6 Pickups | `player.magnetRadius`, `entities[kind=xp/heal/magnet]` |

## 3. Core loop
Every second: move to avoid contact, keep enemies in the line of fire, sweep through gems to pull them in with the
magnet. Every `waveInterval` (30 s) a ring of enemies closes in. Run = `rules.duration` (180 s) to win; 0 = endless.
A first run typically ends between 60 and 120 s.

## 4. Stage and camera
- Stage 720 × 1280, **`fit: expand`** (override, justified: the camera shows more of the arena on wide screens; spawns
  happen relative to the visible area, so it stays fair on every ratio).
- World: `world.width × world.height` (2400 × 2400), origin top-left. Border walls of `wallThickness` on the 4 sides.
  `world.obstacles`: solid axis-aligned rects (`x, y` = top-left, `w, h`), drawn with `world.obstacleLook`
  (`neutral` fill, `line` outline).
- Floor: `bg` with a `line` grid every `world.floorGrid` (160 u) (pre-rendered tile, drawn with the camera offset) so
  movement reads.
- Camera: center lerps toward the player, `cam += (player − cam) × min(1, cameraLerp × dt)`, then clamped so the
  visible rect stays inside the world (if the visible rect is larger than the world on an axis, center the world on
  that axis).
- The player starts at the world center.

## 5. Controls

| Action | Keyboard | Mouse | Touch | Effect |
|---|---|---|---|---|
| `move` | WASD / arrows (8 dirs, normalized) | drag on the left half (floating joystick) | floating joystick, left half | Move |
| `aim` | IJKL (8 dirs, normalized) | hold button on the right half: aim at the cursor | floating joystick, right half | Directional fire while held |
| `pause` | Esc / P | pause button | pause button | Pause |

- Auto fire needs no input. With `fireMode: both`, aiming overrides auto fire while `|aim| > input.aimDeadzone`.
- Diagonals from keys are normalized (no faster diagonal). Joystick magnitude scales speed (analog), keys give 1.

### New gestures (defined here, to add to `common/03-input.md` if approved)
- `joystickLeft` / `joystickRight`: the shared `joystick` gesture restricted to pointers that **start** in the left /
  right half of the screen. Each pointer keeps its role until released (multi-touch: move and aim at once).
- `mouseAimRight`: mouse only (`pointerType === "mouse"`), button held with the press started in the right half: aim
  vector = normalize(pointer world position − player position). Touch pointers on the right half use `joystickRight`.
- Bindings with 4 directional key groups: `keys: { up, down, left, right }` produce a normalized vector action.

## 6. Entities and systems

### Player
- Velocity approaches `moveVector × speed` at `accel` u/s² (`v += clampLength(target − v, accel × dt)`).
- Circle collider of radius `look.size / 2` (30), same convention for enemies and projectiles. Resolved against walls and obstacles (circle vs AABB push-out, then slide).
- HP `maxHp` (100). Contact damage: when an enemy overlaps, `hp −= enemy.touchDamage`, then invulnerable for
  `rules.invulnerableTime` (0.6 s, blink 10 Hz) and pushed away from that enemy by `rules.knockback` (u/s impulse,
  decays with `accel`).

### Weapon
- Cooldown `fireInterval` (0.28 s). When ready:
  - directional (fireMode `directional`, or `both` with aim active): fire along the aim vector;
  - auto (fireMode `auto`, or `both` without aim): fire at the nearest enemy within `autoRange` (squared distance,
    grid lookup); no target = no shot (cooldown stays ready).
  - fireMode `directional` without aim: no shot.
- Projectile: speed `projectileSpeed`, lifetime `projectileLife`, circle `projectileRadius`, `damage`, passes through
  `pierce` enemies then dies; dies on walls / obstacles.

### Enemies (data: `entities[kind=enemy]`)
- Move toward the player at `speed × curve(difficulty.enemySpeedScale, t)`. Separation: overlapping enemies push each
  other apart by `difficulty.separation` × overlap (using the collision grid, neighbours only). Resolved against walls
  and obstacles like the player (they slide around obstacles; getting briefly stuck behind one is acceptable).
- `hp`, `touchDamage`, `xp` (gem value dropped). Hit: `enemyHit` sound, white flash. Death: particles, `destroy`
  sound, drops one gem of value `xp`, rolls `heart.dropChance` then `magnet.dropChance` for an extra item.

### Pickups
- Gem (`kind: xp`): within `player.magnetRadius` it moves toward the player at `magnetSpeed` (accelerating feel: speed
  ramps from 0 over `magnetRamp`, 0.15 s); collected within `player.pickupRadius`: `xp += value`, `collect` sound (rate-limited by
  the audio module).
- Heart (`kind: heal`): `hp = min(maxHp, hp + heal)`, `heal` sound. Not magnetized.
- Magnet (`kind: magnet`): all gems on the map become magnetized until collected. `powerup` sound.
- `world.scatterGems` gems (value 1) are placed at random free positions at run start: a reason to explore.
- Items (hearts, magnets) despawn after their `life` (20 s), blinking during the last `rules.itemBlinkTime` (3 s). Gems never despawn; when the gem pool is full, the
  new gem's value is added to the oldest gem instead (no loss, no allocation).

### Spawner
- Every `curve(difficulty.spawnInterval, t)` s: one enemy, type picked by weights `difficulty.typeWeights[id]` at time
  t (weight 0 = not spawned).
- Position: random point on the border of the visible rect expanded by `world.spawnMargin`, clamped inside the world
  walls; rejected if inside an obstacle (4 tries, then skip). Never inside the visible area.
- Every `waveInterval` s (from 30): a wave of `curve(waveSize, t)` chasers spawned evenly on a circle around the player
  at radius = half the visible diagonal + `spawnMargin`, `wave` sound, "Wave N" toast.
- Skip spawns when the enemy pool is empty.

### Systems (update order, every fixed step)
1. `inputSystem`: move and aim vectors.
2. `playerSystem`: velocity, position, invulnerability timer.
3. `weaponSystem`: cooldown, target selection, fire.
4. `spawnSystem`: timer spawns, waves, scatter at start.
5. `enemySystem`: steering, separation.
6. `projectileSystem`: move, lifetime.
7. `collisionSystem`: rebuild the uniform grid (`limits.collisionCell`), projectiles vs enemies, enemies vs player,
   bodies vs walls/obstacles.
8. `pickupSystem`: magnet, collection, item timers.
9. `cameraSystem`: lerp + clamp.
10. `endSystem`: hp ≤ 0 → RESULT lose; `duration` > 0 and t ≥ duration → RESULT win.

Tunneling: projectile 900 u/s → 15 u per step < 2 × (projectile radius 10 + smallest enemy radius 18): no swept test needed.

## 7. game_spec parameters (genre sections)

| Key | Default | Unit | Effect | Safe range |
|---|---|---|---|---|
| `display.fit` | expand | – | Shows more arena on wide screens | – |
| `input.aimDeadzone` | 0.25 | 0..1 | Aim threshold | 0.1–0.5 |
| `rules.duration` | 180 | s | Survive to win, 0 = endless | 0–900 |
| `rules.fireMode` | both | – | `auto`, `directional`, `both` | – |
| `rules.invulnerableTime` | 0.6 | s | After contact damage | 0.2–2 |
| `rules.knockback` | 260 | u/s | Push after a hit | 0–600 |
| `rules.itemBlinkTime` | 3 | s | Items blink before despawning | 0–10 |
| `world.width/height` | 2400 | u | Arena size | 1200–4800 |
| `world.wallThickness` | 40 | u | Border walls | 20–100 |
| `world.floorGrid` | 160 | u | Floor grid spacing | 80–400 |
| `world.cameraLerp` | 8 | 1/s | Camera smoothing | 2–20 |
| `world.spawnMargin` | 80 | u | Spawn distance outside view | 40–300 |
| `world.obstacles[]` | 4 rects | u | Solid blocks | – |
| `world.scatterGems` | 40 | gems | Gems placed at start | 0–150 |
| `player.maxHp` | 100 | hp | Health | 10–500 |
| `player.speed / accel` | 420 / 3200 | u/s, u/s² | Movement | 200–700 / 1000–8000 |
| `player.magnetRadius / pickupRadius` | 160 / 40 | u | Magnet / collect distance | 0–600 / 20–100 |
| `weapon.fireInterval` | 0.28 | s | Cooldown | 0.05–1 |
| `weapon.autoRange` | 420 | u | Auto-target range | 150–900 |
| `weapon.projectileSpeed / projectileLife` | 900 / 1.1 | u/s, s | Bullets (radius = `weapon.look.size / 2`) | 400–1500 / 0.3–3 |
| `weapon.damage / pierce` | 1 / 0 | – | Damage, enemies passed through | 1–10 / 0–5 |
| `entities[kind=enemy]` | chaser, runner, tank | – | `hp, speed, touchDamage, xp, look` (collider radius = `look.size / 2`) | – |
| `entities[kind=xp/heal/magnet]` | gem, heart, magnet | – | `magnetSpeed`, `magnetRamp`, `heal`, `dropChance`, `life` | – |
| `difficulty.spawnInterval` | 1.2 → 0.25 s over 180 s | s | Spawn rate | ≥ 0.1 |
| `difficulty.enemySpeedScale` | 1 → 1.35 | × | Enemy speed ramp | 0.5–2 |
| `difficulty.typeWeights.<id>` | curves | weight | Enemy mix over time | ≥ 0 |
| `difficulty.waveInterval / waveSize` | 30 / 8 → 24 | s / count | Waves | 10–120 / 0–60 |
| `difficulty.separation` | 0.5 | 0..1 | Crowd spreading | 0–1 |
| `limits.enemies / projectiles / gems / items` | 120 / 80 / 220 / 8 | – | Pools | – |
| `audio.sfx.shoot / enemyHit / wave / heal` | recipes | – | Genre sounds | – |

## 8. Difficulty curve
- 0–30 s: chasers only, one every 1.2 → 0.9 s: learn to move and let auto fire work.
- 30 s: first wave (8), runners appear (they punish standing still).
- 60–120 s: tanks appear (need focus or directional fire), spawn every ~0.6 s, waves of 12–16.
- 120–180 s: up to 4 enemies per second + waves of 24, enemies 35% faster: a horde. Winning needs constant movement
  and gem collection for hearts.
- Endless (`duration: 0`): curves hold after 180 s; the cap `limits.enemies` keeps it playable.

## 9. Win, lose, score
- Lose: HP reaches 0. Win: survive `rules.duration` s (only if > 0).
- **Score = XP collected** (sum of gem values). Chosen over survival time because it keeps ranking players who all
  reach 180 s, and rewards both fighting (drops) and exploring (scattered gems, magnet). **`sendScore` = XP**.
- Result also shows time survived and kills.
- `save.progress`: `{ "bestTime": s, "totalKills": n }`.

## 10. HUD and screens
- Top-left: XP (hudScore) and kills below.
- Top-center: timer (remaining time `m:ss` if `duration` > 0, elapsed otherwise) and a wave toast under it for 1.5 s.
- Under the top-left block: HP bar (`player` fill on `line` track, 240 × 16 u), turns `hazard` below 30%.
- Top-right: pause.
- Bottom: when a joystick is held, draw its base ring (`line`, radius `joystickRadius`) and knob (`player` for move,
  `special` for aim) at the touch origin.
- Off-screen indicator: none (remix hook).
- Title: attract mode = the arena drifting slowly with 10 idle enemies, hints from `text.controls*`.

## 11. Feedback and sound

| Event | Visual | Sound |
|---|---|---|
| Shot | small muzzle burst (2 particles) | `shoot` |
| Enemy hit | white flash 0.08 s | `enemyHit` |
| Enemy killed | burst in `hazard`, gem drop | `destroy` |
| Gem collected | tiny "+N" popup only for values ≥ 5 | `collect` |
| Heart / magnet | burst `positive` / `special` | `heal` / `powerup` |
| Player hit | flash, shake, knockback | `hit` |
| Wave | toast "Wave N" | `wave` |
| Result | – | `win` / `lose` |

## 12. Edge cases
- Move and aim pointers at the same time (multi-touch): independent, released individually; a pointer that crosses
  the middle keeps its role.
- Mouse press on the right half while keys move: works (keyboard move + mouse aim is the desktop default).
- Several enemies touching in the same step: one damage instance, then invulnerability.
- Enemy spawned while the camera is clamped at a world edge: border points outside the world are clamped inside the
  walls, still outside the visible rect; if impossible (visible rect covers the world, e.g. 32:9 on a small world),
  spawn on the world edge farthest from the player.
- Projectile hits two enemies in the same step: damages the nearest first, then follows `pierce`.
- Pause with joystick held: inputs released; on resume the joystick must be pressed again.
- Resize during play: camera re-clamps, spawn ring recomputed from the new visible rect.
- Pools full: no spawn / gem merged into the oldest one (§6).
- `fireMode: auto` and `autoRange` tiny: valid, player relies on dodging.

## 13. Performance budget
- Worst case: 120 enemies + 80 projectiles + 220 gems + particles. Collision via uniform grid (cell 128 u), separation
  only against same-cell and neighbour-cell enemies. Gems outside the visible rect + magnet radius are not updated
  except when globally magnetized.
- Stress test: `debug.invincible`, `difficulty.spawnInterval` forced to 0.1 for 3 minutes (pool saturated) on the
  reference device, FPS ≥ 30.

## 14. Remix hooks
- Theme: skins (`drawPlayer`, `drawEnemy`, `drawProjectile`, `drawPickup`, `drawObstacle`) + palette.
- Content: new enemy = new entry in `entities` + a weight curve in `difficulty.typeWeights`.
- Weapon: `weapon.*` (shotgun = add `spread` and `count` in a remix), `rules.fireMode`.
- Arena: `world.*` (size, obstacles layout).
- Example remix prompts that must work: "Make it a zombie survival with a flashlight look", "Add a boss every 60
  seconds", "Make the player shoot 3 bullets in a spread", "Add level-ups: every 20 XP choose between speed, fire rate
  or magnet", "Make it endless".

## 15. Acceptance criteria
- [ ] 8-direction movement with WASD/arrows, mouse drag left half, touch joystick left half; diagonals not faster
- [ ] Camera follows smoothly and never shows outside the world; on 32:9 the wider view stays fair (no spawn in view)
- [ ] `fireMode` auto / directional / both behave as specified; IJKL, mouse hold right half and right joystick aim
- [ ] Move and aim at the same time on touch (two thumbs)
- [ ] Player and enemies collide with walls and obstacles, no tunneling, no stuck player
- [ ] Gems are pulled within `magnetRadius`; magnet item pulls every gem; hearts heal up to max
- [ ] Spawn rate, enemy mix and waves follow the curves (debug overlay shows counts)
- [ ] Survive 180 s → win screen; HP 0 → lose screen; `duration` 0 → endless
- [ ] Score = XP collected = value sent with `sendScore` = best saved
- [ ] Stress test ≥ 30 FPS on the reference device

## 16. Prompt plan
- **p1** (core): arena, walls, obstacles, camera, 8-dir movement, joysticks, weapon with the 3 fire modes,
  projectiles, enemies chasing (types from `entities`), contact damage, HP, death → Result. game_spec: meta, display,
  input, rules, world, player, weapon, entities.
- **p2** (systems): pickups + magnet + scatter gems + items, spawner with curves and weights, waves, separation,
  collision grid, pools and limits, end conditions, score and save. game_spec: difficulty, limits, audio.
- **p3** (UI and feel): HUD (XP, kills, timer, HP bar, joystick visuals, wave toast), title attract, result details,
  feedback and sounds, debug overlay values, acceptance checklist. game_spec: text.
