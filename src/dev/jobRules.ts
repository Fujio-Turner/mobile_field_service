export const JOB_RULES_KEY = 'mfs.dev.jobRules';

export const REASSIGN_POLICIES = ['keep_editing', 'forbid_edits'] as const;
export type ReassignPolicy = (typeof REASSIGN_POLICIES)[number];

export const INBOUND_POLICIES = ['local_wins', 'remote_wins', 'prompt'] as const;
export type InboundPolicy = (typeof INBOUND_POLICIES)[number];

export type JobRules = {
  reassign: ReassignPolicy;
  inbound: InboundPolicy;
};

export const DEFAULT_JOB_RULES: JobRules = {
  reassign: 'keep_editing',
  inbound: 'local_wins',
};

export function parseJobRules(raw: unknown): JobRules {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const reassign = REASSIGN_POLICIES.includes(rec.reassign as ReassignPolicy)
    ? (rec.reassign as ReassignPolicy)
    : DEFAULT_JOB_RULES.reassign;
  const inbound = INBOUND_POLICIES.includes(rec.inbound as InboundPolicy)
    ? (rec.inbound as InboundPolicy)
    : DEFAULT_JOB_RULES.inbound;
  return { reassign, inbound };
}

export function parseJobRulesJson(text: string | null | undefined): JobRules {
  if (!text) return { ...DEFAULT_JOB_RULES };
  try {
    return parseJobRules(JSON.parse(text) as unknown);
  } catch {
    return { ...DEFAULT_JOB_RULES };
  }
}

export const REASSIGN_LABELS: Record<ReassignPolicy, string> = {
  keep_editing: 'Keep editing (banner only)',
  forbid_edits: 'Forbid further edits',
};

export const INBOUND_LABELS: Record<InboundPolicy, string> = {
  local_wins: 'Local wins (keep my copy)',
  remote_wins: 'Remote wins (inbound overwrites)',
  prompt: 'Show diff and let me pick',
};
