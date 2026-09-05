import * as Application from 'expo-application';
import Constants from 'expo-constants';

/** Same string shape as audit.*.ver: `{expo.version}+{build}`. Never hard-code in UI. */
export function appVersion(): string {
  const v =
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.1.0';
  const b =
    Application.nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    (Constants.expoConfig?.android?.versionCode != null
      ? String(Constants.expoConfig.android.versionCode)
      : '1');
  return `${v}+${b}`;
}
