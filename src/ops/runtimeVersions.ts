import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isCblNativeAvailable } from '../db/native';
import { appVersion } from '../version';

export type RuntimeVersions = {
  app: string;
  expoSdk: string;
  reactNative: string;
  hermes: boolean;
  cblJs: string;
  cblNative: 'linked' | 'missing';
  os: string;
  osVersion: string;
};

function cblJsVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('cbl-reactnative/package.json') as { version?: string };
    return pkg.version?.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function reactNativeVersion(): string {
  const rn = (
    Platform.constants as { reactNativeVersion?: { major: number; minor: number; patch: number } } | undefined
  )?.reactNativeVersion;
  if (rn && typeof rn.major === 'number') return `${rn.major}.${rn.minor}.${rn.patch}`;
  return 'unknown';
}

export function runtimeVersions(): RuntimeVersions {
  const hermes = typeof (globalThis as { HermesInternal?: unknown }).HermesInternal !== 'undefined';
  return {
    app: appVersion(),
    expoSdk: String(Constants.expoConfig?.sdkVersion ?? Constants.expoConfig?.version ?? '52'),
    reactNative: reactNativeVersion(),
    hermes,
    cblJs: cblJsVersion(),
    cblNative: isCblNativeAvailable() ? 'linked' : 'missing',
    os: Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS,
    osVersion: String(Platform.Version),
  };
}

export function formatEpoch(sec?: number): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return 'never';
  try {
    return new Date(sec * 1000).toLocaleString();
  } catch {
    return String(sec);
  }
}
