import { loadChild, saveChild } from './childStore';
import type { StartSession } from './copyInbound';
import { listInventoryTxForWork } from './inventory';
import { listNotes } from './notes';
import { OutError } from './outError';
import { loadOutboundRaw } from './outboundStore';
import { setSyncState } from './setSyncState';
import { listTasksForWork } from './tasks';

export async function markJobChildrenReadyToPush(wooutId: string): Promise<void> {
  for (const t of await listTasksForWork(wooutId)) {
    const raw = await loadChild('tasks', t.id);
    if (!raw || raw.readyToPush === true) continue;
    await saveChild('tasks', t.id, { ...raw, readyToPush: true });
  }
  for (const n of await listNotes({ workOrderOutId: wooutId })) {
    const raw = await loadChild('notes', n.id);
    if (!raw || raw.readyToPush === true) continue;
    await saveChild('notes', n.id, { ...raw, readyToPush: true });
  }
  for (const tx of await listInventoryTxForWork(wooutId)) {
    const raw = await loadChild('inventory', tx.id);
    if (!raw || raw.readyToPush === true) continue;
    await saveChild('inventory', tx.id, { ...raw, readyToPush: true });
  }
}

export async function submitWork(id: string, session: StartSession): Promise<void> {
  const doc = await loadOutboundRaw(id);
  if (!doc) throw new OutError('missing');
  const status = String(doc.status ?? '');
  if (status !== 'complete' && status !== 'cancelled') throw new OutError('not_terminal');
  await setSyncState(id, 'ready_to_push', session);
  await markJobChildrenReadyToPush(id);
}
