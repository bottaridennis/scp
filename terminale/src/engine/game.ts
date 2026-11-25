/**
 * Game data and keys: loads the encrypted archive, handles login, access
 * levels, `decrypt` keys and renders censored documents.
 */
import {
  decryptText,
  deriveKey,
  exportRawKey,
  fromB64,
  importRawKey,
  open,
  saltFor,
} from './crypto-core.ts';
import type { DocBody, DocMeta, EventEntry, EventPayload, FileEntry, Keyring, MailEntry, Manifest } from './types.ts';
import type { Store } from './state.ts';

export const GUEST = 'ospite';

export type ReadResult =
  | { status: 'ok'; text: string; meta?: DocMeta }
  | { status: 'denied'; level: number }
  | { status: 'encrypted' };

export class Game {
  readonly manifest: Manifest;
  readonly store: Store;
  user = GUEST;
  keyring: Keyring | null = null;
  private levelKeys = new Map<number, CryptoKey>();
  /** Imported `decrypt` keys, shared through the store by every account. */
  private fileKeys = new Map<string, CryptoKey>();
  private segmentCache = new Map<string, string>();

  constructor(manifest: Manifest, store: Store) {
    this.manifest = manifest;
    this.store = store;
  }

  static async load(url: string): Promise<Manifest> {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Manifest;
  }

  get level(): number {
    return this.keyring?.livello ?? 0;
  }

  get users(): string[] {
    return this.manifest.utenti.map((u) => u.n);
  }

  hasUser(name: string) {
    return this.manifest.utenti.some((u) => u.n === name);
  }

  hasStoredKey(name: string) {
    return Boolean(this.store.state.userKeys[name]);
  }

  private async openKeyring(name: string, key: CryptoKey): Promise<Keyring | null> {
    const entry = this.manifest.utenti.find((u) => u.n === name);
    if (!entry) return null;
    try {
      return JSON.parse(await decryptText(key, entry.k)) as Keyring;
    } catch {
      return null;
    }
  }

  private async activate(name: string, keyring: Keyring) {
    this.user = name;
    this.keyring = keyring;
    this.levelKeys.clear();
    for (const [l, b64] of Object.entries(keyring.chiavi)) {
      this.levelKeys.set(Number(l), await importRawKey(fromB64(b64)));
    }
    this.segmentCache.clear();
  }

  async unlockWithStoredKey(name: string): Promise<boolean> {
    const b64 = this.store.state.userKeys[name];
    if (!b64) return false;
    try {
      const keyring = await this.openKeyring(name, await importRawKey(fromB64(b64)));
      if (!keyring) throw new Error('stale');
      await this.activate(name, keyring);
      return true;
    } catch {
      delete this.store.state.userKeys[name];
      this.store.save();
      return false;
    }
  }

  async login(name: string, password: string): Promise<boolean> {
    const key = await deriveKey(password, await saltFor(this.manifest.id, `utente:${name}`), this.manifest.iter);
    const keyring = await this.openKeyring(name, key);
    if (!keyring) return false;
    this.store.state.userKeys[name] = await exportRawKey(key);
    await this.activate(name, keyring);
    return true;
  }

  logout() {
    this.user = GUEST;
    this.keyring = null;
    this.levelKeys.clear();
    this.segmentCache.clear();
  }

  levelLabel(level: number): string {
    return this.manifest.meta.livelli[String(level)] ?? `Livello ${level}`;
  }

  /* Files --------------------------------------------------------- */

  /** Every file visible to the current user: public tree plus own home. */
  allFiles(): FileEntry[] {
    const fired = this.store.state.fired;
    return [...this.manifest.files, ...(this.keyring?.home ?? [])].filter((f) => !f.v || fired.includes(f.v));
  }

  /** Whether a user appears on the login screen (hidden profiles only after a first login). */
  isListed(name: string) {
    const u = this.manifest.utenti.find((x) => x.n === name);
    return Boolean(u) && (!u!.h || this.store.state.logins.includes(name));
  }

  homeOf(user: string) {
    return `/home/${user}`;
  }

  canRead(entry: { l: number }) {
    return entry.l <= this.level;
  }

  isUnlocked(entry: FileEntry) {
    return !entry.e || Boolean(this.store.state.fileKeys[entry.p]);
  }

