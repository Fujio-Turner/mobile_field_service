import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { memorySave } from '@/src/db/memoryStore';
import { seedAssets } from '@/src/db/seedData';
import { nativeDbAvailable } from '@/src/db/database';
import { clusterAssets, clusterCellM } from '@/src/geo/cluster';
import { bboxAround, type BBox } from '@/src/geo/haversine';
import { requestAndGetFix } from '@/src/geo/location';
import { styleReachable } from '@/src/geo/mapStyle';
import {
  listOpenJobs,
  queryAssetsInBBox,
  type AssetItem,
  type OpenJobRef,
} from '@/src/ops/assets';
import { useAuth } from '@/src/session/AuthContext';
import { canRenderLibreMap, LibreAssetMap } from '@/src/ui/LibreAssetMap';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { theme } from '@/src/theme';

const SITE = { lat: 41.7658, lon: -72.6734 };
const DEFAULT_RADIUS_M = 2000;

type Mode = 'area' | 'job' | 'me';

function ensureMemoryAssets() {
  if (nativeDbAvailable()) return;
  for (const row of seedAssets('0.1.0+1', 1_700_000_000)) {
    memorySave('assets', row.id, row.doc as unknown as Record<string, unknown>);
  }
}

export default function MapScreen() {
  const router = useRouter();
  const { wooutId } = useLocalSearchParams<{ wooutId?: string }>();
  const { session } = useAuth();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [jobs, setJobs] = useState<OpenJobRef[]>([]);
  const [mode, setMode] = useState<Mode>('area');
  const [assetType, setAssetType] = useState<string | null>(null);
  const [center, setCenter] = useState(SITE);
  const [box, setBox] = useState<BBox>(() => bboxAround(SITE, DEFAULT_RADIUS_M));
  const [online, setOnline] = useState(true);
  const [gpsDenied, setGpsDenied] = useState(false);
  const nativeMap = canRenderLibreMap();

  const job = useMemo(() => {
    if (wooutId) return jobs.find((j) => j.id === wooutId) ?? jobs[0];
    return jobs[0];
  }, [jobs, wooutId]);

  const reload = useCallback(
    async (nextBox: BBox, nextCenter: { lat: number; lon: number }) => {
      ensureMemoryAssets();
      const rows = await queryAssetsInBBox(nextBox, nextCenter, assetType ? { assetType } : undefined);
      setAssets(rows);
    },
    [assetType],
  );

  useEffect(() => {
    void (async () => {
      ensureMemoryAssets();
      if (session) setJobs(await listOpenJobs(session.employeeId));
      setOnline(await styleReachable());
      await reload(bboxAround(SITE, DEFAULT_RADIUS_M), SITE);
    })();
  }, [session, reload]);

  useEffect(() => {
    void reload(box, center);
  }, [assetType, box, center, reload]);

  const types = [...new Set(assets.map((a) => a.assetType))].sort();
  const clusters = clusterAssets(assets, nativeMap ? 0 : clusterCellM(box));

  function openAsset(id: string) {
    const q = job?.id ? `?wooutId=${encodeURIComponent(job.id)}` : '';
    router.push(`/asset/${id}${q}`);
  }

  async function nearJob() {
    const geo = job?.geo ?? SITE;
    setMode('job');
    setCenter(geo);
    const next = bboxAround(geo, 250);
    setBox(next);
  }

  async function nearMe() {
    const fix = await requestAndGetFix();
    if (!fix) {
      setGpsDenied(true);
      return;
    }
    setGpsDenied(false);
    setMode('me');
    setCenter(fix);
    setBox(bboxAround(fix, 500));
  }

  function areaAll() {
    setMode('area');
    setCenter(job?.geo ?? SITE);
    setBox(bboxAround(job?.geo ?? SITE, DEFAULT_RADIUS_M));
  }

  return (
    <View style={styles.wrap}>
      <NativeBanner />
      <Text style={styles.title}>Assets map</Text>
      <Text style={styles.muted}>
        {online
          ? 'Basemap: OpenFreeMap Liberty when online. Pins always from local assets (work offline).'
          : 'Airplane / no tiles: pins still show from local data. Basemap may be empty.'}
      </Text>
      {!nativeMap ? (
        <Text style={styles.muted}>MapLibre basemap needs a development build. Pin list below still works.</Text>
      ) : null}
      {gpsDenied ? <Text style={styles.warn}>Location permission is off. Near me needs while-using access.</Text> : null}

      <View style={styles.chips}>
        <Chip label="Area" active={mode === 'area'} onPress={areaAll} />
        <Chip label="Near job" active={mode === 'job'} onPress={() => void nearJob()} />
        <Chip label="Near me" active={mode === 'me'} onPress={() => void nearMe()} />
        <Chip label="All types" active={assetType == null} onPress={() => setAssetType(null)} />
        {types.map((t) => (
          <Chip key={t} label={t} active={assetType === t} onPress={() => setAssetType(t)} />
        ))}
      </View>
      {job ? (
        <Text style={styles.muted}>
          Open job {job.number} · {job.siteName}
        </Text>
      ) : (
        <Text style={styles.muted}>Start a job from Today to use an asset on it.</Text>
      )}

      {nativeMap ? (
        <LibreAssetMap
          key={`${mode}-${center.lat.toFixed(4)}-${center.lon.toFixed(4)}`}
          assets={assets}
          center={center}
          showUser={mode === 'me'}
          onPressAsset={openAsset}
          onRegion={(next, zoom) => {
            if (zoom < 11) return;
            setBox(next);
          }}
        />
      ) : (
        <View style={[styles.mapStub, !online && styles.mapOffline]}>
          <Text style={styles.mapLabel}>{online ? 'Pin preview (no native MapLibre)' : 'No basemap (offline)'}</Text>
          {clusters.map((c) =>
            c.count === 1 ? (
              <Text key={c.key} style={styles.pin}>
                ● {c.assets[0].code ?? c.assets[0].name}
              </Text>
            ) : (
              <Text key={c.key} style={styles.pin}>
                ◉ {c.count} assets
              </Text>
            ),
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {clusters.flatMap((c) =>
          c.assets.map((a) => (
            <Pressable key={a.id} style={styles.row} onPress={() => openAsset(a.id)}>
              <Text style={styles.rowTitle}>
                {a.name} · {a.assetType}
              </Text>
              <Text style={styles.muted}>
                {a.geo.lat.toFixed(4)}, {a.geo.lon.toFixed(4)}
                {a.distanceM != null ? ` · ${Math.round(a.distanceM)} m` : ''}
              </Text>
            </Pressable>
          )),
        )}
      </ScrollView>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg },
  title: { fontSize: theme.type.lg, color: theme.color.text, fontWeight: '600', marginBottom: theme.space.sm },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: theme.space.sm },
  warn: { fontSize: theme.type.md, color: theme.color.warn, marginBottom: theme.space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm, marginBottom: theme.space.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.border,
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
  },
  chipOn: { borderColor: theme.color.accent, backgroundColor: theme.color.accent },
  chipLabel: { color: theme.color.text, fontSize: theme.type.sm, fontWeight: '600' },
  chipLabelOn: { color: theme.color.onAccent },
  mapStub: {
    minHeight: 160,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: '#e8f0fe',
    padding: theme.space.md,
    marginBottom: theme.space.md,
  },
  mapOffline: { backgroundColor: '#ececec' },
  mapLabel: { fontSize: theme.type.sm, color: theme.color.muted, marginBottom: theme.space.sm },
  pin: { fontSize: theme.type.md, color: theme.color.text, marginBottom: 4 },
  list: { paddingBottom: 48 },
  row: {
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    justifyContent: 'center',
    paddingVertical: theme.space.sm,
  },
  rowTitle: { fontSize: theme.type.md, color: theme.color.text, fontWeight: '600' },
});
