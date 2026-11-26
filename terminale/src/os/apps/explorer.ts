/**
 * Esplora risorse: browses the virtual filesystem with the same permissions
 * as the terminal. Hidden files (".nome") are not shown: use `ls -a`.
 */
import { GUEST } from '../../engine/game.ts';
import { dirname, type VNode } from '../../engine/vfs.ts';
import type { AppContext, AppDef, Desktop } from '../desktop.ts';
import { showContextMenu } from '../contextmenu.ts';
import { messageBox } from '../dialog.ts';
import { h, icon, isTouch } from '../dom.ts';
import { ICONS } from '../icons.ts';

const PAGE = 200;

type SortKey = 'name' | 'type' | 'level' | 'size';
type ExplorerState = { path: string; history: string[]; page: number; sort: SortKey; dir: 1 | -1 };

export function nodeIcon(n: VNode) {
  if (n.kind === 'dir') return n.locked ? ICONS.folderLocked : ICONS.folder;
  if (n.locked) return ICONS.docLocked;
  if (n.encrypted) return ICONS.docEncrypted;
  if (n.kind === 'image') return ICONS.image;
  if (n.kind === 'html') return ICONS.docHtml;
  return ICONS.doc;
}

/** "Proprietà" dialog for a file or folder. */
export async function showNodeProps(desktop: Desktop, n: VNode) {
  const acc = desktop.session.desktop;
  const props = n.kind === 'dir' || n.locked || n.encrypted ? null : await desktop.session.fs.props?.(n.path, acc);
  const lines = [
    `Nome: ${n.name}`,
    `Percorso: ${n.path}`,
    `Tipo: ${n.label ?? typeLabel(n)}`,
    `Livello di accesso: ${n.level}`,
    ...(n.size !== undefined && n.kind !== 'dir' ? [`Dimensione: ${formatSize(n.size)}`] : []),
    n.locked ? 'Autore: riservato' : n.encrypted ? 'Autore: cifrato' : props?.autore ? `Autore: ${props.autore}` : '',
    props?.modificato ? `Ultima modifica: ${props.modificato}` : '',
    n.hidden ? 'Attributi: nascosto' : '',
  ].filter(Boolean);
  messageBox(desktop, `Proprietà — ${n.name}`, lines.join('\n'));
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} byte`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function typeLabel(n: VNode) {
  if (n.kind === 'dir') return 'Cartella';
  if (n.encrypted) return 'File cifrato';
  if (n.kind === 'image') return 'Immagine';
  if (n.kind === 'html') return 'Documento SCP';
  return 'Documento di testo';
}

const handles = new WeakMap<object, (path: string) => void>();

export const explorerApp: AppDef = {
  id: 'explorer',
  name: 'Esplora risorse',
  icon: ICONS.folder,
  size: [760, 500],
  multi: true,
  desktop: true,
  menu: true,
  reuse(ctx, args) {
    const path = (args as { path?: string } | undefined)?.path;
    if (path) handles.get(ctx.win)?.(path);
  },
  launch(ctx: AppContext, args) {
    const { session, desktop, win } = ctx;
    const acc = session.desktop;
    const home = acc.user === GUEST ? '/' : acc.homeOf(acc.user);
    const st: ExplorerState = { path: (args as { path?: string } | undefined)?.path ?? home, history: [], page: 0, sort: 'name', dir: 1 };

    const back = h('button', { type: 'button', class: 'btn tool', title: 'Indietro', onclick: () => goBack() }, '◄');
    const up = h('button', { type: 'button', class: 'btn tool', title: 'Cartella superiore', onclick: () => navigate(dirname(st.path)) }, '▲');
    const address = h('input', { class: 'field address', 'aria-label': 'Percorso', spellcheck: 'false' });
    let selectedNode: VNode | null = null;
    const propsBtn = h('button', { type: 'button', class: 'btn tool', title: 'Proprietà del file selezionato', onclick: () => void showProps() }, 'Proprietà');
    address.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigate(address.value.trim() || '/');
    });
    const places = h('nav', { class: 'places', 'aria-label': 'Posizioni' });
    const list = h('div', { class: 'list files', role: 'listbox', tabindex: '0' });
    const status = h('div', { class: 'statusbar' });
    const crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Percorso' });
    const header = h('div', { class: 'file-head' });
    const pane = h('div', { class: 'files-pane' }, header, list);
    win.body.append(
      h('div', { class: 'toolbar' }, back, up, address, propsBtn),
      crumbs,
      h('div', { class: 'explorer' }, places, pane),
      status,
    );

    const COLS: [SortKey, string][] = [['name', 'Nome'], ['type', 'Tipo'], ['size', 'Dimensione'], ['level', 'Livello']];
    function renderHeader() {
      header.replaceChildren(
        ...COLS.map(([key, label]) =>
          h(
            'button',
            {
              type: 'button',
              class: `file-col col-${key}${st.sort === key ? ' is-sorted' : ''}`,
              onclick: () => {
                st.dir = st.sort === key ? (st.dir === 1 ? -1 : 1) : 1;
                st.sort = key;
                void render();
              },
            },
            label,
            st.sort === key ? (st.dir === 1 ? ' ▲' : ' ▼') : '',
          ),
        ),
      );
    }
    function renderCrumbs() {
      const parts = st.path.split('/').filter(Boolean);
      crumbs.replaceChildren(
        h('button', { type: 'button', class: 'crumb', onclick: () => navigate('/') }, 'Risorse del computer'),
        ...parts.flatMap((part, i) => [
          h('span', { class: 'crumb-sep' }, '›'),
          h('button', { type: 'button', class: 'crumb', onclick: () => navigate(`/${parts.slice(0, i + 1).join('/')}`) }, part),
        ]),
      );
    }
    function sorted(entries: VNode[]) {
      const val = (n: VNode): string | number =>
        st.sort === 'size' ? (n.size ?? -1) : st.sort === 'level' ? n.level : st.sort === 'type' ? (n.label ?? typeLabel(n)) : n.name.toLowerCase();
      return [...entries].sort((a, b) => {
        if ((a.kind === 'dir') !== (b.kind === 'dir')) return a.kind === 'dir' ? -1 : 1;
        const x = val(a);
        const y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * st.dir;
      });
    }

    const place = (label: string, path: string, svg: string) =>
      h('button', { type: 'button', class: 'place', onclick: () => navigate(path) }, icon(svg), h('span', {}, label));
    places.append(
      place('Risorse del computer', '/', ICONS.logo),
      ...(acc.user !== GUEST ? [place(`Home di ${acc.user}`, home, ICONS.user)] : []),
      place('Pubblico', '/pubblico', ICONS.folder),
      place('Archivio', '/archivio', ICONS.folder),
      ...session.fs.points.map((p) => place('Archivio SCP', p, ICONS.archive)),
    );

    let token = 0;
    async function render() {
      const my = ++token;
      address.value = st.path;
      renderCrumbs();
      renderHeader();
      win.setTitle(`Esplora risorse — ${st.path}`);
      win.args = { path: st.path };
      back.disabled = !st.history.length;
      up.disabled = st.path === '/';
      selectedNode = null;
      list.replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Lettura in corso…'));
      status.textContent = '';
      let node: VNode | null;
      let res: { entries: VNode[]; total: number };
      try {
        node = await session.fs.stat(st.path, acc);
        if (!node || node.kind !== 'dir') throw Object.assign(new Error('missing'), { missing: true });
        if (node.locked) throw Object.assign(new Error(node.reason ?? 'Accesso negato'), { denied: true });
        res = await session.fs.list(st.path, acc, { offset: st.page * PAGE, limit: PAGE });
      } catch (err) {
        if (my !== token) return;
        const e = err as Error & { missing?: boolean; denied?: boolean };
        list.replaceChildren(
          h(
            'div',
            { class: 'list-error' },
            icon(e.denied ? ICONS.folderLocked : ICONS.warning, 'ico ico-lg'),
            h('p', {}, e.missing ? `Percorso non trovato: ${st.path}` : e.denied ? `ACCESSO NEGATO — ${e.message}` : 'Connessione all’archivio centrale fallita.'),
            !e.missing && !e.denied ? h('button', { type: 'button', class: 'btn', onclick: () => void render() }, 'Riprova') : null,
          ),
        );
        return;
      }
      if (my !== token) return;
      const visible = sorted(res.entries.filter((e) => !e.hidden));
      list.replaceChildren(
        ...(visible.length
          ? visible.map((n) => {
              const row = h(
                'div',
                { class: `file-row${n.locked ? ' is-locked' : ''}`, role: 'option', tabindex: '-1', title: n.locked ? `${n.name} — ${n.reason}` : n.name },
                icon(nodeIcon(n)),
                h('span', { class: 'file-name' }, n.name),
                h('span', { class: 'file-type' }, n.label ?? typeLabel(n)),
                h('span', { class: 'file-size' }, n.kind === 'dir' || n.size === undefined ? '' : formatSize(n.size)),
                h('span', { class: 'file-level' }, n.level ? `L${n.level}` : ''),
              );
              row.addEventListener(isTouch() ? 'click' : 'dblclick', () => activate(n));
              row.addEventListener('click', () => {
                list.querySelectorAll('.is-selected').forEach((r) => r.classList.remove('is-selected'));
                row.classList.add('is-selected');
                selectedNode = n;
              });
              row.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                list.querySelectorAll('.is-selected').forEach((r) => r.classList.remove('is-selected'));
                row.classList.add('is-selected');
                selectedNode = n;
                showContextMenu(e.clientX, e.clientY, [
                  { label: n.kind === 'dir' ? 'Apri' : 'Apri', action: () => activate(n) },
                  ...(n.kind !== 'dir' && !n.locked ? [{ label: 'Copia percorso', action: () => void navigator.clipboard?.writeText(n.path) }] : []),
                  'sep',
                  { label: 'Proprietà', action: () => void showNodeProps(desktop, n) },
                ]);
              });
              row.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') activate(n);
              });
              return row;
            })
          : [h('div', { class: 'list-empty' }, 'Questa cartella è vuota.')]),
      );
      const pages = Math.ceil(res.total / PAGE);
      status.replaceChildren(h('span', {}, `${res.total} oggett${res.total === 1 ? 'o' : 'i'}`));
      if (pages > 1) {
        status.append(
          h(
            'span',
            { class: 'pager' },
            h('button', { type: 'button', class: 'btn tool', disabled: st.page === 0, onclick: () => setPage(st.page - 1) }, '«'),
            ` Pagina ${st.page + 1} di ${pages} `,
            h('button', { type: 'button', class: 'btn tool', disabled: st.page >= pages - 1, onclick: () => setPage(st.page + 1) }, '»'),
          ),
        );
      }
    }

    async function showProps() {
      const n = selectedNode;
      if (!n) return messageBox(desktop, 'Proprietà', 'Seleziona prima un file o una cartella.');
      await showNodeProps(desktop, n);
    }

    function setPage(p: number) {
      st.page = p;
      list.scrollTop = 0;
      void render();
    }

    function navigate(path: string, record = true) {
      if (record && path !== st.path) st.history.push(st.path);
      st.path = path;
      st.page = 0;
      void render();
    }

    function goBack() {
      const prev = st.history.pop();
      if (prev) navigate(prev, false);
    }

    function activate(n: VNode) {
      if (n.locked) return messageBox(desktop, 'Accesso negato', `ACCESSO NEGATO — ${n.reason ?? `Livello ${n.level} richiesto`}.`, 'denied');
      if (n.kind === 'dir') return navigate(n.path);
      if (n.encrypted)
        return messageBox(desktop, 'File cifrato', `«${n.name}» è cifrato e questo programma non può aprirlo.`, 'warning');
      desktop.openPath(n.path);
    }

    handles.set(win, (path) => navigate(path));
    void render();
  },
};