  /** Imports (once) a `decrypt` key saved by any account. */
  private async fileKey(path: string): Promise<CryptoKey | null> {
    const b64 = this.store.state.fileKeys[path];
    if (!b64) return null;
    let key = this.fileKeys.get(path);
    if (!key) {
      key = await importRawKey(fromB64(b64));
      this.fileKeys.set(path, key);
    }
    return key;
  }

  private async keyForLayer(entry: { l: number; e?: boolean; p?: string }, depth: number): Promise<CryptoKey | null> {
    const layers: ('level' | 'file')[] = [];
    if (entry.l >= 1) layers.push('level');
    if (entry.e) layers.push('file');
    const kind = layers[depth];
    if (kind === 'level') return this.level >= entry.l ? (this.levelKeys.get(entry.l) ?? null) : null;
    if (kind === 'file') return entry.p ? this.fileKey(entry.p) : null;
    return null;
  }

  async read(entry: FileEntry): Promise<ReadResult> {
    if (!this.canRead(entry)) return { status: 'denied', level: entry.l };
    if (entry.e && !this.isUnlocked(entry)) return { status: 'encrypted' };
    try {
      const res = await open<DocBody>(entry.b, (d) => this.keyForLayer(entry, d));
      if ('lockedAt' in res) return entry.e ? { status: 'encrypted' } : { status: 'denied', level: entry.l };
      return { status: 'ok', text: await this.renderBody(res.value), meta: res.value.m };
    } catch {
      // Stored decrypt key no longer valid (content rebuilt).
      if (entry.e) {
        this.fileKeys.delete(entry.p);
        delete this.store.state.fileKeys[entry.p];
        this.store.save();
        return { status: 'encrypted' };
      }
      return { status: 'denied', level: entry.l };
    }
  }

  /** Tries a `decrypt` key on a file. Returns true and remembers the key on success. */
  async decrypt(entry: FileEntry, secret: string): Promise<boolean> {
    const key = await deriveKey(secret, await saltFor(this.manifest.id, `file:${entry.p}`), this.manifest.iter);
    try {
      const res = await open<DocBody>(entry.b, (d) =>
        entry.l >= 1 && d === 0 ? (this.levelKeys.get(entry.l) ?? null) : key,
      );
      if ('lockedAt' in res) return false;
    } catch {
      return false;
    }
    this.fileKeys.set(entry.p, key);
    this.store.state.fileKeys[entry.p] = await exportRawKey(key);
    this.store.save();
    return true;
  }

  async readMail(mail: MailEntry): Promise<string> {
    const res = await open<DocBody>(mail.b, () => (this.level >= mail.l ? this.levelKeys.get(mail.l) ?? null : null));
    if ('lockedAt' in res) return '[MESSAGGIO CIFRATO — livello insufficiente]';
    return this.renderBody(res.value);
  }

  visibleMail(): MailEntry[] {
    const fired = this.store.state.fired;
    return (this.keyring?.posta ?? []).filter((m) => !m.dopo || fired.includes(m.dopo));
  }

  /** Replaces censorship markers with the text or with redaction marks. */
  async renderBody(body: DocBody): Promise<string> {
    const parts = body.t.split('\u0001');
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        out += parts[i];
        continue;
      }
      const seg = body.g[Number(parts[i])];
      if (!seg) continue;
      const key = this.level >= seg.l ? this.levelKeys.get(seg.l) : undefined;
      let text: string | null = null;
      if (key) {
        const cacheKey = seg.d.ct;
        text = this.segmentCache.get(cacheKey) ?? null;
        if (text === null) {
          try {
            text = await decryptText(key, seg.d);
            this.segmentCache.set(cacheKey, text);
          } catch {
            text = null;
          }
        }
      }
      out += text ?? (seg.x ? '[DATI ELIMINATI]' : '█'.repeat(Math.max(1, seg.n)));
    }
    return out;
  }

  /* Events -------------------------------------------------------- */

  /** Opens an event payload with the current keys (plus a command key). */
  async openEvent(ev: EventEntry, cmdKey?: CryptoKey): Promise<EventPayload | null> {
    try {
      const res = await open<EventPayload>(ev.b, (d) => {
        if (ev.l >= 1 && d === 0) return this.level >= ev.l ? (this.levelKeys.get(ev.l) ?? null) : null;
        return cmdKey ?? null;
      });
      return 'value' in res ? res.value : null;
    } catch {
      return null;
    }
  }

  async commandKey(ev: EventEntry, phrase: string): Promise<CryptoKey> {
    return deriveKey(phrase, await saltFor(this.manifest.id, `cmd:${ev.id}`), this.manifest.iter);
  }
}
