/** Terminal app: the original game shell in a window, one account per terminal. */
import { Shell } from '../../engine/shell.ts';
import { Terminal } from '../../engine/terminal.ts';
import type { AppDef } from '../desktop.ts';
import { h, isTouch } from '../dom.ts';
import { ICONS } from '../icons.ts';

export const terminalApp: AppDef = {
  id: 'terminal',
  name: 'Terminale',
  icon: ICONS.terminal,
  size: [740, 470],
  multi: true,
  desktop: true,
  menu: true,
  async launch({ session, desktop, win }) {
    const screen = h('div', { class: 'crt-term' });
    win.body.classList.add('is-terminal');
    win.body.append(screen);
    if (isTouch()) {
      const key = (label: string, action: () => void) =>
        h('button', { type: 'button', onpointerdown: (e: Event) => e.preventDefault(), onclick: () => { action(); term.focus(); } }, label);
      win.body.append(
        h('div', { class: 'touchbar' }, key('Tab', () => term.complete()), key('↑', () => term.historyPrev()), key('↓', () => term.historyNext()), key('Salta', () => term.skip())),
      );
    }
    const term = new Terminal(screen);
    const account = await session.openAccount();
    const title = () => `Terminale — ${account.user}`;
    const shell = new Shell(term, session, account, {
      open: (path, acc) => desktop.openPath(path, acc),
      exit: () => win.close(),
      launch: (appId, args) => void desktop.open(appId, args),
      userChanged: () => win.setTitle(title()),
    });
    win.setTitle(title());
    win.onClose = () => session.closeAccount(account);
    win.onFocus = () => setTimeout(() => term.focus(), 0);
    await term.print(
      [
        { text: `FONDAZIONE OS — Terminale ${session.manifest.meta.host.toUpperCase()}`, cls: 'h' },
        { text: `Sessione di ${account.user}, livello ${account.level} — ${account.levelLabel(account.level)}.`, cls: 'dim' },
        { text: 'Digita "help" per l’elenco dei comandi.', cls: 'dim' },
      ],
      { cps: Infinity },
    );
    shell.updatePrompt();
    term.focus();
  },
};
