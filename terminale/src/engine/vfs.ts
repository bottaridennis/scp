/**
 * Virtual filesystem: the common interface used by the terminal and the
 * file explorer, the router that mounts several filesystems, and helpers.
 *
 *   MountFS ─┬─ "/"             GameFS   (encrypted story of the game)
 *            └─ "/archivio-scp" ScpFS    (real SCP archive, see src/archivio)
 */
import type { Game } from './game.ts';
import type { FileEntry } from './types.ts';

/** Whoever is looking at the filesystem: a desktop session or a terminal. */
export type Account = Game;

export type NodeKind = 'dir' | 'text' | 'html' | 'image';

export type VNode = {
  path: string;
  name: string;
  kind: NodeKind;
  /** Minimum access level. */
  level: number;
  /** Name starts with "." (hidden in the explorer and in `ls` without -a). */
  hidden: boolean;
  /** Needs `decrypt` before it can be read. */
  encrypted: boolean;
  /** The current account may not open it (level or ownership). */
  locked: boolean;
  /** Why it is locked, e.g. "Livello 3 richiesto". */
  reason?: string;
  /** Text shown instead of the name details, e.g. class or [CLASSIFICATO]. */
  label?: string;
  /** Size in characters, when known. */
  size?: number;
};

export type DocMeta = {
  title: string;
  author?: string | null;
  source?: string;
  credits?: string | null;
  licence?: string;
  classLabel?: string;
  level?: number;
  /** Other files in the same folder (sections, attachments). */
  related?: { name: string; path: string; kind: NodeKind; locked: boolean }[];
};

/** Properties of a file ("Proprietà", `stat`). */
export type FileProps = { autore?: string; modificato?: string };

export type ReadResult =
  | { ok: true; kind: 'text'; text: string; props?: FileProps }
  | { ok: true; kind: 'html'; html: string; text: string; meta: DocMeta }
  | { ok: true; kind: 'image'; src: string; caption: string; meta?: DocMeta }
  | { ok: false; reason: 'denied'; message: string }
  | { ok: false; reason: 'encrypted'; message: string }
  | { ok: false; reason: 'missing' | 'error' | 'dir'; message: string };

export type Page = { offset: number; limit: number };

export interface FileSystem {
  stat(path: string, acc: Account): Promise<VNode | null>;
  list(path: string, acc: Account, page?: Page): Promise<{ entries: VNode[]; total: number }>;
  read(path: string, acc: Account): Promise<ReadResult>;
  /** Synchronous child names of a directory ("name/" for folders), for Tab completion. */
  names(dir: string, acc: Account): string[];
  /** Author/date properties, if the account may read the file (does not count as reading it). */
  props?(path: string, acc: Account): Promise<FileProps | null>;
}

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

export function normalizePath(input: string, cwd: string, home: string): string {
  let p = input.trim();
  if (p === '~' || p.startsWith('~/')) p = home + p.slice(1);
  const parts = (p.startsWith('/') ? p : `${cwd}/${p}`).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return '/' + out.join('/');
}

export function basename(path: string) {
  return path.split('/').filter(Boolean).pop() ?? '/';
}

export function dirname(path: string) {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return '/' + parts.join('/');
}

export function kindOf(name: string): NodeKind {
  if (/\.(html?)$/i.test(name)) return 'html';
  if (/\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(name)) return 'image';
  return 'text';
}

/* ------------------------------------------------------------------ */
/* Mount router                                                        */
/* ------------------------------------------------------------------ */

export class MountFS implements FileSystem {
  private mounts: { at: string; fs: FileSystem }[] = [];

  constructor(root: FileSystem) {
    this.mounts.push({ at: '/', fs: root });
  }

  mount(at: string, fs: FileSystem) {
    this.mounts.push({ at, fs });
    this.mounts.sort((a, b) => b.at.length - a.at.length);
  }

  /** Mount points other than "/" (shown as folders in their parent). */
  get points(): string[] {
    return this.mounts.filter((m) => m.at !== '/').map((m) => m.at);
  }

  route(path: string): FileSystem {
    for (const m of this.mounts) {
      if (m.at === '/' || path === m.at || path.startsWith(`${m.at}/`)) return m.fs;
    }
    return this.mounts[this.mounts.length - 1].fs;
  }

  stat(path: string, acc: Account) {
    return this.route(path).stat(path, acc);
  }

  list(path: string, acc: Account, page?: Page) {
    return this.route(path).list(path, acc, page);
  }

  read(path: string, acc: Account) {
    return this.route(path).read(path, acc);
  }

  names(dir: string, acc: Account) {
    return this.route(dir).names(dir, acc);
  }

  async props(path: string, acc: Account) {
    const fs = this.route(path);
    return fs.props ? fs.props(path, acc) : null;
  }
}

/* ------------------------------------------------------------------ */
/* In-memory tree of game files                                        */
/* ------------------------------------------------------------------ */

export type DirEntry = { name: string; dir: boolean; file?: FileEntry; path: string };

export class Tree {
  private dirs = new Set<string>(['/']);
  private files = new Map<string, FileEntry>();

  constructor(files: FileEntry[], extraDirs: string[] = []) {
    for (const f of files) {
      this.files.set(f.p, f);
      this.addParents(f.p);
    }
    for (const d of extraDirs) {
      this.dirs.add(d);
      this.addParents(d);
    }
  }

  private addParents(p: string) {
    const parts = p.split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i++) this.dirs.add('/' + parts.slice(0, i).join('/'));
  }

  isDir(p: string) {
    return this.dirs.has(p);
  }

  file(p: string) {
    return this.files.get(p);
  }

  list(dir: string): DirEntry[] {
    const prefix = dir === '/' ? '/' : `${dir}/`;
    const seen = new Map<string, DirEntry>();
    for (const d of this.dirs) {
      if (d !== dir && d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) {
        seen.set(d, { name: d.slice(prefix.length), dir: true, path: d });
      }
    }
    for (const [p, f] of this.files) {
      if (p.startsWith(prefix) && !p.slice(prefix.length).includes('/')) {
        seen.set(p, { name: p.slice(prefix.length), dir: false, file: f, path: p });
      }
    }
    return [...seen.values()].sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
  }

  allFiles() {
    return [...this.files.values()];
  }
}
