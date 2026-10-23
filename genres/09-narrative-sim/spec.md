# 09 · Narrative Simulation

> Same structure and level of detail as `genres/01-endless-runner/spec.md`. Common rules (`common/`) apply.

## 1. Pitch
You lead a small settlement. Each day a character brings a card with a request and two choices; each choice moves
four stats (Food, Mood, Coins, Safety). Keep every stat away from both extremes for 40 days, follow short storylines,
and discover all the endings.
Archetype references (team only): Reigns, Lapse, choice-card management games.

## 2. SOW coverage

| SOW mechanic | Where | Keys |
|---|---|---|
| Choice loop | §3, §5, §6 Choice system | `rules.twoStepChoice`, `rules.swipeThreshold`, `input.bindings.*` |
| Persistent stats | §6 Stats | `stats[]` |
| Branching events | §6 Deck, conditions, flags, `next` | `events[]`, `storylines[]`, `rules.storylineWeight` |
| Win or lose endings | §6 Endings, §9 | `endings[]`, `stats[].endingAtMin/Max`, `rules.targetTurns`, `rules.winEndingId` |
| Card and button UI | §10 | `card.*`, `characters[]` |

Genre-specific sections (allowed by `common/02-game-spec.md`): `card` (layout), `stats`, `characters`, `endings`,
`events`, `storylines`.

## 3. Core loop
Read the card (who + request, ≤ 2 lines of reading) → lean to one side to preview which stats move → confirm → stats
animate → next card. About 4–6 s per card, so a 40-day win takes 3–4 min; most first runs end between day 10 and 25 on a
stat extreme. Replay value comes from the 10 endings and the storylines.

## 4. Stage and camera
- Stage 720 × 1280, `fit: contain`. No camera, no world: a UI-driven game.
- Layout (stage units): stat bars row at y 200 (4 columns, centered, under the HUD), card centered at x 360,
  `card.y` (660), `card.width × card.height` (560 × 680); choice buttons row at y 1130 (two buttons of 300 × 100,
  left and right of center).
- Card content: avatar (`characters[].look`, `card.avatarSize`) at the top of the card, character name below it
  (heading), event text (body, wrapped to the card width − 80, max `card.textMaxLines`; if longer, font size steps
  down by 4 u until it fits, min 24 u). Wrapping is computed **once per card**, never per frame.

## 5. Controls

| Action | Keyboard | Mouse | Touch | Effect |
|---|---|---|---|---|
| `chooseLeft` | ← / A / 1 | click left button | tap left button | Lean left; if already leaning left: choose left |
| `chooseRight` | → / D / 2 | click right button | tap right button | Lean right; if already leaning right: choose right |
| `confirm` | Enter / Space | click the card | tap the card | Choose the leaned side (nothing if not leaning) |
| `drag` | – | drag the card | drag the card | Card follows dx; release beyond `swipeThreshold` chooses that side |
| `pause` | Esc / P | pause button | pause button | Pause |

- `rules.twoStepChoice` true (default): the first press only leans (and previews), the second confirms. False: the first
  press chooses. Drag-release past the threshold always chooses directly (the drag itself is the lean).
- Every input path gives the preview before committing: parity is exact.
- Input is ignored during card transitions (`rules.transitionDuration`).

### New gestures
- `cardDrag`: pointer down on the card, horizontal offset `dx` (stage units, vertical ignored). Card x = 360 + dx,
  rotation = `card.tilt × clamp(dx / swipeThreshold, −1, 1)` degrees. `|dx| > 20` shows the lean of that side.
  Release with `|dx| ≥ swipeThreshold` → choose; else the card springs back to center (0.15 s) and the lean clears.
- `leftButton` / `rightButton`: tap on the choice buttons under the card (each ≥ `style.ui.minTouch`).

## 6. Entities and systems

### Stats (`stats[]`)
- Each stat: `id`, `label`, `min`, `max`, `start`, `endingAtMin`, optional `fatalAtMax` + `endingAtMax`, `look` (icon).
  Values are floats internally, displayed rounded.
- Applying a choice: for each `effects[statId] = d`: `scaled = round(d × curve(difficulty.effectScale, turn))`,
  `value = clamp(value + scaled, min, max)`. Bars tween to the new value over `rules.statTweenDuration`.
- Fatal check after all effects: first stat (array order) with `value ≤ min` → its `endingAtMin`; else first with
  `fatalAtMax` and `value ≥ max` → its `endingAtMax`.

### Choice system (lean / confirm)
- State: `lean` = none / left / right. Leaning moves the card 40 u toward the side, rotates it `tilt / 2`, highlights
  that side's label (shown at the top corner of the card) and button, and shows the preview.
