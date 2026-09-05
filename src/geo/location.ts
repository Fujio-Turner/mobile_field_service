type LocationMod = {
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (opts?: { accuracy?: number }) => Promise<{
    coords: { latitude: number; longitude: number; accuracy?: number | null };
  }>;
  watchPositionAsync: (
    opts: { accuracy?: number; distanceInterval?: number; timeInterval?: number },
    cb: (loc: { coords: { latitude: number; longitude: number; accuracy?: number | null }; timestamp: number }) => void,
  ) => Promise<{ remove: () => void }>;
  Accuracy?: { Balanced?: number };
};

function loadLocation(): LocationMod | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location') as LocationMod;
  } catch {
    return null;
  }
}

/** Foreground / while-using GPS. Returns null if denied or native missing. */
export async function requestAndGetFix(): Promise<{ lat: number; lon: number; accuracyM?: number } | null> {
  try {
    const Location = loadLocation();
    if (!Location) return null;
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy?.Balanced,
    });
    return {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracyM: pos.coords.accuracy ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Distance-based watch. Do not poll on a timer while still. Caller must stop on background. */
export async function watchForegroundFixes(
  onFix: (fix: { lat: number; lon: number; accuracyM?: number; ts: number }) => void,
  distanceIntervalM = 50,
): Promise<{ stop: () => void } | null> {
  try {
    const Location = loadLocation();
    if (!Location) return null;
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy?.Balanced,
        distanceInterval: distanceIntervalM,
      },
      (loc) => {
        onFix({
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          accuracyM: loc.coords.accuracy ?? undefined,
          ts: Math.floor((loc.timestamp || Date.now()) / 1000),
        });
      },
    );
    return { stop: () => sub.remove() };
  } catch {
    return null;
  }
}
