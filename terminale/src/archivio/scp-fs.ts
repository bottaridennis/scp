/**
 * The real SCP archive as a read-only filesystem, built on the fly from the
 * main site's API module (../src/services/scpApi.ts):
 *
 *   /archivio-scp/<Serie>/SCP-173 - The Sculpture/documento.html
 *                                                /<sezione>.html
 *                                                /allegati/immagine-1.jpg
 *
 * Only the index is loaded up front; a series' content is downloaded when one
 * of its documents is opened, then cached. Access levels come from the object
 * class (content/gioco.json → archivio). The data is public: levels here are a
 * game rule, not a protection.
 */
import { fetchScpContent, fetchScpMetadata, fetchScpNicknames, prepareContent, type SCPItem } from '../../../src/services/scpApi.ts';
import { ALL_SERIES, compareByNumber, getObjectClass, OBJECT_CLASSES, seriesLabel, UNKNOWN_CLASS } from '../../../src/lib/scp.ts';
import type { ArchiveConfig } from '../engine/types.ts';
import { basename, type Account, type DocMeta, type FileSystem, type Page, type ReadResult, type VNode } from '../engine/vfs.ts';
import { htmlToText, SECTION_REF, splitArticle, type Attachment, type Section } from './sections.ts';

type Prepared = {
  title: string;
  main: string;
  sections: Section[];
  images: Attachment[];
  author: string | null;
  credits: string | null;
};

const SPECIAL_LABELS: Record<string, string> = { archon: 'Archon', '*': 'Non classificato' };

export const DEFAULT_ARCHIVE: ArchiveConfig = {
  cartella: '/archivio-scp',
  livelli: { safe: 1, neutralized: 1, explained: 1, decommissioned: 1, euclid: 2, keter: 3, thaumiel: 4, apollyon: 4, archon: 4, 'esoteric-class': 5, '*': 5 },
  livello_sezioni: 1,
  sopra_livello: 'bloccati',
};

