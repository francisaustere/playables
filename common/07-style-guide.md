# 07 · Mini style guide (neutral, shared by the 10 templates)

Goal: **no art direction, but one family.** Flat geometric shapes, a dark neutral background, colors that carry a
*role* rather than a theme. A remixer replaces looks, never logic.

## Palette (tokens in `style.palette`)

| Token | Hex | Role |
|---|---|---|
| `bg` | `#121318` | Background, letterbox |
| `surface` | `#1E2028` | Panels, buttons, walls, board cells |
| `line` | `#343846` | Grid lines, lanes, outlines, disabled |
| `text` | `#F4F5F7` | Main text, icons |
| `textMuted` | `#9BA1AE` | Secondary text, hints |
| `player` | `#4CC9F0` | The player and everything the player controls (paddle, towers, cursor) |
| `hazard` | `#F25F5C` | Enemies, obstacles, damage, "lose" |
| `pickup` | `#FFD166` | Coins, collectibles, rewards, score popups |
| `positive` | `#06D6A0` | Goals, success, healing, "Perfect", "win" |
| `special` | `#B388FF` | Power-ups, multipliers, rare items |
| `neutral` | `#7D8597` | Neutral objects (blocks, platforms, props) |

Rules: max 4 role colors on screen at once besides bg/surface/line/text; `hazard` is only used for things that hurt
or for failure; `player` only for what the player controls. No gradients, no shadows, no textures.

## Shapes (shape language)

| Role | Default shape |
|---|---|
| Player | circle or rounded square |
| Hazard | triangle (pointing toward danger), or square for blocks that hurt |
| Pickup | small diamond or circle |
| Power-up / special | hexagon |
| Goal / base | ring or rounded rectangle outline |
| Walls / platforms | rectangle in `surface` with `line` outline |
| Projectiles | small circle (player: `player`, enemy: `hazard`) |

Outline (`style.stroke` = 4 u) only for UI and walls; entities are flat fills. Corner radius `style.radius` = 16 u
(buttons 24 u).

## Typography

- System font stack only: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (no web font: no network).
- Sizes in stage units: title 88, heading 56, HUD score 56, HUD secondary 32, body 32, button 40, hint 28.
- Weights: 800 for titles and score, 600 for the rest. Numbers use `font-variant-numeric: tabular-nums` when
  supported.

## UI components

- **Button**: rounded rect (radius 24), fill `surface`, outline `line`, text `text`; min 88 u high, min 240 u wide;
  pressed state = fill `line`. Primary button: outline `player`.
- **Panel**: `surface` at 92% opacity, radius 24, padding 32.
- **Pause icon**: two vertical bars, 88 u target, top-right.
- **Bars** (health, progress): track `line`, fill by role (`player`, `hazard`, `positive`), height 16 u, radius 8.

## Feedback ("juice", all tunable in `style.feedback`, all optional)

- Hit flash: entity drawn in `text` color for 0.08 s.
- Score popup: "+N" rises 60 u and fades in 0.6 s, color `pickup`.
- Screen shake: amplitude 8 u, 0.15 s, on damage only; `shakeEnabled` flag.
- Squash on landing / bounce: scale 1.15 × 0.85 for 0.1 s.
- Particles: up to 8 small squares per burst, 0.4 s life, color of the source.
- Fades between states: 0.2 s.
