import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ensureMemoryAssets } from '@/src/db/ensureMemoryDemo';
import { memorySave } from '@/src/db/memoryStore';
import { nativeDbAvailable } from '@/src/db/database';
import { SEED_CUSTOMER_ID, seedCustomerDoc, seedInboundOrders } from '@/src/db/seedData';
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
import { queryCustomersInBBox, type CustomerItem } from '@/src/ops/customers';
import { queryOrderSitesInBBox, type OrderSitePin } from '@/src/ops/orders';
import { useAuth } from '@/src/session/AuthContext';
import { mapPlotsAssets, mapPlotsCustomers, workModesFromSession } from '@/src/session/workModes';
import { canRenderLibreMap, LibreAssetMap, type MapPin } from '@/src/ui/LibreAssetMap';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { theme } from '@/src/theme';

const SITE = { lat: 41.7658, lon: -72.6734 };
const DEFAULT_RADIUS_M = 2000;

type Mode = 'area' | 'job' | 'me';

function ensureCustomers() {
  if (nativeDbAvailable()) return;
  memorySave('customers', SEED_CUSTOMER_ID, seedCustomerDoc('0.1.0+1', 1_700_000_000) as never);
  for (const inbound of seedInboundOrders('0.1.0+1', 1_700_000_000)) {
    memorySave('orders', inbound.id, inbound.doc as never);
  }
}

