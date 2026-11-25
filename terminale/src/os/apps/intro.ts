/** "Ordine di incarico": the briefing shown before the first login. */
import type { Session } from '../../engine/session.ts';
import type { AppDef } from '../desktop.ts';
import { h, icon } from '../dom.ts';
import { ICONS } from '../icons.ts';

function letter(session: Session) {
  const intro = session.manifest.meta.intro!;
  return h(
    'article',
    { class: 'doc-paper intro-letter' },
    h('header', { class: 'doc-head' }, h('span', {}, 'FONDAZIONE SCP · DIPARTIMENTO ARCHIVI'), h('span', { class: 'doc-site' }, 'RISERVATO')),
    h('h1', { class: 'doc-title' }, intro.titolo),
    ...intro.testo.map((p) => h('p', { class: 'intro-p' }, p)),
  );
}

/** Modal shown once, after the boot and before the login screen. */
export function showIntro(session: Session, mount: HTMLElement): Promise<void> {
  if (!session.manifest.meta.intro) return Promise.resolve();
  return new Promise((resolve) => {
    const ok = h('button', { type: 'button', class: 'btn btn-default' }, 'Accetto l’incarico');
    const overlay = h(
      'div',
      { class: 'intro-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ordine di incarico' },
      h(
        'div',
        { class: 'win is-active intro-win' },
        h('div', { class: 'win-titlebar' }, icon(ICONS.order), h('span', { class: 'win-title-text' }, 'Ordine di incarico — Dipartimento Archivi')),
        h('div', { class: 'win-body intro-body' }, h('div', { class: 'doc-scroll' }, letter(session)), h('div', { class: 'btn-row intro-btns' }, ok)),
      ),
    );
    ok.addEventListener('click', () => {
      session.state.introSeen = true;
      session.store.save();
      overlay.remove();
      resolve();
    });
    mount.append(overlay);
    setTimeout(() => ok.focus(), 0);
  });
}

export const introApp: AppDef = {
  id: 'intro',
  name: 'Ordine di incarico',
  icon: ICONS.order,
  size: [640, 560],
  menu: true,
  launch({ session, win }) {
    win.body.append(h('div', { class: 'doc-scroll' }, letter(session)));
  },
};
