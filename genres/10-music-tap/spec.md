# 10 · Music Tap (Rhythm)

> Same structure and level of detail as `genres/01-endless-runner/spec.md`. Common rules (`common/`) apply.

## 1. Pitch
Notes fall in 4 lanes toward a hit line in time with a synthesized beat: hit each lane exactly when its note crosses
the line. Perfect timing builds combo and multiplier; misses drain health. Reach the end of the song to win.
Archetype references (team only): Guitar Hero, Piano Tiles, Friday Night Funkin', osu!mania.

## 2. SOW coverage

| SOW mechanic | Where | Keys |
|---|---|---|
| Notes falling in lanes | §4, §6 Notes | `player.*`, `chart.*`, `difficulty.travelTime` |
| Timing windows | §6 Judge system | `rules.perfectWindow`, `rules.goodWindow` |
| Perfect / Good / Miss | §6 Judge, §11 | `rules.perfectPoints`, `rules.goodPoints`, `text.perfect/good/miss` |
| Combo and multiplier | §6 Scoring | `rules.multiplierSteps` |

Genre-specific section (allowed by `common/02-game-spec.md`): `chart` (song data, backing track, lane sounds).

## 3. Core loop
Read the notes coming down (`travelTime` 1.4 s of preview) → press the lane when the note reaches the line → hear the
lane tone on top of the beat, see Perfect/Good → keep the combo. The song lasts ~64 s (16 patterns of 4 s at 120
BPM), density rises in the second half. Lose if health reaches 0.

## 4. Stage and camera
- Stage 720 × 1280, `fit: contain`. No camera movement.
- Lanes: `player.lanes` (4) columns of `laneWidth` (150), centered: lane i center `x = 360 + (i − (lanes − 1) / 2) ×
  laneWidth` (135, 285, 435, 585). Lane backgrounds `surface` with `line` separators, pre-rendered.
- Hit line at `player.hitY` (1080) with one receptor per lane (`receptorLook`). Notes spawn at `player.spawnY` (120).
- Note y for a note at song time `t` when the song clock reads `s`:
  `y = hitY − (t − s) / travelTime × (hitY − spawnY)`. A note exists on screen while `t − s ≤ travelTime` and until
  judged (Miss notes keep falling 0.3 s, faded, then are released).
- Touch zones: each lane column from `input.laneZoneTop` (560) to the bottom of the screen.

## 5. Controls

| Action | Keyboard | Mouse | Touch | Effect |
|---|---|---|---|---|
| `lane0` | D / ← | click lane 0 zone | tap lane 0 zone | Hit lane 0 |
| `lane1` | F / ↓ | click lane 1 zone | tap lane 1 zone | Hit lane 1 |
| `lane2` | J / ↑ | click lane 2 zone | tap lane 2 zone | Hit lane 2 |
| `lane3` | K / → | click lane 3 zone | tap lane 3 zone | Hit lane 3 |
| `pause` | Esc / P | pause button | pause button | Pause |

- Only the **press** counts (pointer down / key down); release does nothing (no hold notes in the base).
- Multi-touch: every `pointerdown` is an independent press in its lane (chords with two thumbs). Key repeat events are
  ignored.