- **Preview** by `rules.previewMode`: `dots` = a dot above each affected stat bar, small if `|scaled| <
  bigChangeThreshold`, big otherwise, direction hidden; `full` = "+" or "−" signs with the same two sizes; `none` = no
  preview.
- Choosing: card flies off to that side (`transitionDuration`), effects apply, flags update, then the next card comes
  in.

### Events and the deck
- Event: `id`, `who` (character id), `text`, `left` / `right` choices, optional `if`, `minTurn`, `once`, `weight`
  (default 1; storyline events default to `rules.storylineWeight`).
- Choice: `label`, optional `effects` {statId: delta}, `setFlags` [], `clearFlags` [], `next` (event id forced as the
  next card), `ending` (ending id, ends the run after effects).
- Condition `if`: `flags` (all set), `notFlags` (none set), `stats` {statId: {min?, max?}} (inclusive).
- Deck = `events` + all `storylines[].events` (storylines only group chains for readability).
- Next card: (1) the queued `next` event if it exists and its `if` passes, else the queue is dropped; (2) otherwise a
  weighted random pick among eligible events: `if` passes, `minTurn ≤ turn`, not (`once` and already used),
  `weight > 0`, not among the last `noRepeatWindow` cards; (3) none eligible → `rules.fallbackEventId` (may have
  weight 0: then it is only a fallback).
- Flags: a set of strings for the run (max `limits.flags`), cleared at each new run, never saved.

### Systems (on each choice, in order)
1. `choiceSystem`: resolve the side.
2. `effectSystem`: scaled effects, clamp.
3. `flagSystem`: `setFlags`, then `clearFlags`.
4. `turnSystem`: `turn += 1`, push the event id in history (`limits.history`).
5. `endingSystem`: choice `ending` → that ending; else fatal stat → ending; else `turn ≥ targetTurns` →
   `winEndingId`.
6. `deckSystem`: pick the next card (if no ending).
Per frame: card drag/spring, tweens, transitions (no game logic depends on frame rate).

## 7. game_spec parameters (genre sections)

| Key | Default | Unit | Effect | Safe range |
|---|---|---|---|---|
| `rules.targetTurns` | 40 | turns | Days to win | 10–200 |
| `rules.twoStepChoice` | true | – | Lean then confirm | – |
| `rules.swipeThreshold` | 140 | u | Drag distance to choose | 80–240 |
| `rules.previewMode` | dots | – | dots / full / none | – |
| `rules.bigChangeThreshold` | 15 | pts | Small vs big dot | 5–30 |
| `rules.noRepeatWindow` | 5 | cards | Anti-repeat | 0–10 |
| `rules.storylineWeight` | 2 | – | Default weight of storyline events | 0–5 |
| `rules.fallbackEventId` | quietDay | id | Card when the deck is empty | – |
| `rules.winEndingId` | foundersDay | id | Ending at `targetTurns` | – |
| `rules.transitionDuration` | 0.25 | s | Card in/out | 0.1–0.5 |
| `rules.statTweenDuration` | 0.4 | s | Bar animation | 0.1–1 |
| `card.*` | 560 × 680 at y 660, tilt 12 | u, ° | Card layout | – |
| `stats[]` | 4 stats, 0–100, start 50 | – | See §6 | 2–5 stats |
| `characters[]` | 5 | – | `name`, `look` | – |
| `endings[]` | 8 lose + 2 win | – | `outcome`, `title`, `text` | – |
| `events[]` | 12 (incl. fallback) | – | See §6 | – |
| `storylines[]` | 3 chains, 8 events | – | See §6 | – |
| `difficulty.effectScale` | 1 → 1.4 over 40 turns | × | Bigger swings later | 0.5–2 |
| `limits.flags / history / popups` | 64 / 8 / 8 | – | Caps | – |
| `audio.sfx.cardIn / lean / statUp / statDown / ending` | recipes | – | Genre sounds | – |

## 8. Difficulty curve
- Turns 0–8: only standalone events, effects ×1: learn the stats.
- Turn 8+: bridge storyline can start; turn 12+: envoy storyline. Chains raise the stakes (bigger costs now for a later
  reward or a win ending).
- `effectScale` 1 → 1.2 at turn 20 → 1.4 at turn 40: the same request swings stats harder late in the run, so a
  balanced settlement still has to be managed.
- The winning path (40 days) is reachable by keeping stats between ~25 and ~75; the bridge offers an early win if
  Safety ≥ 30.

## 9. Win, lose, score
- Lose: a stat reaches an extreme (ending with `outcome: lose`). Win: `targetTurns` reached, or a choice leading to a
  `win` ending.
