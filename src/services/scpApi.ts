import DOMPurify from 'dompurify';

export type SCPItem = {
  id: string;
  scp: string;
  scpNumber: number | null;
  title: string;
  series: string;
  rating: number;
  tags: string[];
  images: string[];
  sourceUrl: string;
  contentFile?: string;
  createdAt?: string;
  createdBy?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const normalizeScpItem = (id: string, raw: any): SCPItem => ({
  id,
  scp: typeof raw.scp === 'string' && raw.scp ? raw.scp : id.toUpperCase(),
  scpNumber: Number.isFinite(Number(raw.scp_number)) && raw.scp_number !== null && raw.scp_number !== undefined
    ? Number(raw.scp_number)
    : null,
  title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Titolo non disponibile',
  series: raw.series ?? 'unknown',
  rating: Number(raw.rating ?? 0) || 0,
  tags: Array.isArray(raw.tags) ? raw.tags : [],
  images: Array.isArray(raw.images) ? raw.images.map(toHttps) : [],
  sourceUrl: raw.url ?? `https://scp-wiki.wikidot.com/${id.toLowerCase()}`,
  contentFile: raw.content_file,
  createdAt: raw.created_at,
  createdBy: raw.creator ?? raw.created_by,
});

/* ------------------------------------------------------------------ */
/* Data sources                                                        */
/* ------------------------------------------------------------------ */

/**
 * The static SCP data API is published on GitHub Pages and mirrored in its
 * GitHub repository. We try each source in order and remember the first one
 * that answers, so a single outage (or a blocked host) does not break the app.
 */
const SOURCES: string[] = [
  import.meta.env.VITE_SCP_API_BASE as string | undefined,
  import.meta.env.DEV ? '/scp-api' : undefined,
  'https://scp-data.tedivm.com',
  'https://raw.githubusercontent.com/scp-data/scp-api/main/docs',
].filter((s): s is string => Boolean(s));

let preferredSource = 0;

async function fetchJson<T>(path: string): Promise<T> {
  let lastError: unknown = null;
  for (let offset = 0; offset < SOURCES.length; offset++) {
    const index = (preferredSource + offset) % SOURCES.length;
    try {
      const res = await fetch(`${SOURCES[index]}${path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as T;
      preferredSource = index;
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Archivio non raggiungibile');
}

/* ------------------------------------------------------------------ */
/* Metadata                                                            */
/* ------------------------------------------------------------------ */

let metadataPromise: Promise<SCPItem[]> | null = null;

export function fetchScpMetadata(): Promise<SCPItem[]> {
  if (!metadataPromise) {
    metadataPromise = fetchJson<Record<string, unknown> | unknown[]>('/data/scp/items/index.json')
      .then((data) => {
        const items: SCPItem[] = [];
        if (Array.isArray(data)) {
          data.forEach((raw, i) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = raw as any;
            if (r) items.push(normalizeScpItem(r.link ?? r.scp ?? String(i), r));
          });
        } else {
          for (const [key, raw] of Object.entries(data)) {
            if (raw) items.push(normalizeScpItem(key, raw));
          }
        }
        return items;
      })
      .catch((err) => {
        metadataPromise = null; // allow retry
        throw err;
      });
  }
  return metadataPromise;
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

type ContentFile = Record<string, { raw_content?: string }>;
const contentFiles = new Map<string, Promise<ContentFile>>();

function loadContentFile(file: string): Promise<ContentFile> {
  let p = contentFiles.get(file);
  if (!p) {
    p = fetchJson<ContentFile>(`/data/scp/items/${file}`).catch((err) => {
      contentFiles.delete(file);
      throw err;
    });
    contentFiles.set(file, p);
  }
  return p;
}

let contentIndexPromise: Promise<Record<string, string>> | null = null;
function loadContentIndex() {
  if (!contentIndexPromise) {
    contentIndexPromise = fetchJson<Record<string, string>>('/data/scp/items/content_index.json').catch((err) => {
      contentIndexPromise = null;
      throw err;
    });
  }
  return contentIndexPromise;
}

/** Returns the raw wiki HTML for an item (cached per content file). */
export async function fetchScpContent(item: SCPItem): Promise<string> {
  let file = item.contentFile;
  if (!file) {
    const index = await loadContentIndex();
    file = index[item.series];
  }
  if (!file) throw new Error('Contenuto non disponibile');
  const data = await loadContentFile(file);
  const entry = data[item.id] ?? data[item.scp];
  if (!entry?.raw_content) throw new Error('Contenuto non disponibile');
  return entry.raw_content;
}

/* ------------------------------------------------------------------ */
/* HTML clean-up                                                       */
/* ------------------------------------------------------------------ */

const WIKI_ORIGIN = 'https://scp-wiki.wikidot.com';
const WIKI_HOSTS = /^(?:https?:)?\/\/(?:www\.)?(?:scp-wiki\.wikidot\.com|scpwiki\.com|scp-wiki\.net)(\/.*)?$/i;
const SCP_PATH = /^\/(scp-\d{3,4}(?:-[a-z0-9]+)*)\/?$/i;

function toHttps(url: string): string {
  if (typeof url !== 'string') return url;
  if (url.startsWith('//')) return `https:${url}`;
  return url.replace(/^http:\/\//i, 'https://');
}

const KEEP_STYLE_PROPS = new Set([
  'text-align', 'float', 'clear', 'width', 'max-width', 'height', 'margin', 'margin-left', 'margin-right',
  'font-style', 'font-weight', 'text-decoration', 'text-transform', 'white-space', 'display',
]);

const REDACTION_RE = /(█+|\[\s*(?:DATA EXPUNGED|REDACTED|DATI CANCELLATI|CENSURATO)\s*\])/gi;

/**
 * Transforms the raw wiki HTML into clean, theme-friendly markup:
 * removes wiki chrome, converts collapsibles and tabs, rewrites links to
 * in-app routes, upgrades images and marks redactions.
 */
export function prepareContent(rawHtml: string, isKnownId: (id: string) => boolean): string {
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const root = doc.getElementById('page-content') ?? doc.body;

  root
    .querySelectorAll(
      'script, style, link, .licensebox, .page-rate-widget-box, .rate-box-with-credit-button, .creditRate, .credit-rate, .footer-wikiwalk-nav, .modal-wrapper, .creditButton, .info-container',
    )
    .forEach((el) => el.remove());

  // Collapsible blocks -> <details>
  root.querySelectorAll('.collapsible-block').forEach((block) => {
    const label =
      block.querySelector('.collapsible-block-folded a')?.textContent?.replace(/^[\s+‡]+/, '').trim() ||
      'Mostra contenuto';
    const content = block.querySelector('.collapsible-block-content');
    const details = doc.createElement('details');
    details.className = 'scp-collapsible';
    const summary = doc.createElement('summary');
    summary.textContent = label;
    const body = doc.createElement('div');
    body.className = 'scp-collapsible-body';
    if (content) while (content.firstChild) body.appendChild(content.firstChild);
    details.append(summary, body);
    block.replaceWith(details);
  });

  // Tab views -> stacked sections
  root.querySelectorAll('.yui-navset').forEach((tabs) => {
    const titles = Array.from(tabs.querySelectorAll('.yui-nav li')).map((li) => li.textContent?.trim() ?? '');
    const panels = Array.from(tabs.querySelector('.yui-content')?.children ?? []);
    const wrapper = doc.createElement('div');
    panels.forEach((panel, i) => {
      const section = doc.createElement('section');
      section.className = 'scp-tab';
      const h = doc.createElement('p');
      h.className = 'scp-tab-title';
      h.textContent = titles[i] || `Sezione ${i + 1}`;
      section.appendChild(h);
      while (panel.firstChild) section.appendChild(panel.firstChild);
      wrapper.appendChild(section);
    });
    tabs.replaceWith(wrapper);
  });

  // Links
  root.querySelectorAll('a').forEach((a) => {
    const raw = a.getAttribute('href') ?? '';
    a.removeAttribute('onclick');
    if (!raw || raw.toLowerCase().startsWith('javascript:')) {
      a.removeAttribute('href');
      return;
    }
    if (raw.startsWith('#')) return;

    let path: string | null = null;
    if (raw.startsWith('/') && !raw.startsWith('//')) path = raw;
    else {
      const m = raw.match(WIKI_HOSTS);
      if (m) path = m[1] ?? '/';
    }

    if (path !== null) {
      const scp = path.match(SCP_PATH);
      if (scp && isKnownId(scp[1].toUpperCase())) {
        a.setAttribute('href', `#/scp/${scp[1].toUpperCase()}`);
        a.removeAttribute('target');
        return;
      }
      a.setAttribute('href', `${WIKI_ORIGIN}${path}`);
    } else {
      a.setAttribute('href', toHttps(raw));
    }
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  // Images
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith('/') && !src.startsWith('//')) img.setAttribute('src', `${WIKI_ORIGIN}${src}`);
    else img.setAttribute('src', toHttps(src));
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.removeAttribute('width');
    img.removeAttribute('height');
  });

  // Tables scroll horizontally on small screens
  root.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList.contains('table-wrap')) return;
    const wrap = doc.createElement('div');
    wrap.className = 'table-wrap';
    table.replaceWith(wrap);
    wrap.appendChild(table);
    table.removeAttribute('style');
  });

  // Inline styles: keep layout, drop colours/fonts that break the theme
  root.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const kept: string[] = [];
    for (let i = 0; i < el.style.length; i++) {
      const prop = el.style.item(i);
      if (KEEP_STYLE_PROPS.has(prop)) kept.push(`${prop}:${el.style.getPropertyValue(prop)}`);
    }
    if (kept.length) el.setAttribute('style', kept.join(';'));
    else el.removeAttribute('style');
  });
  root.querySelectorAll('[color], [bgcolor], font[face]').forEach((el) => {
    el.removeAttribute('color');
    el.removeAttribute('bgcolor');
    el.removeAttribute('face');
  });

  // Redactions
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    REDACTION_RE.lastIndex = 0;
    if (REDACTION_RE.test(node.data)) textNodes.push(node);
  }
  textNodes.forEach((node) => {
    const frag = doc.createDocumentFragment();
    node.data.split(REDACTION_RE).forEach((part, i) => {
      if (!part) return;
      if (i % 2 === 0) {
        frag.appendChild(doc.createTextNode(part));
      } else if (part.startsWith('█')) {
        const span = doc.createElement('span');
        span.className = 'redacted';
        span.textContent = part;
        span.setAttribute('aria-label', 'testo oscurato');
        frag.appendChild(span);
      } else {
        const span = doc.createElement('span');
        span.className = 'expunged';
        span.textContent = part.replace(/^\[\s*|\s*\]$/g, '');
        frag.appendChild(span);
      }
    });
    node.replaceWith(frag);
  });

  return DOMPurify.sanitize(root.innerHTML, {
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['form', 'input', 'button', 'iframe'],
  });
}

