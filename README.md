# 2026-playables-builder-templates

Specs and prompts for the 10 "skeleton" templates makemepulse builds for the YouTube **Playables Builder** (PB) gallery.
Confidential: client YouTube, work made for hire.

Each template ships **100% of the mechanics and 0% art direction** (geometric primitives only), with every parameter
exposed in `game_spec.json`, so that anyone can remix it with a prompt.

## How it works

PB builds games from prompts, so **the prompts are our source code**. The repo holds everything that produces them:

```
ROADMAP.md              Process and roadmap (FR), open questions
beta/                   Beta-test protocol: Claude Code builds each game from the prompts only
common/                 Rules shared by all 10 games (SDK, game_spec, input, perf, layout, states, style, audio, remix, QA)
common/game_spec.base.json   Base sections every game_spec.json starts from
genres/_TEMPLATE.md     The spec template (identical structure for the 10 genres)
genres/NN-name/         spec.md (game design) + game_spec.json (genre sections, merged with the base at build time)
prompts/_shared/        remix-preamble.md (plan A), common-block.md (plan B), fix-template.md
prompts/00-template-zero/   Prompts that build "Template 0", the remixable foundation (plan A)
prompts/NN-name/        p1.md (core loop + game_spec), p2.md (systems + difficulty), p3.md (UI, feedback, acceptance)
scripts/build.mjs       Assembles dist/, checks the character limit, validates JSON
config.json             Character limit and build options
```

## Plan A / plan B

- **Plan A (preferred)**: build `Template 0` once in PB, then remix it for each genre. Genre prompt 1 starts with a short
  remix preamble.
- **Plan B (fallback, if PB can't remix our own template)**: genre prompt 1 starts with the compressed common block
  (~1,500 characters) and builds from scratch.

`npm run build` generates both: `dist/planA/` and `dist/planB/`, one `.txt` per prompt, ready to paste into PB.

## Placeholders in prompt sources

| Placeholder | Plan A | Plan B |
|---|---|---|
| `{{BASE}}` | `prompts/_shared/remix-preamble.md` | `prompts/_shared/common-block.md` |
| `{{GAME_SPEC}}` | Minified genre sections of `genres/NN/game_spec.json` | same |
| `{{include:path}}` | Inlines any file of the repo | same |

HTML comments (`<!-- ... -->`) are authoring notes and are stripped. Characters are counted as Unicode code points.

## Commands

```
npm run build        # assemble dist/, fail if a prompt exceeds config.charLimit
npm run report       # same + print a size table
```

## Workflow (one genre)

1. Read `genres/NN/spec.md`.
2. In PB: remix Template 0 (plan A) or start blank (plan B), paste `dist/planX/NN/p1.txt`, wait, test.
3. Paste p2, then p3. Test against the acceptance checklist of the spec + `common/10-qa-checklist.md`.
4. Fix with `prompts/_shared/fix-template.md` (one issue per prompt). Log every iteration in `genres/NN/log.md`.

## Open points (to check at the 26/10 kickoff)

- Real prompt character limit in PB (we target 5,500, see `config.json`).
- Can PB remix one of our own templates? (plan A vs plan B)
- YouTube's official game_spec schema: our conventions (`common/02-game-spec.md`) will be mapped onto it.
- How PB embeds the SDK and which stack it generates.
