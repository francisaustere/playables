# Fix prompt template

One issue per prompt. Describe what is observed, what is expected, and what must not change. Log it in
`genres/NN/log.md` with the PB result.

```
FIX: <short title>
Observed: <what happens, when, on which input/device/ratio>
Expected: <what should happen, with the game_spec keys involved>
Keep unchanged: everything else, in particular <module or behaviour at risk>.
Constraints reminder: values in game_spec.json only, no allocation in the loop, same behaviour on keyboard and touch.
After the fix, re-check: <1-3 acceptance criteria from the spec>.
```

## Frequent fixes (ready to paste)

- **Hard-coded values**: `FIX: hard-coded values. Find every gameplay number, color, string, sound or timing that is
  not read from game_spec.json and move it there with the same value, under the right section and a clear camelCase
  name. List what you moved.`
- **Input parity**: `FIX: input parity. Action <X> works with <keys> but not with touch (or the reverse). Bind it in
  input.bindings for both and route gameplay through input actions only.`
- **Aspect ratio**: `FIX: layout at <ratio>. <element> is cropped/stretched/offset. Use the viewport stage transform
  and anchor HUD to visible screen edges + safeMargin.`
- **Performance**: `FIX: frame drops at <moment>. Remove allocations in the loop (objects, arrays, closures, string
  building), pool <entities>, pre-render static backgrounds, cap with limits.*.`
- **SDK**: `FIX: SDK lifecycle. firstFrameReady must be called once after the first drawn frame, gameReady once on the
  first interactive Title frame, sendScore with an integer on each Result.`
