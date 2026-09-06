# Tests

All automated tests live **here**, not under `src/`.

```text
tests/
  smoke.test.ts  theme + demo login helper
  session/       strategy, expiry skew, workModes
  db/            ids, audit, stampHistory, collections, tracking TTL
  ops/           Today collapse, StartWork, inbound kit, tracking, chat, inventory, …
  dev/           job rules parse
  sync/          push filters, channels, schema, HTTP error classes, per-collection conflicts
  ui/            handedness, stack Back
  README.md
```

Name files after the catalog op: `tests/ops/startWork.test.ts`.

Must cover: `stampHistory` from/to (qty 10 → 5), skip `SetSyncState`, tracking id `track:{day}:{employeeId}` (not email), haversine threshold, last-N-days is N constructed KV ids, tracking **TTL 30 days**, inbound kit local/remote/prompt.

Runner: `npm test` (Jest + jest-expo).

Keep fixtures tiny. No production secrets. No full photo binaries.
