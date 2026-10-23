# 03 · Physics Launch

> Follows the Endless Runner reference spec. Common rules (`common/`) apply.

## 1. Pitch
Aim, set the power, launch a ball: it flies under gravity, bounces off walls and obstacles, and must break every target
of the level with a limited number of shots. Two input modes in one template: slingshot (drag back and release) or
tap-impulse (aim, hold to charge a power meter, release).
Archetype references (team only): Angry Birds, paper toss, mini-golf shots, Peggle-like bounce shots.

## 2. SOW coverage

| SOW mechanic | Where | Keys |
|---|---|---|
| Trajectory from a launch vector | §6 Launcher, Projectile | `launcher.maxLaunchSpeed`, `launcher.min/maxAngle` |
| Power indicator | §6 Launcher, §10 | `launcher.maxPull`, `launcher.chargeTime`, `launcher.meterSpeed` |
| Gravity | §6 Projectile | `projectile.gravity` |
| Bounces | §6 Projectile, Obstacles | `projectile.restitution`, `projectile.friction`, `entities[kind=obstacle].restitution` |
| Two input modes in game_spec: slingshot and tap-impulse | §5 | `input.launchMode` |

## 3. Core loop
Read the level (5 s), aim and set power (2–4 s), watch the flight (1–4 s), adjust. A level = 3–4 shots; the run =
`levels.list` played in order (5 levels, about 3–5 minutes). Clearing a level shows LEVEL_CLEAR; running out of shots
ends the run.

## 4. Stage and camera
- Stage 720 × 1280, `fit: contain`. **Portrait** chosen over the archetype's usual landscape: the Shorts feed is
  portrait, the family is portrait-first, and lob shots read well vertically (launcher bottom-left, targets on the
  right and up high). Levels are data, so a remixer can redesign them for any layout.
- Fixed camera: the whole level is always visible.
- Floor: solid line at `rules.floorY` (1200), drawn as a `surface` rect to the bottom of the stage with a `line` top
  edge. Left and right stage edges are walls if `rules.sideWalls` (default true); otherwise the ball is out when it
  leaves the stage by more than `rules.outMargin`. The top is open (the ball falls back by gravity).
- Launcher at `level.launcher {x, y}`, drawn with `launcher.look` (ring); the ball rests at its center before launch.

## 5. Controls

`input.launchMode` = `"slingshot"` (default) or `"tapImpulse"`.

| Action | Keyboard | Mouse | Touch | Effect |
|---|---|---|---|---|
| `aimUp` / `aimDown` | ← ↑ A W / → ↓ D S | – | – | Rotate the aim angle at `aimSpeed` °/s, clamped to [`minAngle`, `maxAngle`] (0° = right, 90° = up) |
| `charge` (slingshot) | hold Space: pull grows to full in `chargeTime`, release: launch | drag from anywhere, release | drag from anywhere, release | Pull vector → angle + power |
| `charge` (tapImpulse) | hold Space: meter oscillates, release: launch | press: aim toward pointer, hold: meter, release: launch | same as mouse | Angle from pointer, power from meter |
| `pause` | Esc / P | pause button | pause button | Pause |

- **Slingshot pointer**: press anywhere in the stage (not on a UI button) = anchor A; current pointer P; pull vector
  `A − P`, clamped to length `maxPull`. Angle = angle of `A − P` clamped to [minAngle, maxAngle]; power =
  `|A − P| / maxPull`. Release with power < `minPower` cancels (no shot used). Dragging is relative, so the thumb
  never hides the ball.
- **tapImpulse pointer**: on press and while held, angle = direction from the launcher to the pointer (clamped); power
  meter oscillates ping-pong 0 → 1 → 0 at `meterSpeed` cycles per second, starting at 0 on press; release launches with
  the current meter value (power < `minPower` → cancel).
- **Keyboard** (both modes): arrows set the angle (starting at `startAngle` each level); Space hold builds power
  (slingshot: linear to 1 in `chargeTime`; tapImpulse: oscillating meter), release launches.
- Launch velocity = (cos θ, −sin θ) × power × `maxLaunchSpeed`.
- Input is ignored while a ball is in flight.

## 6. Entities and systems

### Launcher and aim display
- Aim line: from the ball in the aim direction, length 60 + 140 × power, `player` color.
- Power indicator: a bar next to the launcher (vertical, 16 × 160 u, fill `player`, turns `pickup` above 0.9).
- Trajectory preview (`previewEnabled`): `previewDots` dots sampled analytically over `previewTime` s
  (`p(t) = p0 + v t + ½ g t²`), ignoring collisions, `textMuted` color, alpha decreasing. Shown while charging only.

### Projectile (one at a time)
- Circle radius `look.size / 2` (24). Integration: semi-implicit Euler, `v.y += gravity × dt`, `v *= (1 − airDrag × dt)`,
  position += v × dt, with **substeps**: `n = min(8, ceil(|v| × dt / (radius × 0.5)))` so it never tunnels through a
  30 u obstacle at 1600 u/s.
