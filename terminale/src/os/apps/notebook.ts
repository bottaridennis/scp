/**
 * Taccuino: the technician's notebook. Current objective with up to three hints, and the notes
 * the technician writes automatically as clues are found (content/taccuino/).
 */
import type { Session } from '../../engine/session.ts';
import type { AppDef, Desktop } from '../desktop.ts';
import { h } from '../dom.ts';
import { ICONS } from '../icons.ts';

export const notebookApp: AppDef = {
  id: 'notebook',
  name: 'Taccuino',
  icon: ICONS.notebook,
  size: [520, 560],
  desktop: true,
  menu: true,
  badge: (session) => {
    const n = session.unseenNotes();
    return n ? String(n) : '';
  },
  launch({ session, win }) {
    const root = h('div', { class: 'notebook' });
    win.body.append(root);
    let token = 0;

    async function render() {
      const my = ++token;
      const objective = session.currentObjective();
      const goal = objective ? await session.openNotebook(objective) : null;
      const notes = await Promise.all(session.notes().map(async (n) => ({ n, p: await session.openNotebook(n) })));
      if (my !== token) return;
      const seen = new Set(session.state.notesSeen);

      const goalBox = h('section', { class: 'nb-goal' }, h('h3', {}, 'Obiettivo'));
      if (objective && goal) {
        const shown = session.state.hints[objective.id] ?? 0;
        goalBox.append(h('p', { class: 'nb-goal-title' }, goal.titolo));
        goal.aiuti.slice(0, shown).forEach((t, i) => goalBox.append(h('p', { class: 'nb-hint' }, h('strong', {}, `Aiuto ${i + 1}: `), t)));
        if (shown < goal.aiuti.length) {
          goalBox.append(
            h(
              'button',
              { type: 'button', class: 'btn', onclick: () => session.nextHint(objective) },
              shown ? `Un altro aiuto (${shown}/${goal.aiuti.length})` : 'Chiedi un aiuto',
            ),
          );
        }
      } else goalBox.append(h('p', { class: 'muted' }, 'Nessun obiettivo in corso.'));

      const list = h('section', { class: 'nb-notes' }, h('h3', {}, 'Appunti'));
      if (!notes.length) list.append(h('p', { class: 'muted' }, 'Ancora niente. Annoto da solo quello che scopro leggendo i documenti.'));
      for (const { n, p } of notes) {
        if (!p) continue;
        list.append(h('p', { class: `nb-note${seen.has(n.id) ? '' : ' is-new'}` }, p.testo));
      }
      root.replaceChildren(goalBox, list);
      session.markNotesSeen();
    }

    const off = session.onChange(() => void render());
    win.onClose = () => off();
    void render();
  },
};

/** Toasts when a new objective starts or a note is written, so the player knows where to look. */
export function installNotebookWatcher(session: Session, desktop: Desktop) {
  let objective = session.currentObjective()?.id ?? null;
  let notes = session.notes().length;
  let lastToast = 0;
  session.onChange(() => {
    const o = session.currentObjective();
    const n = session.notes().length;
    if (o && o.id !== objective) {
      void session.openNotebook(o).then((p) => {
        if (p) desktop.toast('Nuovo obiettivo', p.titolo, 'info', () => void desktop.open('notebook'));
      });
    } else if (n > notes && Date.now() - lastToast > 4000) {
      lastToast = Date.now();
      desktop.toast('Taccuino', 'Ho annotato qualcosa di utile.', 'info', () => void desktop.open('notebook'));
    }
    objective = o?.id ?? null;
    notes = n;
  });
}
