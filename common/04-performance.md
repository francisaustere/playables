# 04 · Performance (30 FPS stable on a 3-year-old mid-range Android)

Reference device to define at kickoff (e.g. Samsung Galaxy A52 / Pixel 5a class, Chrome Android + YouTube app).
Target **60 FPS on desktop, never below 30 on the reference device**, including the hardest moment of the run.

## Loop

- One `requestAnimationFrame` loop. **Fixed simulation step** of `1/60 s` with an accumulator, at most 4 steps per
  frame (drop the rest), render once per frame with interpolation optional.
- Frame delta clamped to 0.1 s (tab switches, hitches).
- All gameplay timers run on **game time** (accumulated in the step), never `setTimeout` / `setInterval`, so pause and
  `debug.timeScale` freeze or scale them.

## Memory

- **No allocation in the loop**: no `new`, no array/object literals, no closures, no `map/filter/forEach` with
  callbacks, no string concatenation per frame in hot paths.
- **Pools** for everything spawned (obstacles, bullets, particles, popups, notes). Pool sizes come from
  `game_spec.limits`; when a pool is empty, skip the spawn rather than allocate.
- Remove from active lists by swap-and-pop.

## Rendering

- Canvas sized to `cssSize × min(devicePixelRatio, display.maxDpr)`; `maxDpr` = 2 by default (1.5 is the fallback
  if the reference device drops frames).
- No `shadowBlur`, no `filter`, no per-frame gradients, avoid `globalCompositeOperation` changes. Flat fills only.
- Static backgrounds (grid, lanes, walls, board) pre-rendered once to an offscreen canvas, redrawn on resize only.
- Text: HUD strings rebuilt only when the value changes; avoid `measureText` per frame.
- Batch by color when drawing many identical shapes (set `fillStyle` once, one path, many shapes).

## Simulation

- Collisions: circle/AABB tests. Above ~100 colliders, use a uniform grid (cell size in `limits.collisionCell`).
- Cap entities, particles and popups with `game_spec.limits`.
- Off-screen entities are culled from drawing and despawned when no longer relevant.

## Budget check (QA)

- `debug.showFps` overlay: FPS (average over 1 s) + active entity count.
- Stress test: run the genre's hardest wave / speed with `debug.invincible` for 3 minutes on the reference device,
  FPS must stay ≥ 30.
- Bundle: no assets, so it should stay well under 1 MB. Anything above 2 MB is a bug.
