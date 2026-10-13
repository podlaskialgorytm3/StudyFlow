import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '@/lib/crypto/encryption';

describe('OAuth Token Encryption (AES-256-GCM)', () => {
  it('correctly encrypts and decrypts OAuth tokens', () => {
    const originalToken = 'ya29.a0AfH6SMD_example_google_access_token_1234567890';
    const encrypted = encryptToken(originalToken);

    expect(encrypted).not.toBe(originalToken);
    expect(encrypted).toContain(':');

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(originalToken);
  });

  it('produces unique ciphertexts for identical inputs due to random IVs', () => {
    const token = 'same_refresh_token_value_abc';
    const encrypted1 = encryptToken(token);
    const encrypted2 = encryptToken(token);

    expect(encrypted1).not.toBe(encrypted2);
    expect(decryptToken(encrypted1)).toBe(token);
    expect(decryptToken(encrypted2)).toBe(token);
  });

  it('handles empty strings safely', () => {
    expect(encryptToken('')).toBe('');
    expect(decryptToken('')).toBe('');
  });

  it('fails decryption when ciphertext is tampered with', () => {
    const token = 'secret_refresh_token_to_protect';
    const encrypted = encryptToken(token);
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);

    // Tamper with ciphertext by flipping characters
    const tamperedCiphertext = parts[2].slice(0, -2) + 'ff';
    const tamperedToken = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

    expect(() => decryptToken(tamperedToken)).toThrow();
  });

  it('fails decryption when authentication tag is tampered with', () => {
    const token = 'secret_refresh_token_to_protect';
    const encrypted = encryptToken(token);
    const parts = encrypted.split(':');

    // Tamper with auth tag
    const tamperedTag = parts[1].replace(/^[0-9a-f]/, '0');
    const tamperedToken = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    expect(() => decryptToken(tamperedToken)).toThrow();
  });

  it('rejects invalid encrypted token format without 3 parts', () => {
    expect(() => decryptToken('invalid-format-without-colons')).toThrow('Invalid encrypted token format');
    expect(() => decryptToken('part1:part2')).toThrow('Invalid encrypted token format');
    expect(() => decryptToken('part1:part2:part3:part4')).toThrow('Invalid encrypted token format');
  });
});

