export function dbKeyItem(employeeId: string): string {
  return `mfs.dbkey.${employeeId}`;
}

/** Native CBL unique open-name (name + nanoId). Used to close leftover handles after Fast Refresh. */
export function cblUniqueItem(employeeId: string): string {
  return `mfs.cbluid.${employeeId}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
