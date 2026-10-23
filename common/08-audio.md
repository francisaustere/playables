# 08 · Audio (synthesized, no files)

- One `Audio` module on the Web Audio API. A single `AudioContext`, created or resumed on the first user gesture
  (browsers block it before). Master `GainNode` = `audio.masterVolume` when YouTube audio is enabled, 0 otherwise
  (`01-sdk.md`).
- Sounds are **recipes** in `game_spec.audio.sfx`, played with short oscillators + gain envelopes. No audio file.
  Recipe: `{ "wave": "sine|square|triangle|sawtooth|noise", "freq": 440, "freqEnd": 880, "duration": 0.1,
  "volume": 0.5 }` (`freqEnd` optional = pitch slide, `noise` uses a pre-generated 1 s noise buffer).
- Max `audio.maxVoices` (8) sounds at once; extra plays are dropped. Same sound retriggered within 0.03 s is dropped.
- `AudioContext.suspend()` in PAUSED, `resume()` when leaving it.

## Shared sound kit (same names in every game)

| Name | Use | Default recipe |
|---|---|---|
| `uiTap` | Any button / menu confirm | square 660 Hz, 0.05 s, 0.25 |
| `start` | PLAY starts | triangle 440→880 Hz, 0.15 s |
| `collect` | Pickup / point | sine 880→1320 Hz, 0.08 s |
| `hit` | Damage taken / obstacle hit | noise, 0.12 s, 0.5 |
| `destroy` | Enemy / block destroyed | square 220→110 Hz, 0.1 s |
| `action` | Main verb (jump, shoot, tap, launch) | triangle 520→700 Hz, 0.06 s |
| `powerup` | Power-up / upgrade | sine 523→1046 Hz, 0.25 s |
| `win` | Win result | triangle 523→1046 Hz, 0.4 s |
| `lose` | Lose result | sawtooth 330→110 Hz, 0.5 s, 0.35 |

Genres add their own sounds in `audio.sfx` with new names (e.g. `perfect`, `combo`, `waveStart`). Music Tap is the
only genre with a music track; it is synthesized from its `chart` (see its spec).