/* ------------------------------------------------------------------ */
/* Nicknames                                                           */
/* ------------------------------------------------------------------ */

const SERIES_HUBS = ['scp-series', ...Array.from({ length: 9 }, (_, i) => `scp-series-${i + 2}`)];

/**
 * The item index only stores the designation as title ("SCP-173"). The
 * human-readable names ("The Sculpture") live in the series hub pages, so we
 * extract them from there. Returns a map of item id -> nickname.
 */
export async function fetchScpNicknames(): Promise<Map<string, string>> {
  const hubs = await fetchJson<Record<string, { raw_content?: string }>>('/data/scp/hubs/index.json');
  const names = new Map<string, string>();
  const parser = new DOMParser();
  for (const key of SERIES_HUBS) {
    const html = hubs[key]?.raw_content;
    if (!html) continue;
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('li').forEach((li) => {
      const link = li.querySelector('a[href^="/scp-"]');
      const match = link?.getAttribute('href')?.match(SCP_PATH);
      if (!link || !match) return;
      const full = li.textContent ?? '';
      const linkText = link.textContent ?? '';
      const name = full
        .slice(full.indexOf(linkText) + linkText.length)
        .replace(/^\s*[-–—:]\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (name && name !== '[ACCESS DENIED]' && !names.has(match[1].toUpperCase())) {
        names.set(match[1].toUpperCase(), name);
      }
    });
  }
  return names;
}
