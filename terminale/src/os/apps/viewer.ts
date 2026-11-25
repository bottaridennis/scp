/** Document viewer (.txt/.log of the game, SCP documents in HTML) and image viewer. */
import { basename, type DocMeta, type ReadResult } from '../../engine/vfs.ts';
import type { AppContext, AppDef } from '../desktop.ts';
import { h, icon } from '../dom.ts';
import { ICONS } from '../icons.ts';

const handles = new WeakMap<object, (path: string) => void>();

/** Game documents: keeps the typewriter layout, styles titles and redactions. */
function typedText(text: string): HTMLElement {
  const pre = h('pre', { class: 'doc-text' });
  for (const line of text.split('\n')) {
    const heading = /^#{1,2}\s/.test(line);
    const row = h('span', { class: heading ? 'doc-h' : /^>\s?/.test(line) ? 'doc-q' : '' });
    const body = line.replace(/^#{1,2}\s+/, '').replace(/^>\s?/, '');
    for (const part of body.split(/(█+|\[DATI ELIMINATI\])/)) {
      if (!part) continue;
      row.append(/^█/.test(part) ? h('span', { class: 'redact' }, part) : part.startsWith('[DATI') ? h('span', { class: 'expunged' }, 'DATI ELIMINATI') : part);
    }
    pre.append(row, '\n');
  }
  return pre;
}

function relatedBar(ctx: AppContext, meta: DocMeta | undefined) {
  if (!meta?.related?.length) return null;
  return h(
    'div',
    { class: 'doc-related' },
    h('span', { class: 'muted' }, 'Nel fascicolo:'),
    ...meta.related.map((r) =>
      h(
        'button',
        { type: 'button', class: `chip${r.locked ? ' is-locked' : ''}`, title: r.locked ? 'Livello insufficiente' : r.name, onclick: () => ctx.desktop.openPath(r.path) },
        icon(r.locked ? ICONS.docLocked : r.kind === 'image' ? ICONS.image : ICONS.docHtml),
        r.name,
      ),
    ),
  );
}

function licenceBox(meta: DocMeta) {
  return h(
    'footer',
    { class: 'doc-licence' },
    h('strong', {}, 'Licenza e crediti'),
    h(
      'p',
      {},
      `«${meta.title}»${meta.author ? ` di ${meta.author}` : ''}, dal SCP Wiki. Fonte: `,
      meta.source ? h('a', { href: meta.source, target: '_blank', rel: 'noopener noreferrer' }, meta.source) : '—',
      '. Licenza ',
      h('a', { href: 'https://creativecommons.org/licenses/by-sa/3.0/deed.it', target: '_blank', rel: 'noopener noreferrer' }, 'CC BY-SA 3.0'),
      '. Testo riformattato per questa postazione; la versione modificata è distribuita con la stessa licenza.',
    ),
    meta.credits ? h('div', { class: 'doc-credits', html: meta.credits }) : null,
  );
}

function errorPanel(res: Extract<ReadResult, { ok: false }>, retry: () => void) {
  const denied = res.reason === 'denied';
  return h(
    'div',
    { class: `doc-error${denied ? ' is-denied' : ''}` },
    denied ? h('div', { class: 'stamp' }, 'ACCESSO NEGATO') : icon(res.reason === 'encrypted' ? ICONS.docEncrypted : ICONS.warning, 'ico ico-xl'),
    h('p', {}, res.message),
    res.reason === 'error' ? h('button', { type: 'button', class: 'btn', onclick: retry }, 'Riprova') : null,
  );
}

export const viewerApp: AppDef = {
  id: 'viewer',
  name: 'Visualizzatore documenti',
  icon: ICONS.doc,
  size: [720, 560],
  multi: true,
  launch(ctx, args) {
    const { session, desktop, win } = ctx;
    const page = h('div', { class: 'doc-scroll' });
    win.body.append(page);

    async function load(path: string) {
      win.args = { path };
      win.setTitle(`${basename(path)} — Visualizzatore`);
      page.replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Apertura del documento…'));
      let res: ReadResult;
      try {
        res = await session.fs.read(path, session.desktop);
      } catch (err) {
        res = { ok: false, reason: 'error', message: `Connessione all’archivio centrale fallita. ${(err as Error).message}` };
      }
      if (!res.ok) {
        if (res.reason === 'denied') session.sound.alert('sistema');
        page.replaceChildren(errorPanel(res, () => void load(path)));
        return;
      }
      if (res.kind === 'image') {
        void desktop.open('image', { path });
        win.close();
        return;
      }
      if (res.kind === 'text') {
        desktop.addRecent(path, basename(path));
        page.replaceChildren(
          h('article', { class: 'doc-paper is-typed' }, h('header', { class: 'doc-head' }, h('span', {}, path), h('span', { class: 'doc-site' }, 'FONDAZIONE SCP · SITO-47')), typedText(res.text)),
        );
        return;
      }
      const m = res.meta;
      desktop.addRecent(path, m.title);
      win.setTitle(`${m.title} — Visualizzatore`);
      page.replaceChildren(
        h(
          'article',
          { class: 'doc-paper is-scp' },
          h(
            'header',
            { class: 'doc-head' },
            h('span', {}, 'FONDAZIONE SCP · ARCHIVIO CENTRALE'),
            h('span', { class: `doc-level lvl-${m.level ?? 0}` }, `LIVELLO ${m.level ?? '?'}`),
          ),
          h('h1', { class: 'doc-title' }, m.title),
          m.classLabel ? h('p', { class: 'doc-class' }, `Classe dell’oggetto: ${m.classLabel}`) : null,
          relatedBar(ctx, m),
          h('div', { class: 'scp-content', html: res.html }),
          licenceBox(m),
        ),
      );
      // Links inside documents: open other archive paths in the viewer.
      page.querySelectorAll<HTMLAnchorElement>('a[data-path]').forEach((a) =>
        a.addEventListener('click', (e) => {
          e.preventDefault();
          desktop.openPath(a.dataset.path!);
        }),
      );
    }

    handles.set(win, (p) => void load(p));
    const path = (args as { path?: string } | undefined)?.path;
    if (path) void load(path);
    else page.replaceChildren(h('div', { class: 'list-empty' }, 'Nessun documento aperto.'));
  },
};

export const imageApp: AppDef = {
  id: 'image',
  name: 'Visualizzatore immagini',
  icon: ICONS.image,
  size: [640, 520],
  multi: true,
  launch(ctx, args) {
    const { session, desktop, win } = ctx;
    const path = (args as { path?: string } | undefined)?.path ?? '';
    win.args = { path };
    win.setTitle(`${basename(path)} — Immagini`);
    const stage = h('div', { class: 'img-stage' }, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Caricamento…'));
    const caption = h('div', { class: 'statusbar img-caption' });
    win.body.append(stage, caption);
    void session.fs.read(path, session.desktop).then(
      (res) => {
        if (!res.ok) return stage.replaceChildren(errorPanel(res, () => win.close()));
        if (res.kind !== 'image') {
          void desktop.open('viewer', { path });
          return win.close();
        }
        const img = h('img', { src: res.src, alt: res.caption, referrerpolicy: 'no-referrer', class: 'is-fit' });
        img.addEventListener('click', () => img.classList.toggle('is-fit'));
        img.addEventListener('error', () => stage.replaceChildren(h('div', { class: 'list-error' }, icon(ICONS.warning, 'ico ico-lg'), h('p', {}, 'Immagine non disponibile sull’archivio centrale.'))));
        stage.replaceChildren(img);
        caption.replaceChildren(h('span', {}, res.caption || basename(path)));
        if (res.meta?.source)
          caption.append(
            h('span', { class: 'muted' }, ` · «${res.meta.title}»${res.meta.author ? ` di ${res.meta.author}` : ''} · CC BY-SA 3.0 · `, h('a', { href: res.meta.source, target: '_blank', rel: 'noopener noreferrer' }, 'fonte')),
          );
        desktop.addRecent(path, basename(path));
      },
      () => stage.replaceChildren(h('div', { class: 'list-error' }, h('p', {}, 'Connessione all’archivio centrale fallita.'))),
    );
  },
};
