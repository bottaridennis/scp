/**
 * Easter egg for Amico Diverte (horror storyteller): a podcast player and a tiny web browser.
 * Both embed the creator's real public pages (official Spotify / YouTube embeds) and load
 * nothing until the app is opened.
 */
import type { AppDef } from '../desktop.ts';
import { h, icon } from '../dom.ts';
import { ICONS } from '../icons.ts';

const SHOWS = [
  { id: '29DMbQ1XQ0gYkCNwUTvTDO', nome: 'Paranormale — Attraverso il velo', nota: 'storie vere e indagini paranormali' },
  { id: '01SBlQ1sqa5LkBWVjFAgQR', nome: 'Le Cronache dei Pixel', nota: 'storia e lore dei videogiochi' },
];

const YT_HANDLE = 'youtube.com/@AmicoDiverte_Racconti_Horror';
const YT_URL = `https://www.${YT_HANDLE}`;
/** Uploads playlist of the channel (UC… → UU…). */
const YT_EMBED = 'https://www.youtube-nocookie.com/embed/videoseries?list=UUMu-RvfTu9qqyHDGDtmX1GA';

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

type Page = { url: string; title: string; body: () => HTMLElement };

export const browserApp: AppDef = {
  id: 'browser',
  name: 'Browser',
  icon: ICONS.browser,
  size: [900, 620],
  desktop: true,
  menu: true,
  launch({ win }) {
    const address = h('input', { type: 'text', class: 'field br-address', 'aria-label': 'Indirizzo', spellcheck: 'false' }) as HTMLInputElement;
    const view = h('div', { class: 'br-view' });
    const history: string[] = [];
    let index = -1;
    const back = h('button', { type: 'button', class: 'btn tool', title: 'Indietro', onclick: () => go(-1) }, '◀');
    const fwd = h('button', { type: 'button', class: 'btn tool', title: 'Avanti', onclick: () => go(1) }, '▶');
    const reload = h('button', { type: 'button', class: 'btn tool', title: 'Ricarica', onclick: () => show(history[index], false) }, '⟳');
    const home = h('button', { type: 'button', class: 'btn tool', title: 'Pagina iniziale', onclick: () => navigate('sito47://home') }, '⌂');
    win.body.append(h('div', { class: 'br' }, h('div', { class: 'br-bar' }, back, fwd, reload, home, address), view));

    const bookmark = (label: string, url: string, note: string) =>
      h('button', { type: 'button', class: 'br-bookmark', onclick: () => navigate(url) }, icon(ICONS.browser), h('span', {}, h('strong', {}, label), h('small', {}, note)));

    const pages = (url: string): Page => {
      const u = url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      if (u === 'sito47://home' || u === '') {
        return {
          url: 'sito47://home',
          title: 'Pagina iniziale',
          body: () =>
            h(
              'div',
              { class: 'br-page br-home' },
              h('h2', {}, 'Rete esterna — Sito-47'),
              h('p', { class: 'br-warn' }, 'Protocollo CENERE attivo: il collegamento verso l’esterno è limitato. Siti raggiungibili: 1.'),
              h('p', {}, 'Segnalibri lasciati dal turno di notte:'),
              h('div', { class: 'br-bookmarks' }, bookmark('Amico Diverte — Racconti Horror', YT_URL, YT_HANDLE)),
              h('p', { class: 'br-small' }, 'Nota a penna sul monitor: «solo con le cuffie. NON vicino al microfono di T-03».'),
            ),
        };
      }
      if (u.startsWith('youtube.com/@amicodiverte') || u === 'youtube.com/user/amicodiverte' || u === 'youtube.com/amicodiverte') {
        return {
          url: YT_URL,
          title: 'Amico Diverte — Racconti Horror',
          body: () => {
            const watching = h('p', { class: 'br-small br-watching' });
            const page = h(
              'div',
              { class: 'br-page br-yt' },
              h('div', { class: 'br-yt-head' }, h('h2', {}, 'Amico Diverte — Racconti Horror'), h('p', {}, 'Creepypasta e racconti di paura, narrati, recitati e inventati.')),
              frame(YT_EMBED, 'Video di Amico Diverte', 'br-frame'),
              h(
                'p',
                { class: 'br-actions' },
                h('a', { href: YT_URL, target: '_blank', rel: 'noopener', class: 'btn' }, 'Apri il canale su YouTube ↗'),
                h('a', { href: 'https://linktr.ee/amicodiverte', target: '_blank', rel: 'noopener', class: 'btn' }, 'Tutti i link ↗'),
              ),
              watching,
            );
            window.setTimeout(() => {
              watching.textContent = 'Spettatori da questa rete: 2 — T-03 · interno 4';
            }, 45_000);
            return page;
          },
        };
      }
      if (u.includes('spotify')) {
        return {
          url,
          title: 'Reindirizzamento',
          body: () =>
            h('div', { class: 'br-page br-error' }, h('h2', {}, 'Usa l’app Podcast'), h('p', {}, 'L’audio esterno passa solo dall’app Podcast del sistema.')),
        };
      }
      return {
        url,
        title: 'Errore',
        body: () =>
          h(
            'div',
            { class: 'br-page br-error' },
            h('h2', {}, 'Impossibile raggiungere il sito'),
            h('p', {}, h('code', {}, url), ' non è raggiungibile dalla rete del Sito-47.'),
            h('p', { class: 'br-small' }, 'ERR_CENERE_ISOLAMENTO — Collegamenti esterni sospesi dal 03/03/2026 07:40.'),
            h('p', {}, h('button', { type: 'button', class: 'btn', onclick: () => navigate('sito47://home') }, 'Torna alla pagina iniziale')),
          ),
      };
    };

    function show(url: string, push: boolean) {
      const page = pages(url);
      if (push) {
        history.splice(index + 1);
        history.push(page.url);
        index = history.length - 1;
      }
      address.value = page.url;
      view.replaceChildren(page.body());
      win.setTitle(`Browser — ${page.title}`);
      back.toggleAttribute('disabled', index <= 0);
      fwd.toggleAttribute('disabled', index >= history.length - 1);
    }
    function navigate(url: string) {
      show(url.trim() || 'sito47://home', true);
    }
    function go(d: number) {
      const next = index + d;
      if (next < 0 || next >= history.length) return;
      index = next;
      show(history[index], false);
    }
    address.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigate(address.value);
    });
    navigate('sito47://home');
  },
};
