# Schema — shared envelope

Every product document (except raw CBL internals) has:

```ts
type: string;           // matches collection purpose
audit: {
  cr: { dt: number; ver: string; by: string }; // unix **seconds**, app ver, username
  up: { dt: number; ver: string; by: string };
};
lastAction?: {          // omit on SetSyncState / pull catalogs
  dt: number;
  lat?: number;
  lon?: number;
  accuracyM?: number;
};
```

On create, `up` may equal `cr`. Never mix milliseconds. UI: `new Date(dt * 1000)`.

`assignedTo` (when present):

```ts
{ userId: string; employeeId: string; email: string; username: string; displayName: string }
```

Channel: `emp:{employeeId}`. SG login username = **email**. `audit.*.by` = `username`.

Reserved keys: `_id`, `_rev`, `_sequence`, `_attachments`, `_deleted`, `_removed`.

Ids: `<prefix>:<ULID>` (26 char Crockford). No extra colons in the unique part.
