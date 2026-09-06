import type { StartSession } from './copyInbound';
import { PHOTO_JPEG_QUALITY, PHOTO_LONG_EDGE } from './photoKeys';
import { commitPhotoOn, stagePhotoOn } from './photos';

export async function captureAndCommitOn(
  target: { collection: 'workordersout' | 'orders'; id: string },
  session: StartSession,
): Promise<void> {
  const ImagePicker = require('expo-image-picker') as {
    requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>;
    launchCameraAsync: (opts: object) => Promise<{ canceled?: boolean; cancelled?: boolean; assets?: Array<{ uri: string; fileSize?: number }> }>;
  };
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('camera_permission');
  const shot = await ImagePicker.launchCameraAsync({
    quality: 1,
    exif: false,
    allowsEditing: false,
  });
  if (shot.canceled || shot.cancelled || !shot.assets?.[0]?.uri) return;
  let uri = shot.assets[0].uri;
  try {
    const ImageManipulator = require('expo-image-manipulator') as {
      manipulateAsync: (
        u: string,
        actions: object[],
        opts: object,
      ) => Promise<{ uri: string }>;
      SaveFormat: { JPEG: string };
    };
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: PHOTO_LONG_EDGE } }],
      { compress: PHOTO_JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    uri = resized.uri;
  } catch {
    // manipulator missing — keep camera uri (Expo Go)
  }
  const tmpId = await stagePhotoOn(target, uri, session);
  await commitPhotoOn(target, tmpId, session, {
    kind: 'during',
    byteLength: shot.assets[0].fileSize,
  });
}

export async function captureAndCommitPhoto(wooutId: string, session: StartSession): Promise<void> {
  await captureAndCommitOn({ collection: 'workordersout', id: wooutId }, session);
}

export async function captureAndCommitOrderPhoto(ordId: string, session: StartSession): Promise<void> {
  await captureAndCommitOn({ collection: 'orders', id: ordId }, session);
}
