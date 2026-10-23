# 06 · Shared state machine

Same states, same screens, same transitions for the 10 templates. One `Game` object owns the current state; each
state has `enter()`, `update(dt)`, `render()`, `exit()`.

```
BOOT ──first frame drawn──▶ (firstFrameReady) ──save + language loaded──▶ TITLE (gameReady, once)
TITLE ──confirm / tap──▶ PLAY
PLAY ──pause button / Esc / P / SDK onPause──▶ PAUSED ──confirm / tap "Resume"──▶ PLAY
PAUSED ──"Quit" button / Esc──▶ TITLE
PLAY ──win or lose condition──▶ RESULT (sendScore, saveData)
RESULT ──confirm / tap "Play again"──▶ PLAY (fresh run)      RESULT ──"Menu" / Esc──▶ TITLE
```

Genres with levels may add `LEVEL_CLEAR` between PLAY and the next PLAY (short screen, next level on confirm); it
follows the same rules as RESULT without sending the score.

## Screens

| State | Content (strings from `game_spec.text`) |
|---|---|
| BOOT | Background color only + small loading indicator; lasts as long as `loadData` + `getLanguage` (max 1.5 s). |
| TITLE | Game title, best score (`text.best`), controls hint (keyboard + touch), "Tap or press Space to start". Gameplay preview allowed (attract mode) if cheap. |
| PLAY | Game + HUD (`05-layout.md`). |
| PAUSED | Game frozen and dimmed (`style.ui.dimAlpha`), "Paused", buttons Resume / Quit. |
| RESULT | Outcome title (`text.win` / `text.lose`), score, best (with "New best!" when beaten), buttons Play again / Menu. Input ignored for `rules.resultInputDelay` (0.6 s) to avoid accidental restarts. |

## Rules

- `firstFrameReady()` after the first BOOT frame is drawn; `gameReady()` on the first TITLE frame that accepts input.
- `PLAY.enter()` fully resets the run from the spec (no leftovers from the previous run).
- Entering PAUSED from the SDK: suspend audio, save, release inputs. Leaving PAUSED: 3-2-1 countdown is **not** used
  (keep it simple); the game resumes on the player's input.
- Transitions are instant or a fade of `style.feedback.fadeDuration` (0.2 s). No transition blocks input longer than
  0.3 s except the RESULT delay.
