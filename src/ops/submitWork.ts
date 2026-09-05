import type { StartSession } from './copyInbound';
import { OutError } from './outError';
import { loadOutboundRaw } from './outboundStore';
import { setSyncState } from './setSyncState';

export async function submitWork(id: string, session: StartSession): Promise<void> {
  const doc = await loadOutboundRaw(id);
  if (!doc) throw new OutError('missing');
  const status = String(doc.status ?? '');
  if (status !== 'complete' && status !== 'cancelled') throw new OutError('not_terminal');
  await setSyncState(id, 'ready_to_push', session);
}
