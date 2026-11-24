/** Path helpers and the directory tree built from the visible files. */
import type { FileEntry } from './types.ts';

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
