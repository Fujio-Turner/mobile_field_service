import { DEFAULT_JOB_RULES, parseJobRules, parseJobRulesJson } from '../../src/dev/jobRules';
import { decideInboundAction } from '../../src/ops/inboundApply';
import { outboundIsUntouched } from '../../src/ops/inboundDiff';

describe('jobRules', () => {
  it('defaults keep_editing and local_wins', () => {
    expect(parseJobRules({})).toEqual(DEFAULT_JOB_RULES);
    expect(parseJobRulesJson(null).reassign).toBe('keep_editing');
    expect(parseJobRules({ reassign: 'forbid_edits', inbound: 'prompt' })).toEqual({
      reassign: 'forbid_edits',
      inbound: 'prompt',
    });
  });
});

describe('outboundIsUntouched', () => {
  it('is true for StartWork-only history', () => {
    expect(outboundIsUntouched({ history: [{ op: 'StartWork' }] })).toBe(true);
    expect(outboundIsUntouched({ history: [{ op: 'StartWork' }, { op: 'UpdateWorkOrderOutFields' }] })).toBe(false);
  });
});

describe('decideInboundAction', () => {
  const diffs = [{ key: 'summary', path: 'summary', local: 'a', remote: 'b', snapshot: 'a', dirty: false, inboundChanged: true }];
  it('applies when the copy was never edited', () => {
    expect(decideInboundAction({ rules: DEFAULT_JOB_RULES, untouched: true, gone: false, diffs })).toBe('apply');
  });
  it('drops an untouched copy when inbound is gone', () => {
    expect(decideInboundAction({ rules: DEFAULT_JOB_RULES, untouched: true, gone: true, diffs: [] })).toBe('drop');
  });
  it('does not drop a dirty copy when inbound is gone', () => {
    expect(decideInboundAction({ rules: DEFAULT_JOB_RULES, untouched: false, gone: true, diffs })).toBe('none');
  });
  it('honors remote_wins / local_wins / prompt after edits', () => {
    expect(
      decideInboundAction({ rules: { reassign: 'keep_editing', inbound: 'remote_wins' }, untouched: false, gone: false, diffs }),
    ).toBe('apply');
    expect(
      decideInboundAction({ rules: { reassign: 'keep_editing', inbound: 'local_wins' }, untouched: false, gone: false, diffs }),
    ).toBe('none');
    expect(
      decideInboundAction({ rules: { reassign: 'keep_editing', inbound: 'prompt' }, untouched: false, gone: false, diffs }),
    ).toBe('prompt');
  });
});
