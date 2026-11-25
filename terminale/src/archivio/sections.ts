/**
 * Splits an article (HTML from prepareContent) into the main document plus one
 * file per collapsible block or tab, collects the images and builds a clean
 * text version for the terminal.
 */

export type Section = { name: string; label: string; html: string };
export type Attachment = { name: string; src: string; caption: string };
export type SplitArticle = { main: string; sections: Section[]; images: Attachment[] };

/** Marker left in the main document where a section was removed. */
export const SECTION_REF = 'data-section-ref';

const LABEL_PREFIX = /^(?:[+\-‡▸►»\s]+)?(?:(?:show|view|open|access|read|click(?:\s+here)?(?:\s+to)?|expand|display|reveal|mostra|apri|visualizza)\s+)*/i;

export function slugify(label: string): string {
  const base = label
    .replace(LABEL_PREFIX, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return base || 'sezione';
}

function unique(name: string, used: Set<string>, ext: string) {
  let candidate = `${name}${ext}`;
  for (let i = 2; used.has(candidate); i++) candidate = `${name}-${i}${ext}`;
  used.add(candidate);
  return candidate;
}

function extension(src: string) {
  const m = src.split('?')[0].match(/\.(jpe?g|png|gif|webp|svg|bmp)$/i);
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg';
}

export function splitArticle(html: string, extraImages: string[] = []): SplitArticle {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root')!;
  const used = new Set<string>(['documento.html']);
  const sections: Section[] = [];

  const candidates = Array.from(root.querySelectorAll<HTMLElement>('details.scp-collapsible, section.scp-tab'));
  for (const el of candidates) {
    // Only the outermost blocks become files; nested ones stay inside them.
    if (el.parentElement?.closest('details.scp-collapsible, section.scp-tab')) continue;
    const label =
      (el.matches('details') ? el.querySelector(':scope > summary')?.textContent : el.querySelector(':scope > .scp-tab-title')?.textContent)
        ?.replace(/\s+/g, ' ')
        .trim() || 'Sezione';
    const name = unique(slugify(label), used, '.html');
    const body = el.matches('details') ? el.querySelector(':scope > .scp-collapsible-body') ?? el : el;
    if (el.matches('section')) el.querySelector(':scope > .scp-tab-title')?.remove();
    sections.push({ name, label: label.replace(LABEL_PREFIX, '') || label, html: body.innerHTML });
    const ref = doc.createElement('p');
    ref.className = 'section-ref';
    ref.setAttribute(SECTION_REF, name);
    ref.textContent = `▸ ${label.replace(LABEL_PREFIX, '') || label} — vedi ${name}`;
    el.replaceWith(ref);
  }

  const images: Attachment[] = [];
  const seen = new Set<string>();
  const addImage = (src: string, caption: string) => {
    if (!src || seen.has(src) || /avatar\.php|userkarma|\/common--/.test(src)) return;
    seen.add(src);
    images.push({ name: unique(`immagine-${images.length + 1}`, used, extension(src)), src, caption });
  };
  const allHtml = [root, ...sections.map((s) => new DOMParser().parseFromString(s.html, 'text/html').body)];
  for (const scope of allHtml) {
    scope.querySelectorAll('img').forEach((img) => {
      const block = img.closest('.scp-image-block');
      const caption = block?.querySelector('.scp-image-caption')?.textContent?.replace(/\s+/g, ' ').trim() ?? img.getAttribute('alt') ?? '';
      addImage(img.getAttribute('src') ?? '', caption);
    });
  }
  for (const src of extraImages) addImage(src.replace(/^http:\/\//i, 'https://'), '');

  return { main: root.innerHTML, sections, images };
}

/** Clean text for the terminal: blocks on separate lines, lists, tables, quotes. */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const out: string[] = [];
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/[ \t\r\n]+/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const kids = () => Array.from(el.childNodes).map(walk).join('');
    if (el.classList.contains('redacted')) return el.textContent ?? '█';
    if (el.classList.contains('expunged')) return `[${(el.textContent ?? '').trim()}]`;
    switch (tag) {
      case 'br':
        return '\n';
      case 'hr':
        return '\n\n---\n\n';
      case 'img':
        return ` [immagine${el.getAttribute('alt') ? `: ${el.getAttribute('alt')}` : ''}] `;
      case 'h1':
      case 'h2':
      case 'h3':
        return `\n\n# ${kids().trim()}\n\n`;
      case 'h4':
      case 'h5':
      case 'h6':
        return `\n\n## ${kids().trim()}\n\n`;
      case 'li':
        return `\n- ${kids().trim()}`;
      case 'tr':
        return `\n${Array.from(el.children).map((c) => walk(c).replace(/\s+/g, ' ').trim()).join(' | ')}`;
      case 'summary':
        return `\n▸ ${kids().trim()}\n`;
      case 'blockquote':
        return `\n\n${collapse(kids()).split('\n').map((l) => `> ${l}`).join('\n')}\n\n`;
      case 'p':
      case 'div':
      case 'section':
      case 'details':
      case 'table':
      case 'ul':
      case 'ol':
      case 'pre':
      case 'center':
        return el.classList.contains('blockquote')
          ? `\n\n${collapse(kids()).split('\n').map((l) => `> ${l}`).join('\n')}\n\n`
          : `\n${kids()}\n`;
      default:
        return kids();
    }
  };
  out.push(walk(doc.body.firstElementChild!));
  return collapse(out.join(''));
}

function collapse(text: string) {
  return text
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
