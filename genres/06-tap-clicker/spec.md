# 06 · Tap & Choose (Clicker / Trivia)

> Follows the Endless Runner reference spec. Common rules (`common/`) apply.

## 1. Pitch
Tap the core to earn coins, buy upgrades that boost taps and passive income, and pick one of two options when a choice
card pops up (a gamble, a boost, a quiz). Reach the coin goal before the timer runs out.
Archetype references (team only): Cookie Clicker, Adventure Capitalist, Reigns-style binary choices, trivia cards.

## 2. SOW coverage

| SOW mechanic | Where | Keys |
|---|---|---|
| Tap on a main element | §6 Core | `entities[kind=core]`, `economy.tapValue` |
| Floating +1 | §6 Core, §11 | `entities[core].popupSpread`, `style.feedback.popup*` |
| Passive income | §6 Economy | `economy.upgrades[].effect.perSecond` |
| Multiplier upgrades | §6 Upgrades | `economy.upgrades[]` (`costGrowth`, `effect.multiply`) |
| Win condition | §9 | `rules.targetCoins`, `rules.timeLimit` |
| "Choose" part of the archetype (choices, trivia) | §6 Choice cards | `levels.choices[]`, `difficulty.choiceInterval`, `rules.choiceTimeout` |

## 3. Core loop
Tap, tap, tap → "+N" pops → enough coins → buy an upgrade (tap stronger, or passive income) → numbers grow faster.
Every 20–30 s a choice card interrupts with a trade-off. The run lasts until the bank reaches `targetCoins` (win,
~3 min for a good player) or `timeLimit` ends (lose). Spending is the tension: every purchase delays the goal but speeds
up income.

## 4. Stage and camera
- Stage 720 × 1280, `fit: contain`, no camera.
- Core: circle at (`x`, `y`) = (360, 560), size 260.
- Upgrade bar: 4 buttons in a 2 × 2 grid at the bottom (y 900–1180), each 320 × 120 u, 16 u gap, centered.
- Choice card: panel 640 × 420 centered at y 760, sliding up from below the stage in 0.2 s, over the upgrade bar.
- Background: plain `bg`, a faint `line` ring around the core (pre-rendered).

## 5. Controls

| Action | Keyboard | Mouse | Touch | Effect |
|---|---|---|---|---|
| `tap` | Space (each keydown, **auto-repeat ignored**) | click on the core | tap on the core (multi-touch: each finger counts) | Earn tap value |
| `buy1..4` | 1–4 (or numpad) | click the upgrade button | tap the upgrade button | Buy one level if affordable |
| `choose1/2` | 1 / 2, or ← / → (only while a card is open) | click an option | tap an option | Pick that option |
| `pause` | Esc / P | pause button | pause button | Pause |

While a choice card is open, keys 1/2 choose (they don't buy) and the upgrade bar is dimmed and disabled for every
input (parity). Number keys reach every button directly, so no focus navigation is needed; each button shows its key
label ("1"…"4") once the keyboard has been used.

**New gestures**: `tapCore` = a pointer-down inside the core's circle (counts at pointer-down for responsiveness, one
per pointer); `upgradeButton` / `choiceButton` = standard UI button taps (pointer-up inside the button). Taps are capped
at `rules.maxTapsPerSecond` across all inputs (extra taps are ignored silently).

## 6. Entities and systems

### Economy model
- `bank` (float, coins available), `totalEarned` (float, everything earned in the run, never decreases).
- `tapValue = (economy.tapValue + Σ strongTap.levels × tapAdd) × multiplier × boost(tap)`.
- `perSecond = Σ (level × effect.perSecond) × multiplier × boost(passive)`.
- `multiplier = Π effect.multiply ^ level` over multiplier upgrades. `boost(target)` = product of active boosts with
  that target or `all`.
- Each fixed step: `gain = perSecond × dt`, added to `bank` and `totalEarned`. Display uses floor and the short format
  (`1.2K`, `3.4M`, suffixes from `text.suffixes`, 1 decimal under 100 of a unit, none above).

### Core
- Entity `kind: core`. On `tap`: `bank += tapValue`, `totalEarned += tapValue`, squash (`tapSquash`), `tap` sound,
  "+N" popup at the pointer position (keyboard: core center) with random x offset ±`popupSpread`.
- Every `rules.passivePopupInterval` s with `perSecond` > 0: a smaller muted "+N" popup at the core's edge (income of
  the last interval).

### Upgrades
- `economy.upgrades[]` (data): `name`, `baseCost`, `costGrowth`, `maxLevel`, `effect` (`tapAdd`, `perSecond` or
  `multiply`), `look` (icon).
