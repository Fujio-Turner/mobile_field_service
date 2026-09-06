import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  DEFAULT_JOB_RULES,
  JOB_RULES_KEY,
  parseJobRulesJson,
  type InboundPolicy,
  type JobRules,
  type ReassignPolicy,
} from './jobRules';

type JobRulesState = {
  rules: JobRules;
  setReassign: (next: ReassignPolicy) => void;
  setInbound: (next: InboundPolicy) => void;
};

const Ctx = createContext<JobRulesState | null>(null);

export function JobRulesProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<JobRules>(DEFAULT_JOB_RULES);

  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync(JOB_RULES_KEY)
      .then((raw) => {
        if (!cancelled) setRules(parseJobRulesJson(raw));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: JobRules) => {
    setRules(next);
    void SecureStore.setItemAsync(JOB_RULES_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const setReassign = useCallback(
    (reassign: ReassignPolicy) => persist({ ...rules, reassign }),
    [persist, rules],
  );
  const setInbound = useCallback(
    (inbound: InboundPolicy) => persist({ ...rules, inbound }),
    [persist, rules],
  );

  const value = useMemo(() => ({ rules, setReassign, setInbound }), [rules, setReassign, setInbound]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJobRules(): JobRulesState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useJobRules must be used inside JobRulesProvider');
  return ctx;
}

export function useJobRulesOptional(): JobRulesState | null {
  return useContext(Ctx);
}
