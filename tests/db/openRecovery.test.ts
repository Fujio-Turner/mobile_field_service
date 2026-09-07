import { cblite2Folder, mismatchRecoveryModes } from '../../src/db/openRecovery';
import { cblUniqueItem, dbKeyItem } from '../../src/session/dbKeyCodec';

describe('open recovery', () => {
  it('tries the stored key when encryption is off', () => {
    expect(mismatchRecoveryModes(false, true)).toEqual([true]);
    expect(mismatchRecoveryModes(false, false)).toEqual([]);
  });

  it('tries unencrypted when encryption is on', () => {
    expect(mismatchRecoveryModes(true, true)).toEqual([false]);
    expect(mismatchRecoveryModes(true, false)).toEqual([false]);
  });

  it('joins the cblite2 folder', () => {
    expect(cblite2Folder('/tmp/support/', 'mfs_E-4412_abcd')).toBe('/tmp/support/mfs_E-4412_abcd.cblite2');
  });

  it('names the leftover unique handle separately from the encryption key', () => {
    expect(cblUniqueItem('E-4412')).toBe('mfs.cbluid.E-4412');
    expect(cblUniqueItem('E-4412')).not.toBe(dbKeyItem('E-4412'));
  });
});
