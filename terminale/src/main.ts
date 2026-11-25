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
import { ScpFS } from './archivio/scp-fs.ts';
import { mailApp } from './os/apps/mail.ts';
import { trashApp } from './os/apps/trash.ts';
import { camerasApp } from './os/apps/cameras.ts';
import { radioApp } from './os/apps/radio.ts';
import { voicesApp } from './os/apps/voices.ts';
import { introApp, showIntro } from './os/apps/intro.ts';
import { installEventPresenter } from './os/events.ts';

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
  const archive = manifest.meta.archivio ? new ScpFS(manifest.meta.archivio) : null;
  if (archive) session.fs.mount(archive.mount, archive);

  const desktop = new Desktop(session, app);
  for (const a of [explorerApp, mailApp, terminalApp, camerasApp, radioApp, voicesApp, settingsApp, trashApp, introApp, viewerApp, imageApp]) desktop.register(a);

  installEventPresenter(session, desktop);

  const login = new LoginScreen(session, app);
  const showLogin = () =>
    login.show(async (user) => {
      await desktop.start(user);
      session.events.check();
      // Load the archive index in the background (only the index: contents load on demand).
      archive?.load().catch(() => {});
    });
  desktop.onSwitchUser = () => {
    desktop.stop();
    session.logoutDesktop();
    showLogin();
  };

  await runBoot(app, manifest, store);
  if (!store.state.introSeen) await showIntro(session, app);
  showLogin();
}

void main();
