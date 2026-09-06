import { NativeModules } from 'react-native';

/** True when the CBL native module is linked (dev client / prebuild). False in Expo Go. */
export function isCblNativeAvailable(): boolean {
  const mods = NativeModules as Record<string, unknown>;
  return Boolean(
    mods.CblReactnative ||
      mods.CblReactNative ||
      mods.CBLReactNative ||
      mods.CblReactNativeEngine ||
      mods.CBLIteReactNative,
  );
}
