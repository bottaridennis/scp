/**
 * Podcast player (easter egg for Amico Diverte, official Spotify embed, loaded only when opened)
 * and a small web browser. The browser shows the in-story web pages from content/web/, sealed and
 * censored by level like documents, plus a built-in page about the Narrator with links that open
 * the creator's real pages in a new tab.
 */
import type { AppDef } from '../desktop.ts';
import type { WebEntry } from '../../engine/types.ts';
import { h, icon } from '../dom.ts';
import { ICONS } from '../icons.ts';

const SHOWS = [
  { id: '29DMbQ1XQ0gYkCNwUTvTDO', nome: 'Paranormale — Attraverso il velo', nota: 'storie vere e indagini paranormali' },
  { id: '01SBlQ1sqa5LkBWVjFAgQR', nome: 'Le Cronache dei Pixel', nota: 'storia e lore dei videogiochi' },
];

/** The creator's real pages, opened in a new tab from the Narrator page. */
const LINKS = [
  { t: 'Canale YouTube — Racconti Horror', u: 'https://www.youtube.com/@AmicoDiverte_Racconti_Horror' },
  { t: 'Tutti i suoi link', u: 'https://linktr.ee/amicodiverte' },
  { t: 'Il libro «Racconti Horror»', u: 'https://www.amazon.it/dp/8832118440' },
];

function frame(src: string, title: string, cls: string) {
  return h('iframe', {
    src,
    title,
    class: cls,
    loading: 'lazy',
    allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
    allowfullscreen: true,
    referrerpolicy: 'strict-origin-when-cross-origin',
  });
}

export const podcastApp: AppDef = {
  id: 'podcast',
  name: 'Podcast',
  icon: ICONS.podcast,
  size: [720, 520],
  desktop: true,
  menu: true,
  launch({ win }) {
    const player = h('div', { class: 'pod-player' });
    const list = h('nav', { class: 'pod-list', 'aria-label': 'Podcast' });
    const status = h('div', { class: 'pod-status' }, 'Connessione esterna: 1 canale autorizzato');
    let current = '';
    function select(id: string) {
      current = id;
      const show = SHOWS.find((s) => s.id === id)!;
      player.replaceChildren(frame(`https://open.spotify.com/embed/show/${id}?utm_source=generator&theme=0`, show.nome, 'pod-frame'));
      win.setTitle(`Podcast — ${show.nome}`);
      render();
    }
    function render() {
      list.replaceChildren(
        h('div', { class: 'pod-author' }, icon(ICONS.podcast), h('span', {}, h('strong', {}, 'Amico Diverte'), h('small', {}, 'racconti horror'))),
        ...SHOWS.map((s) =>
          h(
            'button',
            { type: 'button', class: `pod-item${s.id === current ? ' is-active' : ''}`, onclick: () => select(s.id) },
            h('strong', {}, s.nome),
            h('small', {}, s.nota),
          ),
        ),
        h('div', { class: 'pod-note' }, 'Ascoltatori collegati a questa linea: ', h('span', { class: 'pod-listeners' }, '2')),
      );
    }
    win.body.append(h('div', { class: 'pod' }, list, h('div', { class: 'pod-main' }, player, status)));
    select(SHOWS[0].id);
    // Someone else is listening, too.
    const timer = window.setInterval(() => {
      const el = win.body.querySelector('.pod-listeners');
      if (el) el.textContent = Math.random() < 0.15 ? '3' : '2';
    }, 7000);
    win.onClose = () => clearInterval(timer);
  },
};

const HOME = 'sito47://home';
const NARRATOR = 'sito47://narratore';

/** Same rule as the content build: no scheme, no "www.", no trailing slash, lower case. */
function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
}