- Collision vs circle-vs-AABB (obstacles, floor, side walls): push out along the contact normal, reflect the normal
  component × restitution (obstacle's own `restitution`, floor and walls use `projectile.restitution`), multiply the
  tangential component by `friction`. `bounce` sound if the normal speed > 80 u/s.
- Targets: circle vs circle. If the impact speed ≥ `minBreakSpeed`, the target breaks (points, burst, `targetBreak`
  sound, "+N" popup) and the ball **continues unaffected** (it can break several targets in one shot). Below
  `minBreakSpeed` the ball bounces off the target like a wall.
- Trail: a dot every `trailInterval` s (pool `limits.trailDots`), fading, cleared at the next shot.
- Shot end when: speed < `restSpeed` for `restTime` s, or flight time > `maxFlightTime`, or out of bounds (only when
  `sideWalls` is false). Then: all targets broken → LEVEL_CLEAR; else shots left → reset the ball on the launcher; else
  → RESULT lose.

### Obstacles (data: `entities[kind=obstacle]`)
- Static axis-aligned rects, `x, y` top-left, `w, h` from the level, look from the type. `wall` (0.55), `bouncer`
  (1.15, gives energy), `sticky` (0.1, kills bounces).

### Targets (data: `entities[kind=target]`)
- Static circles at `x, y` (center), radius `look.size / 2`, `points`.

### Levels
- `levels.list[]`: `{ id, shots, launcher {x,y}, obstacles [{type, x, y, w, h}], targets [{type, x, y}] }`, played in
  order. Optional per-level `gravity` overrides `projectile.gravity`.

### Systems (update order, every fixed step)
1. `inputSystem`: aim, charge, launch (only in `aiming` phase).
2. `projectileSystem`: substepped integration + collisions + target breaks (only in `flying` phase).
3. `restSystem`: shot end detection.
4. `trailSystem`.
5. `levelSystem`: phase changes (`aiming` → `flying` → `aiming` / LEVEL_CLEAR / RESULT).

## 7. game_spec parameters (genre sections)

| Key | Default | Unit | Effect | Safe range |
|---|---|---|---|---|
| `input.launchMode` | slingshot | – | `slingshot` or `tapImpulse` | – |
| `launcher.maxPull` | 220 | u | Drag length for full power | 100–400 |
| `launcher.minPower` | 0.12 | 0..1 | Below: shot cancelled | 0–0.3 |
| `launcher.maxLaunchSpeed` | 1600 | u/s | Speed at full power | 800–2500 |
| `launcher.aimSpeed` | 90 | °/s | Keyboard aim speed | 30–180 |
| `launcher.minAngle / maxAngle / startAngle` | 5 / 85 / 45 | ° | Aim limits and start | −80–170 |
| `launcher.chargeTime` | 1 | s | Keyboard slingshot charge to full | 0.3–3 |
| `launcher.meterSpeed` | 0.8 | cycles/s | tapImpulse meter speed | 0.3–2 |
| `launcher.previewEnabled / previewDots / previewTime` | true / 12 / 0.6 | –, dots, s | Trajectory preview | 0–20 / 0.2–1.5 |
| `projectile.gravity` | 1800 | u/s² | Gravity | 600–4000 |
| `projectile.restitution / friction` | 0.55 / 0.8 | 0..1 | Bounce on floor/walls, tangential keep | 0–1 |
| `projectile.airDrag` | 0 | 1/s | Air resistance | 0–1 |
| `projectile.restSpeed / restTime` | 40 / 0.5 | u/s, s | Rest detection | 10–100 / 0.2–2 |
| `projectile.maxFlightTime` | 8 | s | Hard stop | 3–20 |
| `projectile.minBreakSpeed` | 200 | u/s | Speed needed to break a target | 0–800 |
| `projectile.trailInterval` | 0.05 | s | Trail dot rate | 0.02–0.2 |
| `rules.shotBonus` | 500 | pts | Per remaining shot at level clear | 0–2000 |
| `rules.floorY` | 1200 | u | Floor line | 1000–1260 |
| `rules.sideWalls / outMargin` | true / 200 | –, u | Walls or out of bounds | – |
| `entities[]` | target, bigTarget, wall, bouncer, sticky | – | `points`, `restitution`, `look` | – |
| `levels.list[]` | 5 levels | – | Level data | – |
| `limits.targets / obstacles / trailDots` | 24 / 32 / 30 | – | Pools | – |
| `audio.sfx.charge / bounce / targetBreak / levelClear` | recipes | – | Genre sounds | – |

## 8. Difficulty curve
Difficulty is level data, not time:
1. Two targets in the open: learn power.
2. A wall in front of a near target, a big target up high: learn the lob.
3. A shelf and a bouncer overhead: learn bounces.
4. Tall wall, sticky platform, side bouncer, 4 shots: plan the order.
5. Two walls and a bouncer near the top, 3 shots for 3 targets: precision; one shot can break two targets.

## 9. Win, lose, score
- Level clear: all targets broken → score += remaining shots × `shotBonus` → LEVEL_CLEAR (shows the bonus) → next
  level. After the last level → RESULT win.
- Lose: shots exhausted with targets left → RESULT lose.
- Score = Σ target points + Σ shot bonuses, over the run. **`sendScore` = score**.
- `save.progress`: `{ "bestLevel": index reached }`.

## 10. HUD and screens
- Top-left: score; level "Level 2/5" below.
- Top-center: remaining shots as small `player` circles (empty `line` rings for used shots).
- Top-right: pause.
- Next to the launcher: power bar (while charging).
- Title: attract mode = level 1 with an automatic demo shot every 3 s; hint text depends on `launchMode`
  (`text.controlsTouch` or `text.controlsTouchImpulse`) + `text.controlsKeyboard`.
- LEVEL_CLEAR: `text.levelClear`, shots bonus, button `text.next` (confirm).
- Result: score, best, levels cleared.

## 11. Feedback and sound

| Event | Visual | Sound |
|---|---|---|
| Charging | power bar, aim line, preview dots; ball squashes toward the pull direction (up to 15%) | `charge` each 0.25 of power |
| Launch | ball stretch 0.1 s | `action` |
| Bounce | squash on contact, 3 particles of the obstacle color | `bounce` |
| Target break | burst in the target color, "+N" popup | `targetBreak` |
| Level clear | all remaining shots pop one by one into "+500" popups | `levelClear` |
| Out of shots | – | `lose` |

## 12. Edge cases
- Release exactly at `minPower`: launches (≥). Below: cancelled, shot not consumed, `uiTap` not played.
- Pointer pressed on the pause button: never starts a charge.
- Ball resting on a ledge but slowly sliding: rest needs `restTime` continuous under `restSpeed`; `maxFlightTime` caps
  endless rolling or bouncer loops.
- Ball stuck between two obstacles (overlap resolution jitter): pushed out along the deepest contact first; rest
  detection ends the shot.
- Last target broken mid-flight: the level clears immediately (do not wait for rest).
- Pause during flight or charge: frozen; the charge is cancelled on pause (inputs released).
- Resize: contain mode, no change in stage space.
- Level data with a target inside an obstacle: logged in debug, target still breakable.
- `sideWalls` false and ball leaves the stage: shot ends at once.

## 13. Performance budget
- One ball, ≤ 24 targets, ≤ 32 obstacles, 30 trail dots, 16 preview dots: trivial. Substeps ≤ 8 per step.
- Stress test: `maxLaunchSpeed` 2500, `projectile.restitution` 1 with `sideWalls`, `maxFlightTime` 20: no tunneling,
  60 FPS desktop / 30+ reference device.

## 14. Remix hooks
- Theme: skins (`drawBall`, `drawTarget`, `drawObstacle`, `drawLauncher`) + palette.
- Mode: `input.launchMode`.
- Content: levels are pure data; new obstacle type = new entity with a `restitution`.
- Physics: `projectile.*` (moon gravity, super bouncy ball).
- Example remix prompts that must work: "Make it basketball: one hoop target per level", "Use tap-impulse mode",
  "Add a level with low gravity", "Make targets need two hits", "Add moving targets that slide left and right".

## 15. Acceptance criteria
- [ ] Slingshot: drag back anywhere, aim line + power bar + preview, release launches; tiny drag cancels
- [ ] tapImpulse: angle follows the pointer, meter oscillates while held, release launches
- [ ] Keyboard in both modes: arrows aim, Space hold/release launches with the same physics
- [ ] Gravity, restitution and friction change the flight as expected when edited in game_spec
- [ ] No tunneling at max speed (stress test); bouncer adds energy, sticky kills it
- [ ] One shot can break several targets; slow touches don't break targets
- [ ] Shot ends on rest / max flight time; shots counter correct; level clear bonus = remaining shots × shotBonus
- [ ] 5 levels in order, LEVEL_CLEAR between them, win after level 5, lose when out of shots
- [ ] Score shown = value sent with `sendScore` = best saved

## 16. Prompt plan
- **p1** (core): launcher, both launch modes + keyboard, power and aim display, preview, projectile physics with
  substeps, floor and side walls, obstacles and targets as data, one test level, shot end. game_spec: meta, input,
  launcher, projectile, rules, entities.
- **p2** (systems): levels list, shots, phases, level clear and bonus, LEVEL_CLEAR state, end conditions, score and save,
  pools and limits, sounds. game_spec: levels, limits, audio.
- **p3** (UI and feel): HUD, title attract demo shot, level clear and result screens, feedback, debug values,
  acceptance checklist. game_spec: text.
