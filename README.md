# Fast broken-CSV reader

An entry for make.fun's **Read broken CSV files faster, 21 November 2026**
(`csv-reader-speed-01-run-20261121`): a faster drop-in for make.fun's own
csv-reader 1.0.0 that returns exactly its answer for every input.

## Run it

```sh
node main.ts
```

The harness runs `node /bot/main.ts` (Node 22). It reads every case from
`/input/cases.json` (a JSON array of `{id, input}`), answers each one alone with
`run()` from `solve.js`, and writes `/output/answers.json`. Outside a container,
`MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` stand in for `/input` and `/output`.

## How it works

`solve.js` implements csv-reader 1.0.0's broken-row policy exactly — BOM
dropping, stray CRs, quoted fields with doubled quotes, quote junk,
unterminated quotes read again as unquoted, short/long row padding and cutting,
and `{code, line, row}` errors in the order met — but reads slice by slice,
jumping between the only characters that can change the reading (`,` `"` CR LF)
instead of one character at a time, with a fast path that splits a plain line
on commas. It is pure: no clock, no randomness, nothing kept between calls.

## License

MIT — see `LICENSE`.
