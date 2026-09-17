import { cycleTaskStatus } from '../../src/ops/tasks';
import { remainingCompleteItems } from '../../src/ops/outStatus';
import { labelStatus, toneForTaskStatus } from '../../src/ui/StatusCycleBadge';

describe('StatusCycleBadge helpers', () => {
  it('labels and tones task statuses for the cycle chip', () => {
    expect(labelStatus('open')).toBe('Open');
    expect(labelStatus('done')).toBe('Done');
    expect(labelStatus('skipped')).toBe('Skipped');
    expect(toneForTaskStatus('open')).toBe('action');
    expect(toneForTaskStatus('done')).toBe('ok');
    expect(toneForTaskStatus('skipped')).toBe('warn');
  });

  it('open cycles to done', () => {
    expect(cycleTaskStatus('open')).toBe('done');
    expect(labelStatus(cycleTaskStatus('open'))).toBe('Done');
  });
});

describe('remainingCompleteItems', () => {
  it('lists every required open item', () => {
    expect(
      remainingCompleteItems(
        {
          operations: [{ name: 'Site check', required: true, status: 'pending' }],
          checklist: [{ label: 'PPE on', required: true, done: false }],
        },
        [{ type: 'task', required: true, status: 'open', title: 'Lockout / tagout' }],
      ),
    ).toEqual(['Site check', 'PPE on', 'Lockout / tagout']);
  });
});
