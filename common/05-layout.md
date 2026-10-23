# 05 · Layout, aspect ratios and safe areas

Playables must work in every aspect ratio: **9:32, 9:21, 9:16, 3:4, 1:1, 4:3, 16:9, 21:9, 32:9**.
Letterbox / pillarbox is acceptable. Orientation is never locked.

## Stage

- Every game is designed on a **logical stage** in stage units: `display.stage` = **720 × 1280** (portrait, 9:16) by
  default. A genre may override it (e.g. 1280 × 720 for a landscape-native game) and must justify it in its spec.
- The canvas fills the window (`100vw × 100dvh`, no scrollbars). The stage is scaled uniformly:
  - `fit: "contain"` (default): the whole stage is visible, centered; the extra space is filled with
    `style.palette.bg`. Gameplay never happens outside the stage.
  - `fit: "expand"`: the short side of the stage is preserved and the visible world extends on the long side
    (used by camera-based games: Arena, optionally Runner). Gameplay rules must stay fair: spawns happen relative to
    the visible area, never inside it.
- One `Viewport` module owns the transform (scale, offset) and converts pointer coordinates screen → stage. It
  recomputes on `resize` and `orientationchange` (debounced 100 ms) and redraws immediately, also in Paused.

## HUD and safe areas

- HUD elements are anchored to the **visible screen edges** (not to the stage) with a margin of
  `display.safeMargin` (24 u) plus `env(safe-area-inset-*)`, so they don't float in the middle of the letterbox on
  wide screens.
- Fixed HUD layout for the 10 games:
  - top-left: score (big) and a secondary stat (small) under it;
  - top-center: timer / progress / wave (when the genre has one);
  - top-right: pause button (88 u target);
  - bottom: genre controls (touch buttons, upgrade bar...) only when the genre needs them.
- Text never smaller than 28 u. Nothing important closer than 24 u to an edge.

## Checks (QA)

Resize the browser through the 9 ratios (DevTools device toolbar or the window): no cropped HUD, no stretched shape,
no input offset, the game keeps running or stays paused as it was.
