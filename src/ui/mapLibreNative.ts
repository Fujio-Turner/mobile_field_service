import { NativeModules } from 'react-native';

/** True when MapLibre native views are linked (dev client / prebuild). False in Expo Go. */
export function mapLibreNativeAvailable(): boolean {
  const mods = NativeModules as Record<string, unknown>;
  return Boolean(mods.MLRNModule || mods.MLRNMapView || mods.MLRNAndroidTextureMapView);
}
