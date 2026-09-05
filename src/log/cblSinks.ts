/** Configure CBL LogSinks after the engine singleton. Never mix with Database.setLogLevel. */
export async function configureCblLogSinks(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LogSinks, LogLevel, LogDomain } = require('cbl-reactnative') as {
      LogSinks: { setConsole: (cfg: { level: unknown; domains: unknown[] }) => Promise<void> };
      LogLevel: { DEBUG: unknown; INFO: unknown };
      LogDomain: { ALL: unknown; REPLICATOR: unknown; NETWORK: unknown; DATABASE: unknown };
    };
    const prod = process.env.NODE_ENV === 'production';
    await LogSinks.setConsole({
      level: prod ? LogLevel.INFO : LogLevel.DEBUG,
      domains: prod
        ? [LogDomain.REPLICATOR, LogDomain.NETWORK, LogDomain.DATABASE]
        : [LogDomain.ALL],
    });
  } catch {
    // native module or LogSinks missing (Expo Go / tests)
  }
}
