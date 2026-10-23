# NN · <Archetype name>

> Spec template: same sections, same order for the 10 genres. Everything tunable is a `game_spec.json` key, written
> `like.this`. Common rules (`common/`) apply and are not repeated here.

## 1. Pitch
One sentence: what the player does and why it is fun. Reference games of the archetype (for the team only, never in
the template).

## 2. SOW coverage
Table: each minimum mechanic required by the SOW → where it is specified in this doc (section) → spec keys.

## 3. Core loop
The 5–10 second loop, then the run structure (start → escalation → end). Run length target.

## 4. Stage and camera
`display.stage` and `display.fit` (justify any override of 720 × 1280 contain), camera behaviour, world bounds, what is
visible where.

## 5. Controls
Table: action → keyboard → mouse → touch → effect. Same result whatever the input. Mention gesture thresholds used.

## 6. Entities and systems
Each entity type (player, enemies, obstacles, pickups, projectiles...) with its behaviour, its `look` (shape + color
token), and the systems in their **update order** (spawn, input/move, physics, collisions, scoring, difficulty...).
Precise rules: formulas, edge behaviour, priorities.

## 7. game_spec parameters
Table of the genre sections of `game_spec.json` (key, default, unit, what it does, safe range). The file itself is
`genres/NN/game_spec.json`.

## 8. Difficulty curve
How difficulty evolves (time, distance, wave, level), with the curve points and the intent ("first 20 s are a
tutorial", "unfair after 3 min is fine").

## 9. Win, lose, score
Win and lose conditions, score formula, the **single value sent to `sendScore`**, what goes in `save.progress`.

## 10. HUD and screens
Genre content of the shared HUD slots (top-left, top-center, bottom), title screen hint text, result details.

## 11. Feedback and sound
Which `style.feedback` effects and which `audio.sfx` (shared kit + genre sounds) fire on which event.

## 12. Edge cases
List of tricky situations and the expected behaviour (simultaneous events, tunneling, pause mid-action, resize
mid-action, empty pools, extreme spec values...).

## 13. Performance budget
Max entity counts (`limits.*`), stress-test scenario for QA.

## 14. Remix hooks
What a prompter is most likely to change and where it lives (spec keys, skins, systems). 3–5 example remix prompts
that should work without breaking anything.

## 15. Acceptance criteria
Checklist specific to the genre (the common checklist `common/10-qa-checklist.md` also applies).

## 16. Prompt plan
What goes in p1 (core loop + game_spec), p2 (systems + difficulty), p3 (UI, feedback, acceptance) for this genre.
