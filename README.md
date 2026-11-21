# makefun-csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/zakkyDX/makefun-csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/zakkyDX/makefun-csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0 that returns exactly its answer for every input. `solve.js` implements csv-reader 1.0.0's broken-row policy exactly — BOM dropping, stray CRs, quoted fields with doubled quotes, quote junk, unterminated quotes read again as unquoted, short/long row padding and cutting, and `{code, line, row}` errors in the order met — but reads slice by slice, jumping between the only characters that can change the reading (`,` `"` CR LF) instead of one character at a time, with a fast path that splits a plain line on commas. It is pure: no clock, no randomness, nothing kept between calls.

## Run it

```sh
node main.ts
```

The harness runs `node /bot/main.ts` (Node 22). It reads every case from `/input/cases.json` (a JSON array of `{id, input}`), answers each one alone with `run()` from `solve.js`, and writes `/output/answers.json`. Outside a container, `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` stand in for `/input` and `/output`.

## License

MIT — see `LICENSE`.

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards
