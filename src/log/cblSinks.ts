/** Configure CBL LogSinks after the engine singleton. Never mix with Database.setLogLevel. */
export async function configureCblLogSinks(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LogSinks, LogLevel, LogDomain } = require('cbl-reactnative') as {
      LogSinks: { setConsole: (cfg: { level: unknown; domains: unknown[] }) => Promise<void> };
      LogLevel: { DEBUG: unknown; INFO: unknown };
      LogDomain: { ALL: unknown; REPLICATOR: unknown; NETWORK: unknown; DATABASE: unknown };
    };
    await LogSinks.setConsole({
      level: LogLevel.INFO,
      domains: [LogDomain.REPLICATOR, LogDomain.NETWORK, LogDomain.DATABASE],
    });
  } catch {
    // native module or LogSinks missing (Expo Go / tests)
  }
}
