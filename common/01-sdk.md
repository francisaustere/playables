# 01 · YouTube Playables SDK

Source: https://developers.google.com/youtube/gaming/playables/reference/sdk (read 23/10/2026).
How PB embeds the SDK is still to be confirmed at kickoff; these rules describe the target behaviour.

## Loading

```html
<script src="https://www.youtube.com/game_api/v1"></script>   <!-- first script of index.html, before any game code -->
```

Outside the Playables environment (local, PB preview?) the SDK is a no-op or absent. The game wraps every call in a
small `Platform` module so it **always runs**, with or without `ytgame`:

```js
const hasSdk = typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV;
```

If `hasSdk` is false, each method falls back to a stub (no-op, `loadData` resolves `""`, `isAudioEnabled` returns
`true`, `getLanguage` resolves `"en"`). Every promise call has a `.catch()`.

## Lifecycle calls (mandatory, in this order)

| Call | When | Rule |
|---|---|---|
| `ytgame.game.firstFrameReady()` | Right after the **first frame is drawn** (Boot screen) | Once. Required before `gameReady`. |
| `ytgame.game.gameReady()` | When the **Title screen accepts input** | Once per session. Never during a loading screen. |

## Score

- `ytgame.engagement.sendScore({ value })`: `value` is an **integer** (`Math.floor`, clamped to
  `Number.MAX_SAFE_INTEGER`).
- Each genre defines **one** score dimension (spec section "Score"). It is sent at the end of every run (Result state).
- YouTube shows the player's best score, so the in-game "Best" must be computed with the same value.

## Save

- `ytgame.game.loadData()` at boot (with a 1.5 s timeout fallback to an empty save), `saveData(string)` on Result and
  on `onPause`.
- Save format (JSON string, versioned, tolerant parser: unknown or broken data = fresh save):
  ```json
  { "v": 1, "best": 0, "runs": 0, "progress": {} }
  ```
  `progress` is genre-specific (e.g. Clicker upgrades, Narrative unlocked endings). Keep it under 50 KB.
- Check `String.prototype.isWellFormed` when available before saving.

## Pause and resume

- `ytgame.system.onPause(cb)`: enter **Paused** immediately: stop the simulation, timers, input, audio
  (`AudioContext.suspend()`), then save. Do **not** use the Page Visibility API.
- `ytgame.system.onResume(cb)`: return to the Paused screen (the player resumes with a tap/key), never straight into
  action. Resume is not guaranteed.

## Audio

- Initial state: `ytgame.system.isAudioEnabled()`.
- `ytgame.system.onAudioEnabledChange(enabled => ...)` updates a master gain (0 or `audio.masterVolume`).
- No in-game mute button.

## Language

- `ytgame.system.getLanguage()` → BCP-47. Templates ship English only: all strings live in `game_spec.text`. The value
  is read and stored in `Platform.language` so a remixer can add translations later.

## Health

- `window.onerror` and `unhandledrejection` → `ytgame.health.logError()` (best effort) and keep the game alive.

## Not used

- `ads.*`, `engagement.openYTContent`: not used by the templates.
