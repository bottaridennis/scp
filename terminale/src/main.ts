import './style.css';
import { Game, GUEST } from './engine/game.ts';
import { Shell } from './engine/shell.ts';
import { Store } from './engine/state.ts';
import { SPEED, Terminal, type Line } from './engine/terminal.ts';

const DATA_URL = `${import.meta.env.BASE_URL}data/archivio.json`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Boot lines: "~" pauses, [OK]/[ATTENZIONE]/[ERRORE] are coloured. */
function bootLine(text: string): Line {
  if (/^\[(ERRORE|ALLARME)\]/.test(text)) return { text, cls: 'err' };
  if (/^\[(ATTENZIONE|AVVISO)\]/.test(text)) return { text, cls: 'warn' };
  if (/^\[OK\]/.test(text)) return { text, cls: 'ok' };
  return { text };
}

async function boot(term: Terminal, shell: Shell, game: Game) {
  const { meta } = game.manifest;
  const s = game.store.state;
  await term.print(meta.logo.join('\n'), { cls: 'logo', cps: s.bootSeen ? Infinity : 900 });
  if (!s.bootSeen) {
    for (const line of meta.boot) {
      if (line.trim() === '~') {
        await sleep(term.busy ? 0 : 550);
        continue;
      }
      await term.print([bootLine(line)], { cps: SPEED.boot });
    }
    s.bootSeen = true;
    game.store.save();
  } else {
    await term.print(
      [
        { text: `[OK] Ripristino sessione: ${s.user}`, cls: 'ok' },
        ...(s.ending ? [{ text: '[AVVISO] Sessione conclusa. Digita "reset" per ricominciare.', cls: 'warn' }] : []),
      ],
      { cps: Infinity },
    );
  }
  await term.print('Digita "help" per l’elenco dei comandi.', { cls: 'dim', cps: Infinity });
  shell.updatePrompt();
  shell.events.check();
}

async function main() {
  const screen = document.getElementById('screen')!;
  const term = new Terminal(screen);
  term.setPrompt('');
  term.focus();

  let manifest;
  try {
    manifest = await Game.load(DATA_URL);
  } catch (err) {
    await term.print(
      [
        { text: '[ERRORE] Archivio non raggiungibile.', cls: 'err' },
        { text: `${(err as Error).message} — ${DATA_URL}`, cls: 'dim' },
        { text: 'In locale esegui "npm run build:content" e ricarica.', cls: 'dim' },
      ],
      { cps: Infinity },
    );
    return;
  }

  const store = new Store(manifest.id);
  const game = new Game(manifest, store);
  await game.restore();
  document.title = manifest.meta.titolo;

  const shell = new Shell(term, game);
  if (store.state.user !== GUEST && game.user === GUEST) store.state.cwd = '/';

  // Touch toolbar
  document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => e.preventDefault()); // keep keyboard open
    btn.addEventListener('click', () => {
      const k = btn.dataset.key;
      if (k === 'tab') term.complete();
      else if (k === 'up') term.historyPrev();
      else if (k === 'down') term.historyNext();
      else if (k === 'skip') term.skip();
      term.focus();
    });
  });

  await boot(term, shell, game);
  term.focus();
}

void main();
