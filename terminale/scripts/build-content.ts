/**
 * Builds the encrypted game archive.
 *
 *   content/  (plain text, never published)  →  public/data/archivio.json
 *
 * Everything above level 0 is encrypted with AES-GCM. Level keys are derived
 * from the `segreto` in content/gioco.json; each user's keyring (level keys,
 * private files, mail) is encrypted with a key derived via PBKDF2 from the
 * user's password. Encrypted files get an extra layer keyed with PBKDF2 of the
 * `chiave` the player must find. See README.md.
 *
 * Run with: npm run build:content
 */
import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveKey,
  encryptText,
  importRawKey,
  normalizeSecret,
  saltFor,
  seal,
  sha256Hex,
} from '../src/engine/crypto-core.ts';
import type {
  DocBody,
  EventEntry,
  EventKind,
  EventPayload,
  FileEntry,
  Keyring,
  MailEntry,
  Manifest,
  Segment,
  ArchiveConfig,
  CameraEntry,
  RadioEntry,
  VoiceEntry,
  Sealed,
} from '../src/engine/types.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const OUT_FILE = path.join(OUT_DIR, 'archivio.json');

const MAX_LEVEL = 5;
const EVENT_KINDS: EventKind[] = ['sistema', 'intruso', 'glitch', 'finale'];

type GameConfig = {
  id: string;
  titolo: string;
  host: string;
  segreto: string;
  iterazioni: number;
  livelli: Record<string, string>;
  utenti: { nome: string; nome_completo: string; ruolo: string; livello: number; password: string; nascosto?: boolean }[];
  logo: string[];
  boot: string[];
  intro?: { titolo: string; testo: string[] };
  crediti: string[];
  archivio?: ArchiveConfig;
};

type Front = Record<string, string | number | boolean>;

class ContentError extends Error {}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function parseValue(raw: string): string | number | boolean {
  let v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  v = v.replace(/\s+#.*$/, '').trim(); // trailing comment
  if (/^(sì|si|yes|true)$/i.test(v)) return true;
  if (/^(no|false)$/i.test(v)) return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/** Minimal frontmatter parser: `key: value` lines between --- fences. */
export function parseFrontmatter(source: string, file: string): { front: Front; body: string } {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) return { front: {}, body: text.trim() };
  const end = text.indexOf('\n---', 4);
  if (end === -1) throw new ContentError(`${file}: frontmatter non chiuso (manca la riga ---)`);
  const front: Front = {};
  for (const line of text.slice(4, end).split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) throw new ContentError(`${file}: riga di frontmatter non valida: "${line}"`);
    front[m[1].toLowerCase()] = parseValue(m[2]);
  }
  return { front, body: text.slice(end + 4).replace(/^\n/, '').trimEnd() };
}

const SEGMENT_RE = /\[\[L(\d)(!?):[ \t]?([\s\S]*?)\]\]/g;

type PlainDoc = { text: string; segments: { level: number; bang: boolean; text: string }[] };

/** Splits `[[L3: …]]` portions out of a document. */
function extractSegments(body: string, docLevel: number, file: string): PlainDoc {
  const segments: PlainDoc['segments'] = [];
  const text = body.replace(SEGMENT_RE, (_m, lvl: string, bang: string, inner: string) => {
    const level = Number(lvl);
    if (level < 1 || level > MAX_LEVEL) throw new ContentError(`${file}: livello di censura non valido L${lvl}`);
    if (level <= docLevel) {
      warn(`${file}: [[L${level}: …]] in un documento di livello ${docLevel} è sempre visibile`);
    }
    segments.push({ level, bang: bang === '!', text: inner });
    return `\u0001${segments.length - 1}\u0001`;
  });
  if (/\[\[L\d/.test(text)) throw new ContentError(`${file}: blocco [[L…]] non chiuso o annidato`);
  return { text, segments };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let quiet = false;
const warnings: string[] = [];
function warn(msg: string) {
  warnings.push(msg);
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

async function walk(dir: string, images = false): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, images)));
    else if (e.name.endsWith('.md') || (images && IMAGE_RE.test(e.name))) out.push(full);
  }
  return out.sort();
}