function cleanName(s: string) {
  return s.replace(/[\/\\]/g, '∕').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export class ScpFS implements FileSystem {
  readonly config: ArchiveConfig;
  private items: SCPItem[] = [];
  private byId = new Map<string, SCPItem>();
  private bySeries = new Map<string, SCPItem[]>();
  private seriesFolders = new Map<string, string>(); // folder name -> series key
  private loading: Promise<void> | null = null;
  private prepared = new Map<string, Promise<Prepared>>();
  private preparedDone = new Map<string, Prepared>();
  status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';

  constructor(config: ArchiveConfig | undefined) {
    this.config = { ...DEFAULT_ARCHIVE, ...(config ?? {}), livelli: { ...DEFAULT_ARCHIVE.livelli, ...(config?.livelli ?? {}) } };
  }

  get mount() {
    return this.config.cartella;
  }

  /* Index --------------------------------------------------------- */

  /** Loads the index (and nicknames) once. Throws if the archive is unreachable; retry by calling again. */
  load(): Promise<void> {
    if (!this.loading) {
      this.status = 'loading';
      this.loading = (async () => {
        const [items, names] = await Promise.all([fetchScpMetadata(), fetchScpNicknames().catch(() => new Map<string, string>())]);
        this.items = items
          .map((i) => {
            const name = names.get(i.id);
            return name && i.title === i.scp ? { ...i, title: name } : i;
          })
          .sort(compareByNumber);
        this.byId = new Map(this.items.map((i) => [i.id.toUpperCase(), i]));
        this.bySeries.clear();
        for (const item of this.items) {
          if (!this.bySeries.has(item.series)) this.bySeries.set(item.series, []);
          this.bySeries.get(item.series)!.push(item);
        }
        const order = (k: string) => {
          const i = ALL_SERIES.findIndex((s) => s.key === k);
          return i === -1 ? ALL_SERIES.length : i;
        };
        const keys = [...this.bySeries.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
        this.seriesFolders = new Map(keys.map((k) => [cleanName(seriesLabel(k)), k]));
        this.status = 'ready';
      })().catch((err) => {
        this.loading = null;
        this.status = 'error';
        throw err;
      });
    }
    return this.loading;
  }

  get ready() {
    return this.status === 'ready';
  }

  /* Levels and names --------------------------------------------- */

  classKey(item: SCPItem): string {
    const special = Object.keys(this.config.livelli).filter((k) => k !== '*' && !OBJECT_CLASSES.some((c) => c.key === k));
    const tag = special.find((k) => item.tags.includes(k));
    if (tag) return tag;
    const cls = getObjectClass(item);
    return cls === UNKNOWN_CLASS ? '*' : cls.key;
  }

  classLabel(item: SCPItem): string {
    const key = this.classKey(item);
    return OBJECT_CLASSES.find((c) => c.key === key)?.label ?? SPECIAL_LABELS[key] ?? key;
  }

  levelOf(item: SCPItem): number {
    const map = this.config.livelli;
    return Math.min(5, map[this.classKey(item)] ?? map['*'] ?? 5);
  }

  sectionLevel(item: SCPItem): number {
    return Math.min(5, this.levelOf(item) + (this.config.livello_sezioni ?? 1));
  }

  private nickname(item: SCPItem) {
    return item.title && item.title !== item.scp && item.title !== 'Titolo non disponibile' ? item.title : '';
  }

  /** Folder name; above the account's level the nickname is replaced by [CLASSIFICATO]. */
  folderName(item: SCPItem, level: number): string {
    if (this.levelOf(item) > level) return `${item.id} - [CLASSIFICATO]`;
    const nick = this.nickname(item);
    return cleanName(nick ? `${item.id} - ${nick}` : item.id);
  }

  pathOf(item: SCPItem, level = 5): string {
    return `${this.mount}/${cleanName(seriesLabel(item.series))}/${this.folderName(item, level)}`;
  }

  /** Classes readable at a level (for help texts). */
  classesForLevel(level: number): string[] {
    return Object.entries(this.config.livelli)
      .filter(([k, l]) => k !== '*' && l <= level)
      .map(([k]) => OBJECT_CLASSES.find((c) => c.key === k)?.label ?? SPECIAL_LABELS[k] ?? k);
  }

  /* Path resolution ---------------------------------------------- */

  private parse(path: string): { series?: string; item?: SCPItem; rest: string[] } | null {
    const parts = path.slice(this.mount.length).split('/').filter(Boolean);
    if (!parts.length) return { rest: [] };
    const series = this.seriesFolders.get(parts[0]);
    if (!series) return null;
    if (parts.length === 1) return { series, rest: [] };
    // The folder may be given as the full name or just the designation.
    const id = parts[1].split(' - ')[0].trim().toUpperCase();
    const item = this.byId.get(id);
    if (!item || item.series !== series) return null;
    return { series, item, rest: parts.slice(2) };
  }

  private dirNode(path: string, name: string, extra: Partial<VNode> = {}): VNode {
    return { path, name, kind: 'dir', level: 0, hidden: false, encrypted: false, locked: false, ...extra };
  }

  private itemNode(item: SCPItem, acc: Account): VNode {
    const level = this.levelOf(item);
    const locked = level > acc.level;
    return this.dirNode(this.pathOf(item, acc.level), this.folderName(item, acc.level), {
      level,
      locked,
      reason: locked ? `Livello ${level} richiesto (${this.classLabel(item)})` : undefined,
      label: locked ? '[CLASSIFICATO]' : this.classLabel(item),
    });
  }

  private fileNode(dir: string, name: string, kind: VNode['kind'], level: number, acc: Account, label?: string): VNode {
    const locked = level > acc.level;
    return { path: `${dir}/${name}`, name, kind, level, hidden: false, encrypted: false, locked, reason: locked ? `Livello ${level} richiesto` : undefined, label };
  }

  /* Content ------------------------------------------------------- */

  private prepare(item: SCPItem): Promise<Prepared> {
    let p = this.prepared.get(item.id);
    if (!p) {
      p = fetchScpContent(item)
        .then((raw) => {
          const content = prepareContent(raw, (id) => this.byId.has(id.toUpperCase()));
          const split = splitArticle(content.html, item.images);
          const nick = this.nickname(item);
          const done: Prepared = {
            title: nick ? `${item.id} — ${nick}` : item.id,
            main: split.main,
            sections: split.sections,
            images: split.images,
            author: content.author ?? item.createdBy ?? null,
            credits: content.credits,
          };
          this.preparedDone.set(item.id, done);
          return done;
        })
        .catch((err) => {
          this.prepared.delete(item.id);
          throw err;
        });
      this.prepared.set(item.id, p);
    }
    return p;
  }

  private children(item: SCPItem, prep: Prepared, dir: string, acc: Account): VNode[] {
    const level = this.levelOf(item);
    return [
      this.fileNode(dir, 'documento.html', 'html', level, acc, 'Documento principale'),
      ...prep.sections.map((s) => this.fileNode(dir, s.name, 'html', this.sectionLevel(item), acc, s.label)),
      ...(prep.images.length ? [this.dirNode(`${dir}/allegati`, 'allegati', { level, locked: level > acc.level, reason: level > acc.level ? `Livello ${level} richiesto` : undefined, label: `${prep.images.length} immagini` })] : []),
    ];
  }

  /** Rewrites links: other SCP articles and section references open in the OS. */
  private linkify(html: string, item: SCPItem, acc: Account): string {
    const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
    const root = doc.getElementById('r')!;
    const dir = this.pathOf(item, acc.level);
    root.querySelectorAll<HTMLAnchorElement>('a[href^="#/scp/"]').forEach((a) => {
      const target = this.byId.get(decodeURIComponent(a.getAttribute('href')!.slice(6)).toUpperCase());
      if (!target) return;
      a.setAttribute('href', '#');
      a.dataset.path = `${this.pathOf(target, acc.level)}/documento.html`;
    });
    root.querySelectorAll<HTMLElement>(`[${SECTION_REF}]`).forEach((p) => {
      const name = p.getAttribute(SECTION_REF)!;
      const a = doc.createElement('a');
      a.href = '#';
      a.dataset.path = `${dir}/${name}`;
      a.textContent = name;
      p.textContent = p.textContent!.replace(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
      p.append(a);
    });
    return root.innerHTML;
  }

  private meta(item: SCPItem, prep: Prepared, level: number, acc: Account, title: string): DocMeta {
    const dir = this.pathOf(item, acc.level);
    return {
      title,
      author: prep.author,
      source: item.sourceUrl,
      credits: prep.credits,
      classLabel: this.classLabel(item),
      level,
      licence: `«${item.id}»${prep.author ? ` di ${prep.author}` : ''}, dal SCP Wiki — ${item.sourceUrl} — CC BY-SA 3.0`,
      related: this.children(item, prep, dir, acc)
        .filter((n) => n.kind !== 'dir')
        .map((n) => ({ name: n.name, path: n.path, kind: n.kind, locked: n.locked }))
        .concat(prep.images.map((img) => ({ name: `allegati/${img.name}`, path: `${dir}/allegati/${img.name}`, kind: 'image' as const, locked: this.levelOf(item) > acc.level }))),
    };
  }

  /* FileSystem ---------------------------------------------------- */

  async stat(path: string, acc: Account): Promise<VNode | null> {
    if (path === this.mount) return this.dirNode(path, basename(path), { label: 'Archivio della Fondazione' });
    await this.load();
    const p = this.parse(path);
    if (!p) return null;
    if (!p.item) return this.dirNode(path, basename(path));
    const itemNode = this.itemNode(p.item, acc);
    if (!p.rest.length) return itemNode;
    const dir = this.pathOf(p.item, acc.level);
    if (itemNode.locked) {
      // Inside a locked folder only the main document's existence is admitted.
      return p.rest[0] === 'documento.html' ? this.fileNode(dir, 'documento.html', 'html', itemNode.level, acc) : { ...itemNode, path, name: basename(path) };
    }
    const prep = await this.prepare(p.item);
    const kids = this.children(p.item, prep, dir, acc);
    if (p.rest.length === 1) return kids.find((k) => k.name === p.rest[0]) ?? null;
    if (p.rest.length === 2 && p.rest[0] === 'allegati') {
      const img = prep.images.find((i) => i.name === p.rest[1]);
      return img ? this.fileNode(`${dir}/allegati`, img.name, 'image', this.levelOf(p.item), acc, img.caption) : null;
    }
    return null;
  }

  async list(path: string, acc: Account, page?: Page): Promise<{ entries: VNode[]; total: number }> {
    await this.load();
    let all: VNode[];
    if (path === this.mount) {
      all = [...this.seriesFolders].map(([folder, key]) => {
        const items = this.bySeries.get(key)!;
        const readable = items.filter((i) => this.levelOf(i) <= acc.level).length;
        return this.dirNode(`${this.mount}/${folder}`, folder, { label: `${readable}/${items.length} consultabili` });
      });
    } else {
      const p = this.parse(path);
      if (!p) return { entries: [], total: 0 };
      if (!p.item) {
        let items = this.bySeries.get(p.series!) ?? [];
        if (this.config.sopra_livello === 'nascosti') items = items.filter((i) => this.levelOf(i) <= acc.level);
        const slice = page ? items.slice(page.offset, page.offset + page.limit) : items;
        return { entries: slice.map((i) => this.itemNode(i, acc)), total: items.length };
      }
      if (this.levelOf(p.item) > acc.level) return { entries: [], total: 0 };
      const prep = await this.prepare(p.item);
      const dir = this.pathOf(p.item, acc.level);
      if (!p.rest.length) all = this.children(p.item, prep, dir, acc);
      else if (p.rest[0] === 'allegati' && p.rest.length === 1)
        all = prep.images.map((img) => this.fileNode(`${dir}/allegati`, img.name, 'image', this.levelOf(p.item!), acc, img.caption || 'Immagine'));
      else all = [];
    }
    const entries = page ? all.slice(page.offset, page.offset + page.limit) : all;
    return { entries, total: all.length };
  }

  async read(path: string, acc: Account): Promise<ReadResult> {
    await this.load();
    const p = this.parse(path);
    if (!p) return { ok: false, reason: 'missing', message: `${basename(path)}: file inesistente` };
    if (!p.item || !p.rest.length || (p.rest[0] === 'allegati' && p.rest.length === 1)) return { ok: false, reason: 'dir', message: `${basename(path)}: è una cartella` };
    const item = p.item;
    const itemLevel = this.levelOf(item);
    if (itemLevel > acc.level) return { ok: false, reason: 'denied', message: `ACCESSO NEGATO — ${item.id} è classificato ${this.classLabel(item)}: Livello ${itemLevel} richiesto` };
    let prep: Prepared;
    try {
      prep = await this.prepare(item);
    } catch (err) {
      return { ok: false, reason: 'error', message: `Connessione all’archivio centrale fallita (${(err as Error).message}). Riprova.` };
    }
    const name = p.rest[p.rest.length - 1];
    if (p.rest[0] === 'allegati') {
      const img = prep.images.find((i) => i.name === name);
      if (!img) return { ok: false, reason: 'missing', message: `${name}: file inesistente` };
      return { ok: true, kind: 'image', src: img.src, caption: img.caption || `${item.id} — ${name}`, meta: this.meta(item, prep, itemLevel, acc, prep.title) };
    }
    if (name === 'documento.html') {
      const html = this.linkify(prep.main, item, acc);
      return { ok: true, kind: 'html', html, text: htmlToText(html), meta: this.meta(item, prep, itemLevel, acc, prep.title) };
    }
    const section = prep.sections.find((s) => s.name === name);
    if (!section) return { ok: false, reason: 'missing', message: `${name}: file inesistente` };
    const level = this.sectionLevel(item);
    if (level > acc.level) return { ok: false, reason: 'denied', message: `ACCESSO NEGATO — ${section.label}: Livello ${level} richiesto` };
    const html = this.linkify(section.html, item, acc);
    return { ok: true, kind: 'html', html, text: htmlToText(html), meta: this.meta(item, prep, level, acc, `${prep.title} · ${section.label}`) };
  }

  names(dir: string, acc: Account): string[] {
    if (!this.ready) {
      void this.load().catch(() => {});
      return [];
    }
    if (dir === this.mount) return [...this.seriesFolders.keys()].map((f) => `${f}/`);
    const p = this.parse(dir);
    if (!p) return [];
    if (!p.item) {
      let items = this.bySeries.get(p.series!) ?? [];
      if (this.config.sopra_livello === 'nascosti') items = items.filter((i) => this.levelOf(i) <= acc.level);
      return items.map((i) => `${this.folderName(i, acc.level)}/`);
    }
    if (this.levelOf(p.item) > acc.level) return [];
    const prep = this.preparedDone.get(p.item.id);
    if (!prep) {
      void this.prepare(p.item).catch(() => {});
      return p.rest.length ? [] : ['documento.html'];
    }
    if (!p.rest.length) return ['documento.html', ...prep.sections.map((s) => s.name), ...(prep.images.length ? ['allegati/'] : [])];
    if (p.rest[0] === 'allegati') return prep.images.map((i) => i.name);
    return [];
  }
}
