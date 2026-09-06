import { DEFAULT_DB_ENCRYPTION, parseDbEncryptionFlag } from '../../src/dev/dbEncryption';

describe('db encryption flag', () => {
  it('defaults off', () => {
    expect(DEFAULT_DB_ENCRYPTION).toBe(false);
    expect(parseDbEncryptionFlag(null)).toBe(false);
    expect(parseDbEncryptionFlag('')).toBe(false);
    expect(parseDbEncryptionFlag('0')).toBe(false);
  });

  it('is on only for 1 or true', () => {
    expect(parseDbEncryptionFlag('1')).toBe(true);
    expect(parseDbEncryptionFlag('true')).toBe(true);
  });
});
