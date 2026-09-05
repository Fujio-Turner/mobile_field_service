/** Foreground / while-using GPS. Returns null if denied or native missing. */
export async function requestAndGetFix(): Promise<{ lat: number; lon: number } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location') as {
      requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
      getCurrentPositionAsync: (opts?: { accuracy?: number }) => Promise<{
        coords: { latitude: number; longitude: number };
      }>;
      Accuracy?: { Balanced?: number };
    };
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy?.Balanced,
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return null;
  }
}
