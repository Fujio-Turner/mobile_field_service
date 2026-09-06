import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AssetItem } from '@/src/ops/assets';
import { visibleBoundsToBBox, type BBox } from '@/src/geo/haversine';
import { mapStyleUrl } from '@/src/geo/mapStyle';
import { mapLibreNativeAvailable } from '@/src/ui/mapLibreNative';
import { theme } from '@/src/theme';

type ML = {
  MapView: ComponentType<Record<string, unknown>>;
  Camera: ComponentType<Record<string, unknown>>;
  ShapeSource: ComponentType<Record<string, unknown>>;
  CircleLayer: ComponentType<Record<string, unknown>>;
  SymbolLayer: ComponentType<Record<string, unknown>>;
  UserLocation: ComponentType<Record<string, unknown>>;
};

let mapLibreCache: ML | null | undefined;

function loadMapLibre(): ML | null {
  if (mapLibreCache !== undefined) return mapLibreCache;
  if (!mapLibreNativeAvailable()) {
    mapLibreCache = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mapLibreCache = require('@maplibre/maplibre-react-native') as ML;
    return mapLibreCache;
  } catch {
    mapLibreCache = null;
    return null;
  }
}

export function canRenderLibreMap(): boolean {
  return loadMapLibre() != null;
}

type Props = {
  assets: AssetItem[];
  center: { lat: number; lon: number };
  zoomLevel?: number;
  showUser?: boolean;
  onPressAsset: (id: string) => void;
  onRegion?: (box: BBox, zoom: number) => void;
};

export function LibreAssetMap({ assets, center, zoomLevel = 14, showUser, onPressAsset, onRegion }: Props) {
  const ml = loadMapLibre();
  if (!ml) return null;
  const { MapView, Camera, ShapeSource, CircleLayer, SymbolLayer, UserLocation } = ml;
  const shape = {
    type: 'FeatureCollection',
    features: assets.map((a) => ({
      type: 'Feature',
      id: a.id,
      properties: { id: a.id, name: a.name, code: a.code ?? '', assetType: a.assetType },
      geometry: { type: 'Point', coordinates: [a.geo.lon, a.geo.lat] },
    })),
  };

  return (
    <View style={styles.map}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        mapStyle={mapStyleUrl()}
        compassEnabled
        attributionPosition={{ bottom: 8, right: 8 }}
        onRegionDidChange={(feature: {
          properties?: { visibleBounds?: [number[], number[]]; zoomLevel?: number };
        }) => {
          const bounds = feature.properties?.visibleBounds;
          if (!bounds || !onRegion) return;
          onRegion(visibleBoundsToBBox(bounds[0], bounds[1]), Number(feature.properties?.zoomLevel ?? zoomLevel));
        }}
      >
        <Camera
          defaultSettings={{
            centerCoordinate: [center.lon, center.lat],
            zoomLevel,
          }}
        />
        {showUser ? <UserLocation visible /> : null}
        <ShapeSource
          id="assets"
          shape={shape}
          cluster
          clusterRadius={50}
          clusterMaxZoomLevel={14}
          onPress={(e: { features?: Array<{ properties?: Record<string, unknown> }> }) => {
            const f = e.features?.[0];
            const props = f?.properties ?? {};
            if (props.cluster) return;
            const id = String(props.id ?? '');
            if (id) onPressAsset(id);
          }}
        >
          <CircleLayer
            id="asset-clusters"
            filter={['has', 'point_count']}
            style={{
              circleColor: theme.color.accent,
              circleRadius: 18,
              circleOpacity: 0.9,
            }}
          />
          <SymbolLayer
            id="asset-cluster-count"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count'],
              textSize: 12,
              textColor: theme.color.onAccent,
              textIgnorePlacement: true,
              textAllowOverlap: true,
            }}
          />
          <CircleLayer
            id="asset-points"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleColor: theme.color.accent,
              circleRadius: 8,
              circleStrokeWidth: 2,
              circleStrokeColor: theme.color.onAccent,
            }}
          />
        </ShapeSource>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { minHeight: 220, height: 280, borderRadius: theme.radius, overflow: 'hidden', marginBottom: theme.space.md },
});
