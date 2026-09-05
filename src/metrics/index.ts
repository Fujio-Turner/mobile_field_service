import { copyOnWriteTotals } from './copyOnWrite';

export type MetricSample = {
  name: string;
  value: number;
  labels?: Record<string, string>;
  ts: number;
};

const samples: MetricSample[] = [];

export function recordMetric(name: string, value: number, labels?: Record<string, string>): void {
  samples.push({ name, value, labels, ts: Math.floor(Date.now() / 1000) });
  if (samples.length > 500) samples.shift();
}

export async function timeQuery<T>(query: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    recordMetric('mfs_query_latency_ms', Date.now() - t0, { query });
  }
}

export function metricSnapshot(): {
  copyOnWrite: ReturnType<typeof copyOnWriteTotals>;
  samples: MetricSample[];
} {
  return { copyOnWrite: copyOnWriteTotals(), samples: [...samples] };
}

export function resetMetrics(): void {
  samples.length = 0;
}