- **Press timestamp**: the judge uses the event's own time, not the step time: `pressSongTime = songTimeNow −
  (performance.now() − event.timeStamp) / 1000`. The input module exposes it per press (see §16 note for common/).

### New gestures
- `laneZone0..N`: `pointerdown` inside lane N's column (x within the lane, y ≥ `input.laneZoneTop` in stage units).
  Fires immediately on down (no tap duration check). Pointers outside every lane column (letterbox) are ignored.

## 6. Entities and systems

### Chart (`chart`)
- Step duration `stepTime = 60 / bpm / stepsPerBeat` (0.25 s). Patterns: one string per lane, one character per step,
  `x` = note, `.` = rest; all strings of a pattern have the same length. `sequence` lists pattern ids in order.
- At song start the whole chart is expanded once into a sorted note list: note k = {lane, time}, `time = leadIn +
  globalStep × stepTime`. Song end = time of the last step of the sequence + `endPadding`.
- Backing: each `backing[]` track is a step string that loops over the whole song from step 0 and plays its `sfx`.
- `laneSfx[i]`: the sound played when lane i is hit (Perfect or Good); together they form the melody.

### Song clock (critical)
- Source A (normal): `songTime = ctx.currentTime − anchorCtx − audioOffset`, while the AudioContext exists and is
  `running`. Audio muted by YouTube only sets the master gain to 0: the context keeps running, the clock stays valid.
- Source B (fallback): game time accumulated by the fixed step, when the context is missing, blocked or not running.
- On any source switch, and on every resume, re-anchor so that `songTime` is continuous (no jump).
- Pause: song clock frozen (context suspended, game time stopped). Resume from PAUSED: `songTime = max(0, songTime −
  resumeRewind)` and re-anchor; notes already judged stay judged; backing scheduling restarts from the new time.
- No `setTimeout` / `setInterval`.

### Audio scheduling
- Every frame, schedule backing hits with `time < songTime + scheduleLookahead` that are not scheduled yet, at the exact
  AudioContext time `anchorCtx + audioOffset + stepTimeOfHit` (the audio module needs `play(name, when)`). With source
  B there is no audio, nothing is scheduled.
- Lane tones play immediately on a successful hit (feedback, not scheduled).

### Judge system
- On a press in lane L at `pressSongTime`: find the **earliest unjudged** note of lane L with
  `|note.time − pressSongTime| ≤ goodWindow`. None → ghost tap: `health += ghostTapHealth` (0 by default), no combo
  change. Found: `d = |Δ|`, Perfect if `d ≤ perfectWindow`, else Good.
- Miss: any unjudged note with `songTime > note.time + goodWindow`.
- Perfect: `+perfectPoints × multiplier`, `combo + 1`, `health += healthPerfect`. Good: `+goodPoints × multiplier`,
  `combo + 1`, `health += healthGood`. Miss: `combo = 0`, `health += healthMiss × curve(missDamageScale, songTime)`.
  Health clamped to [0, 1].
- Multiplier = the `multiplier` of the last `multiplierSteps` entry with `combo ≤ current combo`.

### Systems (update order, every fixed step)
1. `clockSystem`: song time (source A or B, re-anchor on switch).
2. `scheduleSystem`: backing hits within the lookahead.
3. `inputSystem`: presses with their song timestamps, in event order.
4. `judgeSystem`: presses → hits; then passed notes → misses.
5. `scoringSystem`: points, combo, multiplier, health, stats (perfect / good / miss counts, max combo).
6. `noteSystem`: activate notes entering the window (pool), release judged or passed notes.
7. `endSystem`: health 0 → RESULT (lose); `songTime ≥ songEnd` → RESULT (win).
Rendering uses the song time of the current frame (not the last step) so notes move smoothly.

## 7. game_spec parameters (genre sections)

| Key | Default | Unit | Effect | Safe range |
|---|---|---|---|---|
| `rules.perfectWindow` | 0.05 | s | ± Perfect | 0.03–0.08 |
| `rules.goodWindow` | 0.12 | s | ± Good (and miss limit) | 0.08–0.2 |
| `rules.perfectPoints / goodPoints` | 300 / 100 | pts | Points per judgement | – |
| `rules.multiplierSteps` | 1×, 2× at 10, 3× at 25, 4× at 50 | combo | Multiplier thresholds | – |
| `rules.healthStart` | 1 | 0..1 | Starting health | 0.2–1 |
| `rules.healthPerfect / healthGood / healthMiss` | 0.02 / 0.01 / −0.08 | 0..1 | Health changes | – |
| `rules.ghostTapHealth` | 0 | 0..1 | Penalty for presses with no note | −0.05–0 |
| `rules.audioOffset` | 0 | s | Calibration (positive = notes later) | −0.2–0.2 |
| `rules.leadIn` | 2 | s | Silence before the first step | 1–4 |
| `rules.endPadding` | 1.5 | s | After the last step | 0.5–3 |
| `rules.resumeRewind` | 2 | s | Rewind when resuming from pause | 0–4 |
| `rules.scheduleLookahead` | 0.15 | s | Audio scheduling window | 0.1–0.3 |
| `player.lanes / laneWidth` | 4 / 150 | –, u | Lanes | 3–6 / 100–170 |
| `player.hitY / spawnY` | 1080 / 120 | u | Hit line, spawn line | – |
| `player.receptorLook` | ring `player` | – | Receptors | – |
| `input.laneZoneTop` | 560 | u | Top of touch zones | 300–900 |
| `entities[kind=note]` | `tap` | – | Note look | – |
| `difficulty.travelTime` | 1.4 | s | Note preview time (scroll speed) | 0.7–2.5 |
| `difficulty.missDamageScale` | 1 → 1.5 over 60 s | × | Misses hurt more late | 0.5–3 |
| `chart.bpm / stepsPerBeat` | 120 / 2 | – | Tempo, grid | 60–200 / 1–4 |
| `chart.patterns[] / sequence[]` | 5 patterns, 16 in sequence | – | Song | – |
| `chart.backing[]` | kick, snare, hat | – | Backing loop | – |
| `chart.laneSfx[]` | 4 tones | – | Hit sounds (C E G A) | – |
| `limits.notes / popups` | 64 / 16 | – | Pools | – |
| `audio.sfx.kick / snare / hat / laneTone0-3 / miss` | recipes | – | Genre sounds | – |

## 8. Difficulty curve
- 0–6 s: lead-in + `warm` pattern (4 notes, 2 lanes): learn the keys.
- 6–24 s: `a` and `b` (8 notes per 4 s, every lane, one note at a time).
- 24–40 s: `c` with two-lane chords on every beat.
- 40–56 s: `d`, densest (off-beat notes, 0.5 s between notes of the same lane minimum).
- Misses cost 8 % health at the start, 12 % at the end (`missDamageScale` 1.5): 8–9 misses in a row lose late in
  the song; Perfect streaks refill.
- Same-lane notes are never closer than 2 steps (0.5 s) in the base chart, so the windows never overlap.

## 9. Win, lose, score
- Lose: health reaches 0. Win: the song ends with health > 0.
- Score = Σ points × multiplier. **`sendScore` = score**.
- Accuracy = (perfect + 0.5 × good) / total notes judged, shown in %.
- `save.progress`: `{ "bestAccuracy": 0..1, "bestCombo": n }`.

## 10. HUD and screens
- Top-left: score; under it the multiplier "×3" (`special`).
- Top-center: song progress bar (track `line`, fill `player`), health bar under it (fill `positive`, `hazard` under
  25 %).
- Top-right: pause.
- In play: combo count centered above the hit line (only when combo ≥ 5), judgement text ("Perfect" `positive`,
  "Good" `player`, "Miss" `hazard`) popping above the receptor of the lane.
- Title: lanes drawn, receptors pulsing on a 120 BPM beat (silent until the first gesture), hints, best score.
- Result: win/lose title, score, best, accuracy %, max combo, Perfect/Good/Miss counts, Play again / Menu.

## 11. Feedback and sound

| Event | Visual | Sound |
|---|---|---|
| Beat (every beat) | receptors pulse 1.08× | backing kick/snare/hat (scheduled) |
| Press (any) | receptor flash in `text` | – |
| Perfect | burst `positive` at receptor, judgement popup | `laneToneN` |
| Good | small burst `player`, popup | `laneToneN` |
| Miss | note fades, popup `hazard`, light shake | `miss` |
| Multiplier up | multiplier badge pops | `powerup` |
| Result | – | `win` / `lose` |

## 12. Edge cases
- Two notes of the same lane in the good window: the earliest unjudged is judged first.
- Chord (two lanes same time): each press judged independently.
- Press before the song starts (lead-in): ghost tap.
- YouTube audio disabled before PLAY: context created at gain 0 → source A still used; if creation fails → source B,
  fully playable without sound.
- Audio setting toggled mid-song: gain only, no clock change.
- Context suspended by the browser (e.g. call, tab): detected via `ctx.state` ≠ running → switch to B with
  re-anchoring, back to A when running.
- SDK pause mid-song: frozen; resume after Paused → rewind 2 s, re-anchor, backing rescheduled; no note judged twice.
- Frame hitch of 100 ms: notes are judged from the song clock and event timestamps, not frames: no false miss.
- Pattern strings with different lengths in one pattern: shorter ones padded with `.` (debug warning).
- `bpm` changed: everything derives from `stepTime`, backing follows.

## 13. Performance budget
- Max on screen ≈ `travelTime / stepTime × lanes` = 1.4 / 0.25 × 4 ≈ 23 notes; pool 64. Popups 16.
- The note list is built once per song (182 notes), no allocation during play.
- Stress test: a debug chart of `x` on every step in every lane at 200 BPM, `debug.invincible` (health never drops),
  full song on the reference device: ≥ 30 FPS and audio without crackle.

## 14. Remix hooks
- Song: `chart.bpm`, `patterns`, `sequence`, `backing`, `laneSfx` + sound recipes. "Make a faster song" = data.
- Layout: `player.lanes` (+ bindings and patterns with matching lane counts).
- Skins: `drawNote`, `drawReceptor`, `drawLane`.
- Example remix prompts: "Make it 3 lanes with arrow keys", "Add a second, harder song selectable on the title
  screen", "Make the notes look like stars and the lanes like a night sky", "Add hold notes", "Make Perfect more
  generous".

## 15. Acceptance criteria
- [ ] Keys D F J K and arrows, mouse clicks in lane zones, multi-touch taps all hit the right lane
- [ ] Notes reach the hit line exactly on their beat (visual check against the kick with `audioOffset` 0)
- [ ] Perfect/Good/Miss follow the windows (debug overlay shows the last hit error in ms)
- [ ] Combo resets on miss, multiplier follows `multiplierSteps`
- [ ] Health drains on misses (scaled late in the song), refills on hits; 0 → lose; song end → win
- [ ] With YouTube audio disabled (or no Web Audio), the game is fully playable and in sync with the visuals
- [ ] SDK pause mid-song, resume: 2 s rewind, back in sync, no double judgement
- [ ] Editing `chart.sequence` or a pattern changes the song and the notes together
- [ ] Score shown = score sent = best saved; best accuracy and combo saved

## 16. Prompt plan
- **p1** (core): lanes, chart expansion, song clock (sources A/B, re-anchoring), note movement, presses with
  timestamps, judge (Perfect/Good/Miss), score/combo/multiplier, song end. game_spec: meta, input, rules, player,
  entities, chart.
- **p2** (systems): backing scheduling with `play(name, when)`, lane tones, health and miss damage curve, pause/resume
  rewind, audio toggles and clock source switches, pools, save. game_spec: difficulty, limits, audio.
- **p3** (UI and feel): HUD, judgement popups, combo, title beat, result stats, feedback, debug overlay (hit error,
  clock source), acceptance. game_spec: text.

Note for `common/`: this genre needs two small extensions of the shared modules: `audio.play(name, when)` (optional
AudioContext time) and `input.pressTime(action)` (event timestamp of the last press). Both are backward compatible.
