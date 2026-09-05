# Tests

All automated tests live **here**, not under `src/`.

```text
tests/
  ops/           StartWork, SubmitOrder, PriceLines, …
  db/            ids, audit, collections
  sync/          push filters (pure fns), session expiry helpers
  README.md
```

Name files after the catalog op: `tests/ops/startWork.test.ts`.

Runner: Jest (wired in the Expo shell PR). Until `package.json` exists, this folder is the contract.

Keep fixtures tiny. No production secrets. No full photo binaries.