export default function MapScreen() {
  const router = useRouter();
  const { wooutId } = useLocalSearchParams<{ wooutId?: string }>();
  const { session } = useAuth();
  const modes = workModesFromSession(session);
  const [kitFilter, setKitFilter] = useState(false);
  const plotAssets = mapPlotsAssets(modes, { kitFilter });
  const plotCustomers = mapPlotsCustomers(modes);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [orderSites, setOrderSites] = useState<OrderSitePin[]>([]);
  const [jobs, setJobs] = useState<OpenJobRef[]>([]);
  const [mode, setMode] = useState<Mode>('area');
  const [assetType, setAssetType] = useState<string | null>(null);
  const [center, setCenter] = useState(SITE);
  const [box, setBox] = useState<BBox>(() => bboxAround(SITE, DEFAULT_RADIUS_M));
  const [online, setOnline] = useState(true);
  const [gpsDenied, setGpsDenied] = useState(false);
  const nativeMap = canRenderLibreMap();
  const regionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const job = useMemo(() => {
    if (wooutId) return jobs.find((j) => j.id === wooutId) ?? jobs[0];
    return jobs[0];
  }, [jobs, wooutId]);

  const stop = useMemo(() => {
    const withGeo = orderSites[0] ?? customers.find((c) => c.geo);
    return withGeo?.geo ?? job?.geo ?? SITE;
  }, [orderSites, customers, job]);

  const reload = useCallback(
    async (nextBox: BBox, nextCenter: { lat: number; lon: number }) => {
      ensureMemoryAssets();
      ensureCustomers();
      if (plotAssets) {
        const rows = await queryAssetsInBBox(nextBox, nextCenter, assetType ? { assetType } : undefined);
        setAssets(rows);
      } else {
        setAssets([]);
      }
      if (plotCustomers) {
        setCustomers(await queryCustomersInBBox(nextBox, nextCenter));
        setOrderSites(await queryOrderSitesInBBox(nextBox, nextCenter));
      } else {
        setCustomers([]);
        setOrderSites([]);
      }
    },
    [assetType, plotAssets, plotCustomers],
  );

  useEffect(() => {
    ensureMemoryAssets();
    ensureCustomers();
    if (session) void listOpenJobs(session.employeeId).then(setJobs);
    void styleReachable().then(setOnline);
  }, [session]);

  useEffect(() => {
    void reload(box, center);
  }, [assetType, box, center, reload]);

  useEffect(() => {
    return () => {
      if (regionTimer.current) clearTimeout(regionTimer.current);
    };
  }, []);

  const types = [...new Set(assets.map((a) => a.assetType))].sort();
  const pins: MapPin[] = [
    ...assets.map((a) => ({ id: a.id, name: a.name, sub: a.assetType, geo: a.geo })),
    ...customers
      .filter((c) => c.geo)
      .map((c) => ({ id: c.id, name: c.name, sub: 'customer', geo: c.geo! })),
    ...orderSites.map((o) => ({
      id: `ord:${o.id}`,
      name: o.number,
      sub: o.siteName ?? 'order',
      geo: o.geo,
    })),
  ];
  const clusters = clusterAssets(pins, nativeMap ? 0 : clusterCellM(box));
  const title = plotCustomers && !plotAssets ? 'Customers map' : plotCustomers ? 'Sites map' : 'Assets map';

  function openPin(id: string) {
    if (id.startsWith('ord:')) {
      router.push(`/order/${id.slice(4)}`);
      return;
    }
    if (id.startsWith('cus:')) {
      router.push(`/customer/${id}`);
      return;
    }
    const q = job?.id ? `?wooutId=${encodeURIComponent(job.id)}` : '';
    router.push(`/asset/${id}${q}`);
  }

  async function nearJob() {
    const geo = plotCustomers ? stop : (job?.geo ?? SITE);
    setMode('job');
    setCenter(geo);
    setBox(bboxAround(geo, 250));
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
    const geo = plotCustomers ? stop : (job?.geo ?? SITE);
    setCenter(geo);
    setBox(bboxAround(geo, DEFAULT_RADIUS_M));
  }

  return (
    <View style={styles.wrap}>
      <NativeBanner />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>
        {online
          ? 'Basemap: OpenFreeMap Liberty when online. Pins always from local data (work offline).'
          : 'Airplane / no tiles: pins still show from local data. Basemap may be empty.'}
      </Text>
      {!nativeMap ? (
        <Text style={styles.muted}>MapLibre basemap needs a development build. Pin list below still works.</Text>
      ) : null}
      {gpsDenied ? <Text style={styles.warn}>Location permission is off. Near me needs while-using access.</Text> : null}

      <View style={styles.chips}>
        <Chip label="Area" active={mode === 'area'} onPress={areaAll} />
        <Chip
          label={plotCustomers ? 'Near stop' : 'Near job'}
          active={mode === 'job'}
          onPress={() => void nearJob()}
        />
        <Chip label="Near me" active={mode === 'me'} onPress={() => void nearMe()} />
        {modes.includes('customer') && !modes.includes('assets') ? (
          <Chip label="Kit" active={kitFilter} onPress={() => setKitFilter((v) => !v)} />
        ) : null}
        {plotAssets ? (
          <>
            <Chip label="All types" active={assetType == null} onPress={() => setAssetType(null)} />
            {types.map((t) => (
              <Chip key={t} label={t} active={assetType === t} onPress={() => setAssetType(t)} />
            ))}
          </>
        ) : null}
      </View>
      {plotAssets && job ? (
        <Text style={styles.muted}>
          Open job {job.number} · {job.siteName}
        </Text>
      ) : plotAssets ? (
        <Text style={styles.muted}>Start a job from Today to use an asset on it.</Text>
      ) : (
        <Text style={styles.muted}>Customers and order sites from the local database.</Text>
      )}

      {nativeMap ? (
        <LibreAssetMap
          key={`${mode}-${center.lat.toFixed(4)}-${center.lon.toFixed(4)}`}
          pins={pins}
          center={center}
          showUser={mode === 'me'}
          onPressPin={openPin}
          onRegion={(next, zoom) => {
            if (zoom < 11) return;
            if (regionTimer.current) clearTimeout(regionTimer.current);
            regionTimer.current = setTimeout(() => setBox(next), 280);
          }}
        />
      ) : (
        <View style={[styles.mapStub, !online && styles.mapOffline]}>
          <Text style={styles.mapLabel}>{online ? 'Pin preview (no native MapLibre)' : 'No basemap (offline)'}</Text>
          {clusters.map((c) =>
            c.count === 1 ? (
              <Text key={c.key} style={styles.pin}>
                ● {c.assets[0].sub ?? c.assets[0].name}
              </Text>
            ) : (
              <Text key={c.key} style={styles.pin}>
                ◉ {c.count} pins
              </Text>
            ),
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {clusters.flatMap((c) =>
          c.assets.map((a) => (
            <Pressable key={a.id} style={styles.row} onPress={() => openPin(a.id)}>
              <Text style={styles.rowTitle}>
                {a.name}
                {a.sub ? ` · ${a.sub}` : ''}
              </Text>
              <Text style={styles.muted}>
                {a.geo.lat.toFixed(4)}, {a.geo.lon.toFixed(4)}
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
