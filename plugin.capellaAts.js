const { withInfoPlist } = require('@expo/config-plugins');

/** Allow TLS to Capella App Services on :4984 (wss/https). Expo's default ATS dict drops this. */
function withCapellaAts(config) {
  return withInfoPlist(config, (cfg) => {
    const ats = { ...(cfg.modResults.NSAppTransportSecurity ?? {}) };
    ats.NSAllowsArbitraryLoads = false;
    ats.NSAllowsLocalNetworking = true;
    ats.NSExceptionDomains = {
      ...(ats.NSExceptionDomains ?? {}),
      'apps.cloud.couchbase.com': {
        NSIncludesSubdomains: true,
        NSExceptionMinimumTLSVersion: 'TLSv1.2',
        NSExceptionRequiresForwardSecrecy: false,
      },
    };
    cfg.modResults.NSAppTransportSecurity = ats;
    return cfg;
  });
}

module.exports = withCapellaAts;
