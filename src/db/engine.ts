import { isCblNativeAvailable } from './native';

type Engine = { _brand: 'CblReactNativeEngine' };

let engine: Engine | null = null;

export function getCblEngine(): Engine {
  if (!isCblNativeAvailable()) {
    throw new Error('Couchbase Lite native module is not available. Use a development build.');
  }
  if (!engine) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CblReactNativeEngine } = require('cbl-reactnative') as {
      CblReactNativeEngine: new () => Engine;
    };
    engine = new CblReactNativeEngine();
  }
  return engine;
}
