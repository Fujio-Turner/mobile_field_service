import { listOpenJobs } from '../ops/assets';
import { saveChild, loadChild } from '../ops/childStore';
import { applyOutPatch } from '../ops/updateWorkOrderOut';
import { loadOutboundRaw, saveOutboundRaw } from '../ops/outboundStore';
import type { StartSession } from '../ops/copyInbound';
import { log } from '../log/logger';
import { OutError } from '../ops/outError';

export async function pickOpenJob(
  employeeId: string,
  preferNumber?: string,
): Promise<{ wooutId: string; number: string } | null> {
  const jobs = await listOpenJobs(employeeId);
  const hit = preferNumber ? jobs.find((j) => j.number === preferNumber) : undefined;
  const job = hit ?? jobs.find((j) => j.number !== 'WO-10460') ?? jobs[0];
  return job ? { wooutId: job.id, number: job.number } : null;
}

/** Lab only: mutate pulled inbound so job rules can be exercised without SG. */
export async function simulateDispatchKitChange(
  session: StartSession,
  wooutId: string,
  opts: { dirtyLocal?: boolean } = {},
): Promise<{ inboundId: string; number: string }> {
  const out = await loadOutboundRaw(wooutId);
  if (!out) throw new OutError('missing');
  const inboundId = String((out.source as { id?: string } | undefined)?.id ?? '');
  if (!inboundId) throw new OutError('missing');
  const inbound = await loadChild('workordersin', inboundId);
  if (!inbound) throw new OutError('missing');
  if (opts.dirtyLocal) {
    await saveOutboundRaw(
      wooutId,
      applyOutPatch(out, { summary: `${String(out.summary ?? '')} — on site`.trim() }, session),
    );
  }
  const checklist = Array.isArray(inbound.checklist) ? [...inbound.checklist] : [];
  checklist.push({ id: `cl-dev-${Date.now()}`, label: 'Dispatch added: nameplate photo', required: false, done: false });
  const next = {
    ...inbound,
    summary: `${String(inbound.summary ?? '')} [dispatch: extra photo]`.trim(),
    checklist,
  };
  await saveChild('workordersin', inboundId, next);
  log.info('mfs.dev.simulate_inbound', {
    op: 'SimulateDispatchKit',
    collection: 'workordersin',
    docId: inboundId,
    fields: 'summary,checklist',
  });
  return { inboundId, number: String(out.number ?? '') };
}