/** Inline markup: **bold**, *italic*, `code`, [label](address). */
function inline(text: string, navigate: (u: string) => void): (Node | string)[] {
  const out: (Node | string)[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(h('strong', {}, m[1]));
    else if (m[2] !== undefined) out.push(h('em', {}, m[2]));
    else if (m[3] !== undefined) out.push(h('code', {}, m[3]));
    else {
      const target = m[5];
      out.push(h('a', { href: '#', class: 'br-link', onclick: (e: Event) => (e.preventDefault(), navigate(target)) }, m[4]));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A tiny Markdown subset for the in-story pages. */
function renderPage(text: string, navigate: (u: string) => void): HTMLElement {
  const page = h('div', { class: 'br-page' });
  const lines = text.split('\n');
  let list: HTMLElement | null = null;
  let table: HTMLElement | null = null;
  const flush = () => {
    list = null;
    table = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\|.*\|$/.test(line)) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      if (!table) {
        table = h('table', { class: 'br-table' });
        page.append(table);
        table.append(h('tr', {}, ...cells.map((c) => h('th', {}, ...inline(c, navigate)))));
      } else table.append(h('tr', {}, ...cells.map((c) => h('td', {}, ...inline(c, navigate)))));
      continue;
    }
    const item = /^(?:-|\d+\.)\s+(.*)$/.exec(line);
    if (item) {
      table = null;
      if (!list) {
        list = h(/^\d/.test(line) ? 'ol' : 'ul', {});
        page.append(list);
      }
      list.append(h('li', {}, ...inline(item[1], navigate)));
      continue;
    }
    flush();
    if (!line) continue;
    if (line === '&nbsp;') page.append(h('div', { class: 'br-gap' }));
    else if (line.startsWith('## ')) page.append(h('h3', {}, ...inline(line.slice(3), navigate)));
    else if (line.startsWith('# ')) page.append(h('h2', {}, ...inline(line.slice(2), navigate)));
    else if (line.startsWith('> ')) page.append(h('p', { class: 'br-warn' }, ...inline(line.slice(2), navigate)));
    else if (line.startsWith('<small>')) page.append(h('p', { class: 'br-small' }, ...inline(line.replace(/<\/?small>/g, ''), navigate)));
    else page.append(h('p', {}, ...inline(line, navigate)));
  }
  return page;
}

export const browserApp: AppDef = {
  id: 'browser',
  name: 'Browser',
  icon: ICONS.browser,
  size: [860, 600],
  desktop: true,
  menu: true,
  launch({ session, desktop, win }) {
    const acc = session.desktop;
    const address = h('input', { type: 'text', class: 'field br-address', 'aria-label': 'Indirizzo', spellcheck: 'false' }) as HTMLInputElement;
    const view = h('div', { class: 'br-view' });
    const history: string[] = [];
    let index = -1;
    let token = 0;
    let shown = '';
    const back = h('button', { type: 'button', class: 'btn tool', title: 'Indietro', onclick: () => go(-1) }, '◀');
    const fwd = h('button', { type: 'button', class: 'btn tool', title: 'Avanti', onclick: () => go(1) }, '▶');
    const reload = h('button', { type: 'button', class: 'btn tool', title: 'Ricarica', onclick: () => void show(history[index]) }, '⟳');
    const home = h('button', { type: 'button', class: 'btn tool', title: 'Pagina iniziale', onclick: () => navigate(HOME) }, '⌂');
    win.body.append(h('div', { class: 'br' }, h('div', { class: 'br-bar' }, back, fwd, reload, home, address), view));

    const reachable = () => session.manifest.web.filter((w) => !w.v || session.state.fired.includes(w.v));
    const bookmark = (label: string, url: string, note: string) =>
      h('button', { type: 'button', class: 'br-bookmark', onclick: () => navigate(url) }, icon(ICONS.browser), h('span', {}, h('strong', {}, label), h('small', {}, note)));

    function homePage(): [string, HTMLElement] {
      const order = ['intranet.', 'meridiana', 'radioascolto', 'cronache'];
      const rank = (u: string) => {
        const i = order.findIndex((o) => u.startsWith(o));
        return i < 0 ? order.length : i;
      };
      const marks = reachable()
        .filter((w): w is WebEntry & { s: { t: string; n: string } } => Boolean(w.s))
        .sort((a, b) => rank(a.u) - rank(b.u));
      return [
        'Pagina iniziale',
        h(
          'div',
          { class: 'br-page br-home' },
          h('h2', {}, 'Rete — Sito-47'),
          h('p', { class: 'br-warn' }, 'Protocollo CENERE attivo: la rete esterna è filtrata. Restano raggiungibili solo gli indirizzi in cache.'),
          h('p', {}, 'Segnalibri:'),
          h(
            'div',
            { class: 'br-bookmarks' },
            ...marks.map((w) => bookmark(w.s.t, w.u, w.s.n)),
            bookmark('Registro pubblico — «Il Narratore»', NARRATOR, 'sito47://narratore · soggetto d’interesse SdI-47-N'),
          ),
          h('p', { class: 'br-small' }, 'Nota a penna sul monitor: «la cronologia l’ho cancellata io. Non riaprite quello che ho chiuso».'),
        ),
      ];
    }

    function narratorPage(): [string, HTMLElement] {
      return [
        'Il Narratore',
        h(
          'div',
          { class: 'br-page br-narrator' },
          h('p', { class: 'br-small' }, 'Fondazione · Registro pubblico dei soggetti d’interesse'),
          h('h2', {}, 'SdI-47-N — «Il Narratore» (Amico Diverte)'),
          h(
            'p',
            {},
            'Narratore di racconti dell’orrore e creepypasta, che scrive e legge ad alta voce ogni settimana per decine di migliaia di ascoltatori. Nessuna anomalia rilevata: le sue storie sono storie.',
          ),
          h(
            'p',
            {},
            'È l’unico indirizzo esterno che la Fondazione ha scelto di non oscurare. Nota della Dr.ssa Costa: «Raccontare una cosa è il modo più sicuro di renderla innocua. Chi ascolta una storia sa che è solo una storia.»',
          ),
          h(
            'div',
            { class: 'br-actions' },
            ...LINKS.map((l) => h('a', { href: l.u, target: '_blank', rel: 'noopener', class: 'btn' }, `${l.t} ↗`)),
            h('button', { type: 'button', class: 'btn', onclick: () => void desktop.open('podcast') }, 'Ascoltalo nell’app Podcast'),
          ),
          h('p', { class: 'br-small' }, 'I collegamenti si aprono in una nuova scheda, fuori da FONDAZIONE OS.'),
        ),
      ];
    }

    function errorPage(url: string): [string, HTMLElement] {
      return [
        'Errore',
        h(
          'div',
          { class: 'br-page br-error' },
          h('h2', {}, 'Impossibile raggiungere il sito'),
          h('p', {}, h('code', {}, url), ' non è raggiungibile dalla rete del Sito-47.'),
          h('p', { class: 'br-small' }, 'ERR_CENERE_ISOLAMENTO — Collegamenti esterni sospesi dal 03/03/2026 07:40.'),
          h('p', {}, h('button', { type: 'button', class: 'btn', onclick: () => navigate(HOME) }, 'Torna alla pagina iniziale')),
        ),
      ];
    }

    async function resolve(url: string): Promise<[string, HTMLElement]> {
      if (url === normalize(HOME) || url === '') return homePage();
      if (url === normalize(NARRATOR)) return narratorPage();
      if (url.includes('spotify')) {
        return ['Podcast', h('div', { class: 'br-page br-error' }, h('h2', {}, 'Usa l’app Podcast'), h('p', {}, 'L’audio esterno passa solo dall’app Podcast del sistema.'))];
      }
      const entry = reachable().find((w) => w.u === url);
      if (!entry) return errorPage(url);
      const p = await acc.openLevel(entry.b, entry.l);
      if (!p) {
        return [
          'Accesso negato',
          h(
            'div',
            { class: 'br-page br-error' },
            h('h2', {}, '403 — Accesso negato'),
            h('p', {}, `Questa pagina richiede un’autorizzazione di livello ${entry.l}.`),
          ),
        ];
      }
      return [p.titolo, renderPage(await acc.renderBody(p.testo), navigate)];
    }

    function displayed(url: string) {
      return url.startsWith('sito47://') ? url : `https://${url}`;
    }

    async function show(raw: string) {
      const url = normalize(raw);
      const my = ++token;
      const [title, el] = await resolve(url);
      if (my !== token) return;
      address.value = url ? displayed(url) : HOME;
      const keep = url === shown ? view.scrollTop : 0;
      shown = url;
      view.replaceChildren(el);
      view.scrollTop = keep;
      win.setTitle(`Browser — ${title}`);
      back.toggleAttribute('disabled', index <= 0);
      fwd.toggleAttribute('disabled', index >= history.length - 1);
    }
    function navigate(raw: string) {
      const url = normalize(raw) || normalize(HOME);
      history.splice(index + 1);
      history.push(url);
      index = history.length - 1;
      void show(url);
    }
    function go(d: number) {
      const next = index + d;
      if (next < 0 || next >= history.length) return;
      index = next;
      void show(history[index]);
    }
    address.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigate(address.value);
    });
    // Logging in as someone else (or a new event) may unlock the page on screen.
    const off = session.onChange(() => void show(history[index]));
    win.onClose = () => off();
    navigate(HOME);
  },
};
