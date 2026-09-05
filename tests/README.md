# Tests

All automated tests live **here**, not under `src/`.

```text
tests/
  smoke.test.ts  theme + demo login helper
  session/       strategy, expiry skew
  ops/           StartWork, SubmitOrder, PriceLines, RecordTrackPoint, …
  db/            ids, audit, stampHistory, tracking id
  sync/          push filters (pure fns)
  README.md
```

Name files after the catalog op: `tests/ops/startWork.test.ts`.

Must cover: `stampHistory` from/to (qty 10 → 5), skip `SetSyncState`, tracking id `track:{day}:{employeeId}` (not email), haversine threshold, last-N-days is N constructed KV ids.

Runner: `npm test` (Jest + jest-expo).

Keep fixtures tiny. No production secrets. No full photo binaries.