- Score = turns survived (choices made, the ending choice included). **`sendScore` = turns** (integer).
- `save.progress`: `{ "endings": [ids found] }` (unique). Best = most days.
- Ending sequence: an ending card (title + text, character avatar of the last event, `outcome` colors: `positive`
  for win, `hazard` for lose) replaces the event card, then RESULT.

## 10. HUD and screens
- Top-left: "Day 12" (`text.day` + turn, hudScore). Top-center: nothing. Top-right: pause.
- Under the HUD: 4 stat icons with vertical bars (track `line`, fill in the stat color), labels small under them.
- Bottom: the two choice buttons with the current card's labels.
- Title: game title, best days, "Endings found 3/10", hints, tap to start. Attract: a card gently sways.
- Result: ending title and text, days survived, best, "New ending!" when first found, endings found X/10, Play again
  / Menu.

## 11. Feedback and sound

| Event | Visual | Sound |
|---|---|---|
| Card arrives | slide/flip in | `cardIn` |
| Lean | card tilt, label + button highlight, preview dots | `lean` |
| Choose | card flies off | `action` |
| Stat goes up / down | bar tween, icon flash `positive` / `hazard`, small "+N/−N" popup if `previewMode` = full | `statUp` / `statDown` |
| Stat near an extreme (≤ 15 % or ≥ 85 % of range) | bar pulses | – |
| Ending | ending card | `ending`, then `win` / `lose` on Result |

## 12. Edge cases
- Pressing left then right quickly: the lean switches; no choice is made until a confirm.
- Drag released exactly at the threshold: chooses (≥).
- Two stats hit extremes on the same choice: first in `stats` order wins (deterministic).
- A choice with both `ending` and fatal effects: the explicit `ending` wins.
- `next` points to a missing id or an event whose `if` fails: ignored, normal pick (debug warning).
- Deck exhausted (all `once` used, all conditions false): fallback event; if the fallback id is missing too, the
  first event of the list.
- Event text too long: font steps down; still too long at 24 u: cut with "…" (debug warning).
- Pause during a card transition: transition frozen, completes on resume.
- Resize: layout is in stage units, text wrap stays valid (contain mode).
- `stats` reduced to 2 or extended to 5: bars layout adapts to the count.

## 13. Performance budget
- Trivial: one card, 4 bars, ≤ 8 popups. Text wrap and card rendering are cached in an offscreen canvas per card.
- Stress test: `debug.timeScale` 4 with an autoplay debug option (random choice every 0.3 s) for 500 turns: no
  error, no memory growth, deck never stuck.

## 14. Remix hooks
- Content is all data: `events`, `storylines`, `endings`, `characters`, `stats`. "Make it a space station" = new
  texts + labels, no code change.
- Rules: `targetTurns`, `previewMode`, `twoStepChoice`.
- Skins: `drawAvatar` (from `look`), `drawCard`, `drawStatIcon`.
- Example remix prompts: "Make it about running a pizza place", "Add a fifth stat: Energy", "Add a storyline about a
  dragon egg with a secret ending", "Show exact numbers in the preview", "Make each run 20 days".

## 15. Acceptance criteria
- [ ] Lean + confirm works with arrows/A/D/1/2 + Enter, with button taps/clicks (twice), and drag-release past the
      threshold; drag below the threshold springs back
- [ ] Preview shows the right stats with small/big dots, never the direction (`dots` mode)
- [ ] Effects scaled by `effectScale`, clamped, bars tween
- [ ] Each stat extreme triggers its ending; `fatalAtMax` false disables the max ending
- [ ] Mill, bridge and envoy storylines progress through flags and `next`; bridge "Everyone" gives the win ending
- [ ] 40 days → Founder's Day win
- [ ] Never the same card within `noRepeatWindow`; deck never stuck (500-turn autoplay)
- [ ] Endings found are saved and shown as X/10; "New ending!" only the first time
- [ ] Score = days = value sent = best saved

## 16. Prompt plan
- **p1** (core): card, lean/confirm with every input, stats with bars, effects and clamping, fatal endings (placeholder
  ending screen), turn counter, target turns. game_spec: meta, input, rules, card, stats.
- **p2** (systems): characters, the event format, deck selection (conditions, flags, once, weight, minTurn,
  anti-repeat, fallback, `next`), difficulty curve, limits. game_spec: characters, events, difficulty, limits.
- **p3** (UI and feel): endings and ending card, HUD, title, result with endings found, save, feedback and sounds,
  debug autoplay, acceptance. game_spec: text, endings, audio.
- **p4** (content): storylines and a content check of every chain. game_spec: storylines.
