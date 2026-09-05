export function dbKeyItem(employeeId: string): string {
  return `mfs.dbkey.${employeeId}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