- `cost(level) = floor(baseCost × costGrowth ^ level × discount)`, `discount` = product of active discounts (default 1).
- Buy: if `bank ≥ cost` and `level < maxLevel`: `bank −= cost`, `level += 1`, `buy` sound + burst on the button.
  Else `denied` sound + button shake. At max level the button shows `text.max` and is disabled.
- Button content: icon, name, `text.level` + level, cost (`pickup` color when affordable, `textMuted` otherwise),
  effect hint ("+2/s", "x2").

### Choice cards (the "Choose" part)
- A timer counts down from `curve(difficulty.choiceInterval, runTime)`; at 0 a card opens with a random entry of
  `levels.choices` (never the same as the previous one): `prompt` + 2 `options` (`label`, `effects[]`).
- The card stays `rules.choiceTimeout` s (a shrinking bar shows it); timeout = no effect, card closes. The economy keeps
  running while it's open (taps on the core still count).
- Effect vocabulary (applied in order):
  - `addCoinsRatio` `value`: `bank += bank × value` (counts in `totalEarned` if positive).
  - `addIncomeSeconds` `value`: `bank += perSecond × value` (if `perSecond` is 0, uses `tapValue × 5 × value / 10`).
  - `gamble` `chance`, `winRatio`, `loseRatio`: with probability `chance` `bank += bank × winRatio`, else
    `bank += bank × loseRatio` (loss never goes below 0; a negative change does not reduce `totalEarned`).
  - `boost` `target` (tap / passive / all), `multiply`, `duration`: timed multiplier (max `limits.boosts` active;
    the oldest is replaced).
  - `discount` `value`, `duration`: upgrade costs × value while active.
- Trivia is just content: an option with a reward and one with a penalty (example `quizShape`).
- After a choice: result line on the card for 0.8 s ("+1.2K coins", "Taps x5 for 15 s", "Lost 600"), then close.

### Systems (order, every fixed step)
1. `inputSystem` (taps, buys, choices, rate cap). 2. `economySystem` (passive gain, boost and discount timers).
3. `choiceSystem` (interval timer, timeout). 4. `goalSystem` (win / time). 5. `fxSystem` (popups, squash, particles).

## 7. game_spec parameters (genre sections)

| Key | Default | Unit | Effect | Safe range |
|---|---|---|---|---|
| `rules.targetCoins` | 100000 | coins | Bank to reach to win | 1000–1e12 |
| `rules.timeLimit` | 240 | s | Run duration (0 = no limit, no lose) | 0–1800 |
| `rules.timeBonusPerSecond` | 500 | pts/s | Score per second left on win | 0–1e6 |
| `rules.maxTapsPerSecond` | 20 | taps/s | Anti auto-clicker cap | 8–30 |
| `rules.passivePopupInterval` | 1 | s | Passive "+N" frequency (0 = off) | 0–5 |
| `rules.choiceTimeout` | 8 | s | Card lifetime | 3–20 |
| `economy.startCoins` | 0 | coins | Bank at start | – |
| `economy.tapValue` | 1 | coins | Base tap | 1–100 |
| `economy.upgrades[]` | 4 upgrades | – | `baseCost`, `costGrowth`, `maxLevel`, `effect`, `look` | costGrowth 1.05–5 |
| `entities[core]` | circle 260 at 360, 560 | u | `x`, `y`, `tapSquash`, `popupSpread`, `look` | – |
| `levels.choices[]` | 4 cards | – | `prompt`, `options[2]` with `label` + `effects[]` | – |
| `difficulty.choiceInterval` | 30 → 20 over 180 s | s | Time between cards | ≥ 10 |
| `limits.popups / particles / boosts` | 32 / 64 / 4 | – | Pools | – |
| `audio.sfx.tap / buy / denied / choice / boostEnd` | recipes | – | Genre sounds | – |

## 8. Difficulty curve
- 0–20 s: only Strong tap is affordable: teaches tapping and buying.
- 20–60 s: Helper becomes the efficient choice: passive income starts. First choice card at 30 s.
- 60–150 s: Factory and the first Booster: exponential phase.
- 150–240 s: reaching 100K depends on choices (gambles, boosts) and upgrade timing.
Tuning levers: `targetCoins`, `costGrowth`, effects; the curve is economic, not time-scripted.

