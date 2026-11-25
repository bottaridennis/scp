/** Small message boxes (Accesso negato, file cifrato, errori). */
import type { Desktop } from './desktop.ts';
import { h, icon } from './dom.ts';
import { ICONS } from './icons.ts';

export function messageBox(desktop: Desktop, title: string, text: string, kind: 'info' | 'warning' | 'denied' = 'info') {
  const win = desktop.wm.open({ app: 'dialog', title, icon: ICONS.warning, size: [380, 170] });
  const ok = h('button', { type: 'button', class: 'btn btn-default', onclick: () => win.close() }, 'OK');
  win.body.append(
    h(
      'div',
      { class: `msgbox msgbox-${kind}` },
      icon(kind === 'info' ? ICONS.logo : kind === 'denied' ? ICONS.docLocked : ICONS.warning, 'ico ico-lg'),
      h('p', {}, text),
    ),
    h('div', { class: 'btn-row msgbox-btns' }, ok),
  );
  if (kind === 'denied') desktop.session.sound.alert('sistema');
  setTimeout(() => ok.focus(), 0);
}
