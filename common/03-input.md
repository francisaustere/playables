# 03 · Input parity (keyboard/mouse = touch)

Every action reachable with a keyboard/mouse must be reachable by touch, with the same result, and the reverse.

## Architecture

- One `Input` module turns raw events into **actions** (`left`, `right`, `jump`, `fire`, `aim`, `confirm`, `pause`...).
  Gameplay code reads actions only, never raw keys or pointers.
- Bindings live in `game_spec.input.bindings`: `{ "jump": { "keys": ["Space", "ArrowUp", "KeyW"], "pointer": ["swipeUp", "tap"] } }`.
  Keys use `KeyboardEvent.code`; `pointer` is one gesture name or an array of them.
- Action state per frame: `isDown(a)`, `wasPressed(a)` (this step), `wasReleased(a)`; analog values for
  `move` / `aim` as normalized vectors (-1..1).
- Use **Pointer Events** only (`pointerdown/move/up/cancel`), which cover mouse, touch and pen. Capture the pointer on
  down. Track multiple pointers by `pointerId` when the genre needs two zones (e.g. twin-stick).

## Pointer gestures (shared vocabulary)

| Gesture | Definition (thresholds in `input.gestures`, stage units / seconds) |
|---|---|
| `tap` | down + up within `tapMaxDuration` (0.25 s) and `tapMaxMove` (24 u) |
| `hold` | down longer than `tapMaxDuration` |
| `swipeLeft/Right/Up/Down` | move ≥ `swipeMinDistance` (60 u) within `swipeMaxDuration` (0.35 s); fires once, on threshold |
| `drag` | down + move, continuous position |
| `zoneLeft / zoneRight` | tap or hold in the left / right half of the stage |
| `joystick` | floating stick: origin at pointer down, vector = offset / `joystickRadius` (90 u), clamped to 1 |
| `pointerAim` | vector from a reference point to the pointer position |

## Rules

- Canvas has `touch-action: none`; prevent default on pointer and game keys (Space, arrows) to stop scroll and zoom.
  No double-tap zoom, no long-press context menu (`contextmenu` prevented), no text selection.
- **No hover-only interaction**, no right-click, no mouse wheel required.
- Touch targets ≥ `style.ui.minTouch` (88 u ≈ 44 dp on a phone).
- Any UI button is also reachable with keys: `confirm` = Enter / Space, `pause` = Escape / P, `back` = Escape on
  Result. Title and Result screens: any key or tap starts / restarts (except on a button).
- Keyboard input buffer: a press is remembered for `input.bufferTime` (0.1 s) so early jumps still register.
- On pause or blur: release all actions (no stuck keys).
- The **controls hint** on the Title screen shows the key and touch version of each action
  (`text.controlsKeyboard`, `text.controlsTouch`), choosing the line to highlight from the last input used.
