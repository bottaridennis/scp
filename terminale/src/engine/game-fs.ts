/** The encrypted story filesystem exposed through the common FileSystem interface. */
import { GUEST } from './game.ts';
import type { FileEntry } from './types.ts';
import { basename, kindOf, Tree, type Account, type FileProps, type FileSystem, type Page, type ReadResult, type VNode } from './vfs.ts';

export class GameFS implements FileSystem {
  /** Folders mounted by other filesystems, listed in their parent. */
  mountPoints: () => string[] = () => [];
  /** Called after a document has been read successfully (drives events). */
  onRead: (path: string) => void = () => {};

  private tree(acc: Account) {
    const dirs = [...acc.users.map((u) => acc.homeOf(u)), ...this.mountPoints()];
    return new Tree(acc.allFiles(), dirs);
  }

  private foreignHome(path: string, acc: Account): string | null {
    const m = path.match(/^\/home\/([^/]+)/);
    if (!m || m[1] === acc.user) return null;
    return m[1];
  }

  private fileNode(f: FileEntry, acc: Account): VNode {
    const name = basename(f.p);
    const tooHigh = !acc.canRead(f);
    return {
      path: f.p,
      name,
      kind: kindOf(name),
      level: f.l,
      hidden: name.startsWith('.'),
      encrypted: f.e && !acc.isUnlocked(f),
      locked: tooHigh,
      reason: tooHigh ? `Livello ${f.l} richiesto` : undefined,
      size: f.s,
    };
  }

  private dirNode(path: string, acc: Account): VNode {
    const owner = this.foreignHome(path, acc);
    const name = basename(path);
    return {
      path,
      name,
      kind: 'dir',
      level: 0,
      hidden: name.startsWith('.'),
      encrypted: false,
      locked: Boolean(owner),
      reason: owner ? `area personale di ${owner}` : undefined,
    };
  }

  async stat(path: string, acc: Account): Promise<VNode | null> {
    const tree = this.tree(acc);
    if (tree.isDir(path)) return this.dirNode(path, acc);
    const f = tree.file(path);
    if (f) return this.fileNode(f, acc);
    // Files in another user's home are not in this account's tree.
    if (this.foreignHome(path, acc)) return { ...this.dirNode(path, acc), kind: kindOf(path), name: basename(path) };
    return null;
  }

  async list(path: string, acc: Account, page?: Page) {
    const tree = this.tree(acc);
    if (!tree.isDir(path) || this.foreignHome(path, acc)) return { entries: [], total: 0 };
    const all = tree.list(path).map((e) => (e.dir ? this.dirNode(e.path, acc) : this.fileNode(e.file!, acc)));
    const entries = page ? all.slice(page.offset, page.offset + page.limit) : all;
    return { entries, total: all.length };
  }

  names(dir: string, acc: Account): string[] {
    const tree = this.tree(acc);
    if (!tree.isDir(dir) || this.foreignHome(dir, acc)) return [];
    return tree.list(dir).map((e) => (e.dir ? `${e.name}/` : e.name));
  }

  async read(path: string, acc: Account): Promise<ReadResult> {
    const owner = this.foreignHome(path, acc);
    if (owner) return { ok: false, reason: 'denied', message: `ACCESSO NEGATO — area personale di ${owner}` };
    const tree = this.tree(acc);
    if (tree.isDir(path)) return { ok: false, reason: 'dir', message: `${basename(path)}: è una cartella` };
    const f = tree.file(path);
    if (!f) return { ok: false, reason: 'missing', message: `${basename(path)}: file inesistente` };
    const res = await acc.read(f);
    if (res.status === 'denied') return { ok: false, reason: 'denied', message: `ACCESSO NEGATO — Livello ${res.level} richiesto` };
    if (res.status === 'encrypted') return { ok: false, reason: 'encrypted', message: `${basename(path)}: file cifrato. Usa: decrypt ${basename(path)} <chiave>` };
    this.onRead(path);
    if (kindOf(path) === 'image') return { ok: true, kind: 'image', src: res.text, caption: res.meta?.didascalia ?? basename(path) };
    return { ok: true, kind: 'text', text: res.text, props: res.meta };
  }

  async props(path: string, acc: Account): Promise<FileProps | null> {
    const f = this.entry(path, acc);
    if (!f) return null;
    const res = await acc.read(f);
    return res.status === 'ok' ? { autore: res.meta?.autore, modificato: res.meta?.modificato } : null;
  }

  /** The FileEntry behind a path, for `decrypt`. */
  entry(path: string, acc: Account): FileEntry | undefined {
    if (this.foreignHome(path, acc)) return undefined;
    return this.tree(acc).file(path);
  }

  home(acc: Account) {
    return acc.user === GUEST ? '/' : acc.homeOf(acc.user);
  }
}