function rel(file: string) {
  return path.relative(ROOT, file);
}

function asLevel(v: unknown, file: string, fallback = 0): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_LEVEL) throw new ContentError(`${file}: livello non valido "${v}"`);
  return n;
}

function str(v: unknown): string | undefined {
  return v === undefined || v === '' ? undefined : String(v);
}

function validateArchive(a: ArchiveConfig | undefined): ArchiveConfig | undefined {
  if (!a) return undefined;
  if (!a.cartella?.startsWith('/') || a.cartella === '/') throw new ContentError('gioco.json: archivio.cartella deve essere un percorso come /archivio-scp');
  for (const [k, l] of Object.entries(a.livelli ?? {})) {
    if (!Number.isInteger(l) || l < 0 || l > MAX_LEVEL) throw new ContentError(`gioco.json: archivio.livelli.${k} non valido (${l})`);
  }
  if (a.sopra_livello && !['bloccati', 'nascosti'].includes(a.sopra_livello)) {
    throw new ContentError('gioco.json: archivio.sopra_livello deve essere "bloccati" o "nascosti"');
  }
  return a;
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

export async function buildContent(opts: { quiet?: boolean } = {}): Promise<void> {
  quiet = Boolean(opts.quiet);
  warnings.length = 0;
  const started = Date.now();

  const config = JSON.parse(await readFile(path.join(CONTENT, 'gioco.json'), 'utf8')) as GameConfig;
  for (const k of ['id', 'titolo', 'host', 'segreto', 'iterazioni', 'utenti'] as const) {
    if (!config[k]) throw new ContentError(`content/gioco.json: manca "${k}"`);
  }
  const { id: gameId, iterazioni: iter } = config;

  /* Keys ------------------------------------------------------------ */
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(config.segreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const levelKeys = new Map<number, CryptoKey>();
  const levelRaw = new Map<number, string>();
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const raw = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`${gameId}|livello|${l}`)));
    levelKeys.set(l, await importRawKey(raw));
    levelRaw.set(l, Buffer.from(raw).toString('base64'));
  }

  // Strings that must never appear in the output, and locked text to scan for.
  const secrets: { value: string; what: string }[] = [{ value: config.segreto, what: 'segreto di build' }];
  const lockedTexts: { text: string; where: string }[] = [];

  const users = new Map<string, GameConfig['utenti'][number]>();
  for (const u of config.utenti) {
    const name = u.nome.toLowerCase();
    if (users.has(name)) throw new ContentError(`gioco.json: utente duplicato ${name}`);
    if (!u.password) throw new ContentError(`gioco.json: l'utente ${name} non ha una password`);
    asLevel(u.livello, `gioco.json (${name})`);
    users.set(name, { ...u, nome: name });
    secrets.push({ value: normalizeSecret(u.password), what: `password di ${name}` });
  }

  async function sealDoc(plain: PlainDoc, level: number, chiave: string | undefined, scope: string, where: string, meta?: DocBody['m']): Promise<FileEntry['b']> {
    const g: Segment[] = [];
    for (const seg of plain.segments) {
      g.push({
        l: seg.level,
        n: [...seg.text.replace(/\s+/g, ' ')].length,
        x: seg.bang,
        d: await encryptText(levelKeys.get(seg.level)!, seg.text),
      });
      lockedTexts.push({ text: seg.text, where: `${where} [[L${seg.level}]]` });
    }
    const body: DocBody = { t: plain.text, g, ...(meta && Object.keys(meta).length ? { m: meta } : {}) };
    const layers: CryptoKey[] = [];
    if (chiave) layers.push(await deriveKey(chiave, await saltFor(gameId, scope), iter));
    if (level >= 1) layers.push(levelKeys.get(level)!);
    if (layers.length) lockedTexts.push({ text: plain.text, where });
    return seal(body, layers);
  }

  /* Filesystem ------------------------------------------------------ */
  const publicFiles: FileEntry[] = [];
  const homeFiles = new Map<string, FileEntry[]>();
  const knownPaths = new Set<string>();
  const fsRoot = path.join(CONTENT, 'fs');

  const fileEvents: { where: string; id: string }[] = [];
  const repairRefs: { where: string; path: string }[] = [];
  const all = await walk(fsRoot, true);
  const imageFiles = new Map(all.filter((f) => IMAGE_RE.test(f)).map((f) => ['/' + path.relative(fsRoot, f).split(path.sep).join('/'), f]));
  const sidecars = new Set<string>();
  const docs: { file: string; vpath: string; image?: string }[] = [];
  for (const file of all.filter((f) => f.endsWith('.md'))) {
    const vpath = '/' + path.relative(fsRoot, file).split(path.sep).join('/').replace(/\.md$/, '');
    const image = imageFiles.get(vpath);
    if (image) sidecars.add(vpath);
    docs.push({ file, vpath, image });
  }
  // Images without a sidecar .md: public, no caption.
  for (const [vpath, image] of imageFiles) if (!sidecars.has(vpath)) docs.push({ file: image, vpath, image });

  for (const { file, vpath, image } of docs) {
    const where = rel(file);
    if (!/^[\w./-]+$/.test(vpath)) throw new ContentError(`${where}: usa solo lettere, numeri, . - _ nei nomi`);
    const { front, body } = file === image ? { front: {} as Front, body: '' } : parseFrontmatter(await readFile(file, 'utf8'), where);
    const level = asLevel(front.livello, where);
    const encrypted = front.cifrato === true;
    const chiave = str(front.chiave);
    if (encrypted && !chiave) throw new ContentError(`${where}: "cifrato: sì" richiede "chiave"`);
    if (!encrypted && chiave) warn(`${where}: "chiave" ignorata perché il file non è cifrato`);
    if (chiave) secrets.push({ value: normalizeSecret(chiave), what: `chiave di ${vpath}` });
    const dopo = str(front.dopo_evento);
    if (dopo) fileEvents.push({ where, id: dopo });

    const homeMatch = vpath.match(/^\/home\/([^/]+)\//);
    const owner = homeMatch?.[1];
    if (vpath.startsWith('/home/') && !owner) throw new ContentError(`${where}: i file in home/ vanno in home/<utente>/`);
    if (owner && !users.has(owner)) throw new ContentError(`${where}: utente "${owner}" non definito in gioco.json`);

    const meta: DocBody['m'] = {};
    if (front.autore) meta.autore = String(front.autore);
    if (front.modificato) meta.modificato = String(front.modificato);
    if (front.ripara) {
      meta.ripara = String(front.ripara);
      repairRefs.push({ where, path: meta.ripara });
    }
    let plain: PlainDoc;
    let size: number;
    if (image) {
      const bytes = await readFile(image);
      const ext = image.split('.').pop()!.toLowerCase();
      plain = { text: `data:${MIME[ext]};base64,${bytes.toString('base64')}`, segments: [] };
      meta.didascalia = body.trim() || path.basename(vpath);
      size = bytes.length;
    } else {
      plain = extractSegments(body, level, where);
      size = [...body].length;
    }
    const entry: FileEntry = {
      p: vpath,
      l: level,
      e: encrypted,
      s: size,
      b: await sealDoc(plain, level, chiave, `file:${vpath}`, where, meta),
      ...(dopo ? { v: dopo } : {}),
      ...(front.corrotto === true ? { c: true } : {}),
    };
    knownPaths.add(vpath);
    if (owner) {
      if (!homeFiles.has(owner)) homeFiles.set(owner, []);
      homeFiles.get(owner)!.push(entry);
      if (!image) lockedTexts.push({ text: plain.text, where });
    } else {
      publicFiles.push(entry);
    }
  }

  /* Mail ------------------------------------------------------------ */
  const mail = new Map<string, MailEntry[]>();
  const mailEvents: { where: string; id: string }[] = [];
  const postaRoot = path.join(CONTENT, 'posta');
  for (const file of await walk(postaRoot)) {
    const where = rel(file);
    const parts = path.relative(postaRoot, file).split(path.sep);
    if (parts.length !== 2) throw new ContentError(`${where}: le email vanno in posta/<utente>/<nome>.md`);
    const owner = parts[0];
    if (!users.has(owner)) throw new ContentError(`${where}: utente "${owner}" non definito in gioco.json`);
    const { front, body } = parseFrontmatter(await readFile(file, 'utf8'), where);
    for (const k of ['da', 'oggetto', 'data'] as const) {
      if (!front[k]) throw new ContentError(`${where}: manca "${k}"`);
    }
    const level = asLevel(front.livello, where);
    const plain = extractSegments(body, level, where);
    const dopo = str(front.dopo_evento);
    if (dopo) mailEvents.push({ where, id: dopo });
    const replies: { t: string; s: string }[] = [];
    for (let i = 1; i <= 4; i++) {
      const r = str(front[`risposta${i}`]);
      if (r) replies.push({ t: r, s: `risposta-${owner}-${parts[1].replace(/\.md$/, '')}-${i}` });
    }
    const entry: MailEntry = {
      ...(replies.length ? { r: replies } : {}),
      id: parts[1].replace(/\.md$/, ''),
      da: String(front.da),
      a: str(front.a) ?? owner,
      oggetto: String(front.oggetto),
      data: String(front.data),
      dopo,
      l: level,
      b: await sealDoc(plain, level, undefined, '', where),
    };
    lockedTexts.push({ text: plain.text, where });
    if (!mail.has(owner)) mail.set(owner, []);
    mail.get(owner)!.push(entry);
  }
  for (const list of mail.values()) list.sort((a, b) => a.data.localeCompare(b.data));

  /* Events ---------------------------------------------------------- */
  const events: EventEntry[] = [];
  const eventIds = new Set<string>();
  const eventRefs: { where: string; id: string }[] = [...mailEvents, ...fileEvents];
  for (const file of await walk(path.join(CONTENT, 'eventi'))) {
    const where = rel(file);
    const { front, body } = parseFrontmatter(await readFile(file, 'utf8'), where);
    const id = str(front.id) ?? path.basename(file, '.md');
    if (eventIds.has(id)) throw new ContentError(`${where}: id evento duplicato "${id}"`);
    eventIds.add(id);
    const tipo = (str(front.tipo) ?? 'sistema') as EventKind;
    if (!EVENT_KINDS.includes(tipo)) throw new ContentError(`${where}: tipo "${tipo}" non valido (${EVENT_KINDS.join(', ')})`);
    const level = asLevel(front.livello, where);
    const lettura = str(front.dopo_lettura);
    const login = str(front.dopo_login)?.toLowerCase();
    const evento = str(front.dopo_evento);
    const comando = str(front.comando);
    if (lettura && !knownPaths.has(lettura)) throw new ContentError(`${where}: dopo_lettura "${lettura}" non esiste`);
    if (login && !users.has(login)) throw new ContentError(`${where}: dopo_login "${login}" non è un utente`);
    if (evento) eventRefs.push({ where, id: evento });
    const ora = str(front.ora);
    if (ora && !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(ora)) throw new ContentError(`${where}: ora deve essere HH:MM-HH:MM`);
    const giorno = str(front.giorno);
    if (giorno && !/^\d{2}-\d{2}$/.test(giorno)) throw new ContentError(`${where}: giorno deve essere MM-GG`);

    const plain = extractSegments(body, level, where);
    const payload: EventPayload = { da: str(front.da), testo: { t: plain.text, g: [] } };
    for (const seg of plain.segments) {
      payload.testo.g.push({ l: seg.level, n: [...seg.text].length, x: seg.bang, d: await encryptText(levelKeys.get(seg.level)!, seg.text) });
    }
    const layers: CryptoKey[] = [];
    let cmd: string | undefined;
    if (comando) {
      const norm = normalizeSecret(comando);
      cmd = (await sha256Hex(`${gameId}|cmd|${norm}`)).slice(0, 12);
      layers.push(await deriveKey(norm, await saltFor(gameId, `cmd:${id}`), iter));
      secrets.push({ value: norm, what: `comando dell'evento ${id}` });
    }
    if (level >= 1) layers.push(levelKeys.get(level)!);
    if (layers.length) lockedTexts.push({ text: plain.text, where });

    events.push({
      id,
      l: level,
      tipo,
      cond: { lettura, login, evento, cmd, ora: str(front.ora), giorno: str(front.giorno) },
      ritardo: Number(front.ritardo ?? 0) || 0,
      b: await seal(payload, layers),
    });
  }
  for (const ref of eventRefs) {
    if (!eventIds.has(ref.id) && !ref.id.startsWith('risposta-')) throw new ContentError(`${ref.where}: l'evento "${ref.id}" non esiste`);
  }
  for (const ref of repairRefs) {
    if (!knownPaths.has(ref.path)) throw new ContentError(`${ref.where}: ripara "${ref.path}" non esiste`);
  }

  /* Radio, voices, cameras ------------------------------------------ */
  async function sealLevel<T>(value: T, level: number, where: string, text: string): Promise<{ b: Sealed<T> }> {
    if (level >= 1) lockedTexts.push({ text, where });
    return { b: await seal(value, level >= 1 ? [levelKeys.get(level)!] : []) };
  }
  async function segmented(body: string, level: number, where: string): Promise<DocBody> {
    const plain = extractSegments(body, level, where);
    const g: Segment[] = [];
    for (const seg of plain.segments) {
      g.push({ l: seg.level, n: [...seg.text].length, x: seg.bang, d: await encryptText(levelKeys.get(seg.level)!, seg.text) });
    }
    return { t: plain.text, g };
  }

  const radio: RadioEntry[] = [];
  for (const file of await walk(path.join(CONTENT, 'radio'))) {
    const where = rel(file);
    const { front, body } = parseFrontmatter(await readFile(file, 'utf8'), where);
    const f = Number(String(front.frequenza ?? '').replace(',', '.'));
    if (!f) throw new ContentError(`${where}: manca "frequenza" (MHz)`);
    const level = asLevel(front.livello, where);
    const v = str(front.dopo_evento);
    if (v) eventRefs.push({ where, id: v });
    const o = str(front.ora);
    if (o && !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(o)) throw new ContentError(`${where}: ora deve essere HH:MM-HH:MM`);
    const testo = await segmented(body, level, where);
    radio.push({ f, l: level, ...(v ? { v } : {}), ...(o ? { o } : {}), ...(await sealLevel({ nome: String(front.nome ?? 'Trasmissione'), testo }, level, where, body)) });
  }

  const voci: VoiceEntry[] = [];
  for (const file of await walk(path.join(CONTENT, 'fonoteca'))) {
    const where = rel(file);
    const { front, body } = parseFrontmatter(await readFile(file, 'utf8'), where);
    const level = asLevel(front.livello, where);
    const lettura = str(front.dopo_lettura);
    const evento = str(front.dopo_evento);
    if (lettura && !knownPaths.has(lettura)) throw new ContentError(`${where}: dopo_lettura "${lettura}" non esiste`);
    if (evento) eventRefs.push({ where, id: evento });
    const testo = await segmented(body, level, where);
    voci.push({ id: path.basename(file, '.md'), l: level, cond: { lettura, evento }, ...(await sealLevel({ nome: String(front.nome ?? '???'), testo }, level, where, body)) });
  }

  const camere: CameraEntry[] = [];
  for (const file of await walk(path.join(CONTENT, 'telecamere'))) {
    const where = rel(file);
    const { front, body } = parseFrontmatter(await readFile(file, 'utf8'), where);
    const level = asLevel(front.livello, where);
    const v = str(front.dopo_evento);
    if (v) eventRefs.push({ where, id: v });
    for (const k of ['nome', 'scena', 'comportamento'] as const) if (!front[k]) throw new ContentError(`${where}: manca "${k}"`);
    const messaggi = body.split('\n').map((l) => l.trim()).filter(Boolean);
    camere.push({
      id: path.basename(file, '.md'),
      nome: String(front.nome),
      l: level,
      scena: String(front.scena),
      comportamento: String(front.comportamento),
      ...(v ? { v } : {}),
      ...(await sealLevel({ messaggi }, level, where, body)),
    });
  }
  for (const ref of eventRefs) {
    if (!eventIds.has(ref.id) && !ref.id.startsWith('risposta-')) throw new ContentError(`${ref.where}: l'evento "${ref.id}" non esiste`);
  }

  /* Users ----------------------------------------------------------- */
  const utenti: Manifest['utenti'] = [];
  for (const u of users.values()) {
    const keyring: Keyring = {
      nome: u.nome_completo,
      ruolo: u.ruolo,
      livello: u.livello,
      chiavi: Object.fromEntries([...levelRaw].filter(([l]) => l <= u.livello).map(([l, k]) => [String(l), k])),
      home: homeFiles.get(u.nome) ?? [],
      posta: mail.get(u.nome) ?? [],
    };
    const key = await deriveKey(u.password, await saltFor(gameId, `utente:${u.nome}`), iter);
    utenti.push({ n: u.nome, k: await encryptText(key, JSON.stringify(keyring)), ...(u.nascosto ? { h: true } : {}) });
  }

  const check: Manifest['check'] = {};
  for (const [l, key] of levelKeys) check[String(l)] = await encryptText(key, `${gameId}|ok|${l}`);

  const manifest: Manifest = {
    v: 1,
    id: gameId,
    iter,
    meta: {
      titolo: config.titolo,
      host: config.host,
      livelli: config.livelli ?? {},
      logo: config.logo ?? [],
      boot: config.boot ?? [],
      crediti: config.crediti ?? [],
      archivio: validateArchive(config.archivio),
      ...(config.intro ? { intro: config.intro } : {}),
    },
    check,
    utenti,
    files: publicFiles,
    eventi: events,
    radio,
    voci,
    camere,
  };
  const json = JSON.stringify(manifest);

  /* Anti-spoiler check ---------------------------------------------- */
  const lower = json.toLowerCase();
  for (const s of secrets) {
    if (s.value.length >= 4 && lower.includes(JSON.stringify(s.value).slice(1, -1))) {
      if (s.what === 'segreto di build') throw new ContentError('Il segreto di build compare nell’output!');
      warn(`"${s.value}" (${s.what}) compare in chiaro in un contenuto pubblico: è voluto?`);
    }
  }
  for (const { text, where } of lockedTexts) {
    // Any run of 6+ words of locked text must not appear in clear.
    const words = text.replace(/\u0001\d+\u0001/g, ' ').split(/\s+/).filter(Boolean);
    for (let i = 0; i + 6 <= words.length; i += 3) {
      const snippet = JSON.stringify(words.slice(i, i + 6).join(' ')).slice(1, -1);
      if (snippet.length > 24 && json.includes(snippet)) {
        throw new ContentError(`${where}: testo riservato trovato in chiaro nell'output ("${snippet}")`);
      }
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, json);
  const size = (await stat(OUT_FILE)).size;

  if (!quiet || warnings.length) {
    for (const w of warnings) console.warn(`  ⚠ ${w}`);
  }
  if (!quiet) {
    const homeCount = [...homeFiles.values()].reduce((n, l) => n + l.length, 0);
    const mailCount = [...mail.values()].reduce((n, l) => n + l.length, 0);
    console.log(
      `✓ content → ${path.relative(ROOT, OUT_FILE)} (${(size / 1024).toFixed(1)} KB, ${Date.now() - started} ms)\n` +
        `  ${publicFiles.length} file, ${homeCount} file personali, ${mailCount} email, ${events.length} eventi, ${users.size} utenti`,
    );
  }
}

// Run when called directly (npm run build:content).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildContent().catch((err) => {
    console.error(err instanceof ContentError ? `✗ ${err.message}` : err);
    process.exit(1);
  });
}
