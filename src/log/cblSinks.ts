/**
 * This cbl-reactnative fork has Database.setLogLevel + file config, not LogSinks
 * (https://cbl-reactnative.dev/Troubleshooting/using-logs). Console domain is
 * overwritten per call — use ALL so REPLICATOR+NETWORK both emit.
 */
let fileLogDir: string | null = null;

export function cblFileLogDirectory(): string | null {
  return fileLogDir;
}

export async function configureCblLogSinks(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database, LogDomain, LogLevel } = require('cbl-reactnative') as {
      Database: { setLogLevel: (domain: unknown, level: unknown) => Promise<void> };
      LogDomain: { ALL: unknown; REPLICATOR: unknown; NETWORK: unknown };
      LogLevel: { VERBOSE: unknown; DEBUG: unknown };
    };
    const verbose = typeof __DEV__ !== 'undefined' && __DEV__;
    const level = verbose ? LogLevel.VERBOSE : LogLevel.DEBUG;
    await Database.setLogLevel(LogDomain.ALL, level);
  } catch {
    // Expo Go / tests
  }
}

/** File sink after the database is open (needs unique name). Plaintext for Metro/Xcode tails. */
export async function configureCblFileLogs(db: {
  log?: {
    setFileConfig: (cfg: {
      level: number;
      directory: string;
      maxRotateCount?: number;
      maxSize?: number;
      usePlaintext?: boolean;
    }) => Promise<void>;
  };
  getPath?: () => Promise<string>;
}): Promise<void> {
  try {
    const base =
      typeof db.getPath === 'function' ? await db.getPath() : null;
    const directory = `${(base ?? '').replace(/\/$/, '')}/cbl-logs`;
    if (!directory || directory === '/cbl-logs') return;
    if (typeof db.log?.setFileConfig !== 'function') return;
    await db.log.setFileConfig({
      level: 1,
      directory,
      maxRotateCount: 5,
      maxSize: 1024 * 1024,
      usePlaintext: true,
    });
    fileLogDir = directory;
  } catch {
    /* file sink optional */
  }
}