## 9. Win, lose, score
- Win: `bank ≥ targetCoins` (checked every step). Lose: `timeLimit` > 0 and time runs out.
- **Score (one dimension, coins)**: `floor(totalEarned) + (win ? floor(timeLeft) × timeBonusPerSecond : 0)`.
  Rationale: everyone scores (losers by progress), higher is always better, and winning faster adds coins on top, so
  the best scores come from fast wins. **`sendScore` = this value.**
- `save.progress`: `{ "bestTime": s (fastest win, 0 if none), "wins": n }`.

## 10. HUD and screens
- Top-left: bank (large, short format) and "+N/s" below.
- Top-center: `text.goal` progress bar (bank / targetCoins) and the timer (mm:ss, `hazard` under 30 s).
- Top-right: pause. Bottom: upgrade bar (2 × 2).
- Choice card: `text.choiceTitle`, prompt, two option buttons (key labels "1" / "2"), timeout bar.
- Title: the core pulsing slowly, best score, fastest win.
- Result: score, best, time, coins earned, upgrades bought.

## 11. Feedback and sound

| Event | Visual | Sound |
|---|---|---|
| Tap | core squash, "+N" popup | `tap` |
| Passive tick | small muted popup | – |
| Buy | burst on the button, level number pops | `buy` |
| Can't afford / max | button shake | `denied` |
| Card opens | slide up | `choice` |
| Option chosen | result line, burst `special` (reward) or flash `hazard` (loss) | `powerup` / `hit` |
| Boost active | ring around the core in `special`, pulse; boost icon + timer under the bank | – |
| Boost ends | ring fades | `boostEnd` |
| Win / time's up | – | `win` / `lose` |

## 12. Edge cases
- Keyboard auto-repeat (holding Space): ignored, only real keydowns count.
- Multi-touch: each finger down on the core is a tap, all subject to `maxTapsPerSecond`.
- Buying during a card: impossible (bar disabled) for all inputs.
- Card opening while a buy button is pressed: the press is cancelled.
- Gamble with bank 0: no effect, result line still shown.
- Discount and cost display: costs update live when a discount starts or ends.
- Very large numbers: floats are fine up to 1e15; display switches suffix; `sendScore` clamps to
  `Number.MAX_SAFE_INTEGER`.
- `timeLimit` 0: no timer in the HUD, no lose, no time bonus.
- Pause: economy, boosts, card timer and run timer all frozen (game time).
- Popup pool empty during fast tapping: skip the popup, the coins still count.

## 13. Performance budget
- Very light: ≤ 32 popups, ≤ 64 particles. HUD numbers re-rendered only when the displayed (formatted) string changes.
- Stress test: 4 fingers tapping (≈ 20 taps/s, the cap) on the reference device for 3 min with a tap boost and a
  passive boost active; FPS ≥ 30, popups recycled without growth in memory.

## 14. Remix hooks
- Theme: core skin, upgrade icons, currency name (`text.currency`): "Make it a cookie bakery".
- Economy: upgrades list, costs, effects; target and time.
- Content: choice cards are pure data: "Add 10 trivia questions about space" = new `levels.choices` entries.
- Example remix prompts that must work: "Make it about planting trees", "Add a 5th upgrade that doubles taps",
  "Turn the choice cards into a music quiz", "Remove the timer", "Make the goal 1 million".

## 15. Acceptance criteria
- [ ] Tap by Space, click, touch (multi-touch counts), capped at `maxTapsPerSecond`; auto-repeat ignored
- [ ] "+N" popups on every tap, passive popups every second when income > 0
- [ ] 4 upgrades buyable by keys 1–4, click, tap; costs follow `baseCost × costGrowth ^ level`; max level handled
- [ ] Income, tap value and multipliers follow the formulas (debug overlay shows them)
- [ ] Choice cards every `choiceInterval`, chosen by 1/2, ←/→, click or tap; timeout closes; bar disabled while open
- [ ] All 5 effect types work, including gamble loss floor and boost replacement
- [ ] Win at `targetCoins`, lose at time up; `timeLimit` 0 works
- [ ] Score formula as §9; shown = sent = best saved; bestTime and wins saved
- [ ] Adding a choice or an upgrade in the spec shows up without code changes

## 16. Prompt plan
- **p1** (core): core tap with all inputs and rate cap, popups, economy model, 4 upgrades with costs and effects, upgrade
  bar, win/lose and score. game_spec: meta, input, rules, economy, entities.
- **p2** (systems): choice cards (interval, timeout, effect vocabulary, input modes), boosts and discounts, passive
  popups, number formatting, save progress. game_spec: levels, difficulty, limits, audio.
- **p3** (UI and feel): HUD, card UI, Title and Result, feedback and sounds, debug overlay, acceptance checklist.
  game_spec: text.
