import './style.css';
import './os/os.css';
import { Game } from './engine/game.ts';
import { Session } from './engine/session.ts';
import { Store } from './engine/state.ts';
import { terminalApp } from './os/apps/terminal.ts';
import { settingsApp } from './os/apps/settings.ts';
import { explorerApp } from './os/apps/explorer.ts';
import { imageApp, viewerApp } from './os/apps/viewer.ts';
import { runBoot } from './os/boot.ts';
import { Desktop } from './os/desktop.ts';
import { h } from './os/dom.ts';
import { LoginScreen } from './os/login.ts';

const DATA_URL = `${import.meta.env.BASE_URL}data/archivio.json`;

async function main() {
  const app = document.getElementById('app')!;
  let manifest;
  try {
    manifest = await Game.load(DATA_URL);
  } catch (err) {
    app.append(
      h(
        'div',
        { class: 'fatal crt-term' },
        h('div', { class: 'crt-line t-err' }, '[ERRORE] Archivio della postazione non raggiungibile.'),
        h('div', { class: 'crt-line t-dim' }, `${(err as Error).message} — ${DATA_URL}`),
        h('div', { class: 'crt-line t-dim' }, 'In locale esegui "npm run build:content" e ricarica.'),
      ),
    );
    return;
  }

  document.title = manifest.meta.titolo;
  const store = new Store(manifest.id);
  document.documentElement.dataset.phosphor = store.state.settings.theme;
  const session = new Session(manifest, store);

  const desktop = new Desktop(session, app);
  for (const a of [explorerApp, terminalApp, settingsApp, viewerApp, imageApp]) desktop.register(a);

  session.presenter = async (ev, payload, text) => {
    // Phase 1: plain notifications. See os/events.ts for the full presentation.
    desktop.toast(ev.tipo === 'intruso' ? (payload.da ?? '???') : 'Sistema', text.split('\n')[0], ev.tipo === 'intruso' ? 'alert' : 'info');
  };

  const login = new LoginScreen(session, app);
  const showLogin = () =>
    login.show(async (user) => {
      await desktop.start(user);
      session.events.check();
    });
  desktop.onSwitchUser = () => {
    desktop.stop();
    session.logoutDesktop();
    showLogin();
  };

  await runBoot(app, manifest, store);
  showLogin();
}

void main();
