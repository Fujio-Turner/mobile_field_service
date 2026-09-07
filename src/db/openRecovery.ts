/** After open at `wantedEncrypt` failed, try these modes so we can instance-delete the leftover file. */
export function mismatchRecoveryModes(wantedEncrypt: boolean, hasStoredKey: boolean): boolean[] {
  if (!wantedEncrypt && hasStoredKey) return [true];
  if (wantedEncrypt) return [false];
  return [];
}

export function cblite2Folder(directory: string, name: string): string {
  return `${directory.replace(/\/$/, '')}/${name}.cblite2`;
}
