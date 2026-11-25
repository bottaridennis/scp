/** Posta: graphical client on top of the existing mail system (desktop account). */
import { GUEST } from '../../engine/game.ts';
import type { MailEntry } from '../../engine/types.ts';
import type { AppDef } from '../desktop.ts';
import { h, icon } from '../dom.ts';
import { ICONS } from '../icons.ts';
import { typedText } from './viewer.ts';

export const mailApp: AppDef = {
  id: 'mail',
  name: 'Posta',
  icon: ICONS.mail,
  size: [780, 500],
  desktop: true,
  menu: true,
  badge: (session) => {
    const n = session.desktop.user === GUEST ? 0 : session.unreadMail();
    return n ? String(n) : '';
  },
  launch({ session, win }) {
    const acc = session.desktop;
    const list = h('div', { class: 'list mail-list', role: 'listbox', 'aria-label': 'Messaggi' });
    const reader = h('div', { class: 'mail-reader' });
    const pane = h('div', { class: 'mail' }, list, reader);
    win.body.append(pane);
    win.setTitle(`Posta — ${acc.user}`);
    let selected: string | null = null;

    if (acc.user === GUEST) {
      pane.replaceChildren(h('div', { class: 'list-error' }, icon(ICONS.mail, 'ico ico-lg'), h('p', {}, 'L’utente ospite non ha una casella di posta. Accedi con un profilo dalla schermata di login.')));
      return;
    }

    const isRead = (m: MailEntry) => session.state.mailRead.includes(`${acc.user}/${m.id}`);

    async function open(m: MailEntry) {
      selected = m.id;
      pane.classList.add('is-reading');
      reader.replaceChildren(h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Apertura…'));
      const body = await acc.readMail(m);
      reader.replaceChildren(
        h(
          'div',
          { class: 'mail-head' },
          h('button', { type: 'button', class: 'btn tool mail-back', onclick: () => pane.classList.remove('is-reading') }, '◄ Messaggi'),
          h('h2', {}, m.oggetto),
          h('dl', {}, h('dt', {}, 'Da'), h('dd', {}, m.da), h('dt', {}, 'A'), h('dd', {}, m.a), h('dt', {}, 'Data'), h('dd', {}, m.data)),
        ),
        h('div', { class: 'mail-body' }, typedText(body)),
      );
      session.markMailRead(acc.user, m.id);
      render();
    }

    function render() {
      const mails = acc.visibleMail();
      if (!mails.length) {
        list.replaceChildren(h('div', { class: 'list-empty' }, 'Nessun messaggio.'));
        return;
      }
      list.replaceChildren(
        ...[...mails].reverse().map((m) =>
          h(
            'button',
            { type: 'button', role: 'option', class: `mail-item${isRead(m) ? '' : ' is-unread'}${selected === m.id ? ' is-selected' : ''}`, onclick: () => void open(m) },
            icon(ICONS.mail),
            h('span', { class: 'mail-from' }, m.da),
            h('span', { class: 'mail-subject' }, m.oggetto),
            h('span', { class: 'mail-date' }, m.data),
          ),
        ),
      );
      if (!selected) reader.replaceChildren(h('div', { class: 'list-empty' }, `${mails.length} messaggi, ${session.unreadMail()} non letti. Seleziona un messaggio.`));
    }

    const off = session.onChange(render);
    win.onClose = () => off();
    render();
  },
};
