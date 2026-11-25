/**
 * Crypto primitives shared by the Node build script and the browser.
 * Both use the standard Web Crypto API (globalThis.crypto.subtle).
 */
import type { Envelope, Sealed } from './types.ts';

const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Passwords, keys and command phrases are case- and spacing-insensitive. */
export function normalizeSecret(s: string): string {
  return s.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function sha256(text: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await subtle.digest('SHA-256', encoder.encode(text)));
}

export async function sha256Hex(text: string): Promise<string> {
  return Array.from(await sha256(text), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Salts are public and deterministic so that keys stay valid across rebuilds. */
export async function saltFor(gameId: string, scope: string): Promise<Uint8Array<ArrayBuffer>> {
  return (await sha256(`${gameId}|salt|${scope}`)).slice(0, 16);
}

export async function deriveKey(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await subtle.importKey('raw', encoder.encode(normalizeSecret(secret)), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export function importRawKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function exportRawKey(key: CryptoKey): Promise<string> {
  return toB64(new Uint8Array(await subtle.exportKey('raw', key)));
}

export async function encryptText(key: CryptoKey, text: string): Promise<Envelope> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text)));
  return { iv: toB64(iv), ct: toB64(ct) };
}

/** Throws if the key is wrong (AES-GCM authentication fails). */
export async function decryptText(key: CryptoKey, env: Envelope): Promise<string> {
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(env.iv) }, key, fromB64(env.ct));
  return decoder.decode(plain);
}

/** Encrypts raw bytes as iv (12 bytes) followed by the AES-GCM ciphertext. */
export async function encryptBytes(key: CryptoKey, bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

/** Throws if the key is wrong. */
export async function decryptBytes(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  return subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12));
}

export function isEnvelope(x: unknown): x is Envelope {
  return typeof x === 'object' && x !== null && 'iv' in x && 'ct' in x;
}

/** Seals a value in layers: keys[0] is the innermost layer, the last key the outermost. */
export async function seal<T>(value: T, keys: CryptoKey[]): Promise<Sealed<T>> {
  let current: Sealed<T> = { p: value };
  for (const key of keys) current = await encryptText(key, JSON.stringify(current));
  return current;
}

/**
 * Opens one layer at a time. `keyFor(depth)` returns the key for the next layer
 * (0 = outermost) or null when it is not available.
 * Returns { value } when fully opened, { lockedAt } when a key is missing.
 */
export async function open<T>(
  sealed: Sealed<T>,
  keyFor: (depth: number) => CryptoKey | null | Promise<CryptoKey | null>,
): Promise<{ value: T } | { lockedAt: number }> {
  let current: Sealed<T> = sealed;
  let depth = 0;
  while (isEnvelope(current)) {
    const key = await keyFor(depth);
    if (!key) return { lockedAt: depth };
    current = JSON.parse(await decryptText(key, current)) as Sealed<T>;
    depth++;
  }
  return { value: current.p };
}
