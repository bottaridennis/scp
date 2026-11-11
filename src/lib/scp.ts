import type { SCPItem } from '../services/scpApi';

export type ObjectClassKey =
  | 'safe'
  | 'euclid'
  | 'keter'
  | 'thaumiel'
  | 'apollyon'
  | 'esoteric-class'
  | 'neutralized'
  | 'explained'
  | 'decommissioned';

export type ObjectClassInfo = {
  key: ObjectClassKey;
  label: string;
  color: string;
  description: string;
};

/** Ordered by priority: the first tag that matches wins. */
export const OBJECT_CLASSES: ObjectClassInfo[] = [
  { key: 'apollyon', label: 'Apollyon', color: '#9b1c1c', description: 'Impossibile da contenere.' },
  { key: 'keter', label: 'Keter', color: '#d61f2c', description: 'Contenimento difficile e costoso.' },
  { key: 'thaumiel', label: 'Thaumiel', color: '#7c4dcc', description: 'Usato per contenere altre anomalie.' },
  { key: 'euclid', label: 'Euclid', color: '#d48806', description: 'Comportamento non del tutto prevedibile.' },
  { key: 'safe', label: 'Safe', color: '#2f9e5b', description: 'Contenimento affidabile e semplice.' },
  { key: 'esoteric-class', label: 'Esoterica', color: '#3b6fd4', description: 'Classificazione non standard.' },
  { key: 'neutralized', label: 'Neutralizzato', color: '#7a8190', description: 'Non più anomalo.' },
  { key: 'explained', label: 'Spiegato', color: '#138a7e', description: 'Fenomeno compreso dalla scienza.' },
  { key: 'decommissioned', label: 'Dismesso', color: '#5b6170', description: 'Rimosso dall’archivio attivo.' },
];

const CLASS_BY_KEY = new Map(OBJECT_CLASSES.map((c) => [c.key, c]));

export const UNKNOWN_CLASS: ObjectClassInfo = {
  key: 'safe',
  label: 'Non classificato',
  color: '#8a8a8a',
  description: '',
};

export function getClassInfo(key: string): ObjectClassInfo | undefined {
  return CLASS_BY_KEY.get(key as ObjectClassKey);
}

export function getObjectClass(item: Pick<SCPItem, 'tags' | 'series'>): ObjectClassInfo {
  for (const cls of OBJECT_CLASSES) {
    if (item.tags.includes(cls.key)) return cls;
  }
  const bySeries = CLASS_BY_KEY.get(item.series as ObjectClassKey);
  return bySeries ?? UNKNOWN_CLASS;
}

export type SeriesInfo = {
  key: string;
  label: string;
  short: string;
  range?: string;
};

export const NUMBERED_SERIES: SeriesInfo[] = Array.from({ length: 10 }, (_, i) => {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i];
  const start = i === 0 ? '001' : `${i}000`;
  const end = `${i === 0 ? '' : i}999`;
  return { key: `series-${i + 1}`, label: `Serie ${roman}`, short: roman, range: `${start}–${end}` };
});

export const SPECIAL_SERIES: SeriesInfo[] = [
  { key: 'scp-001', label: 'Proposte SCP-001', short: '001' },
  { key: 'explained', label: 'SCP-EX', short: 'EX' },
  { key: 'joke', label: 'SCP umoristici', short: 'J' },
  { key: 'international', label: 'Internazionali', short: 'INT' },
  { key: 'decommissioned', label: 'Dismessi', short: 'D' },
];

export const ALL_SERIES = [...NUMBERED_SERIES, ...SPECIAL_SERIES];

export function getSeriesInfo(key: string): SeriesInfo | undefined {
  return ALL_SERIES.find((s) => s.key === key);
}

export function seriesLabel(key: string): string {
  return getSeriesInfo(key)?.label ?? key;
}

export function formatRating(rating: number): string {
  return rating > 0 ? `+${rating}` : String(rating);
}

export function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function compareByNumber(a: SCPItem, b: SCPItem): number {
  const an = a.scpNumber ?? Number.MAX_SAFE_INTEGER;
  const bn = b.scpNumber ?? Number.MAX_SAFE_INTEGER;
  return an - bn || a.scp.localeCompare(b.scp, 'en', { numeric: true });
}

/**
 * Search the archive. Results are ranked: exact designation first, then
 * designations that start with the query, then title matches, then tags.
 */
export function searchItems(items: SCPItem[], rawQuery: string, limit = Infinity): SCPItem[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];
  const digits = q.replace(/^scp[-\s]?/, '');
  const isNumeric = /^\d+$/.test(digits);

  const scored: { item: SCPItem; score: number }[] = [];
  for (const item of items) {
    const scp = item.scp.toLowerCase();
    const title = item.title.toLowerCase();
    let score = 0;
    if (scp === q || (isNumeric && item.scpNumber === Number(digits) && scp === `scp-${digits}`)) score = 100;
    else if (isNumeric && item.scpNumber === Number(digits)) score = 90;
    else if (scp.startsWith(q) || (isNumeric && scp.startsWith(`scp-${digits}`))) score = 70;
    else if (title.startsWith(q)) score = 60;
    else if (title.includes(q)) score = 50;
    else if (scp.includes(q)) score = 40;
    else if (item.tags.some((t) => t === q)) score = 30;
    else if (q.length > 2 && item.tags.some((t) => t.includes(q))) score = 20;
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score || b.item.rating - a.item.rating || compareByNumber(a.item, b.item));
  return scored.slice(0, limit).map((s) => s.item);
}

export const FEATURED_IDS = ['SCP-173', 'SCP-096', 'SCP-682', 'SCP-049', 'SCP-106', 'SCP-999', 'SCP-055', 'SCP-3008'];
