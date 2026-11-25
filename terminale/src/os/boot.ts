/** BIOS-style boot screen, reusing the CRT terminal and the boot lines of the content. */
import type { Manifest } from '../engine/types.ts';
import type { Store } from '../engine/state.ts';
import { SPEED, Terminal, type Line } from '../engine/terminal.ts';
import { h } from './dom.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function bootLine(text: string): Line {
  if (/^\[(ERRORE|ALLARME)\]/.test(text)) return { text, cls: 'err' };
  if (/^\[(ATTENZIONE|AVVISO)\]/.test(text)) return { text, cls: 'warn' };
  if (/^\[OK\]/.test(text)) return { text, cls: 'ok' };
  return { text };
}

export async function runBoot(mount: HTMLElement, manifest: Manifest, store: Store): Promise<void> {
  const screen = h('div', { class: 'boot crt-term', 'aria-label': 'Avvio del sistema' });
  mount.appendChild(screen);
  const term = new Terminal(screen);
  term.setPrompt('');
  term.input.setAttribute('aria-hidden', 'true');
  term.input.tabIndex = -1;
  const skip = () => term.skip();
  window.addEventListener('keydown', skip);
  const fast = store.state.bootSeen;

  await term.print(manifest.meta.logo.join('\n'), { cls: 'logo', cps: fast ? Infinity : 900 });
  for (const line of manifest.meta.boot) {
    if (line.trim() === '~') {
      if (!fast) await sleep(450);
      continue;
    }
    await term.print([bootLine(line)], { cps: fast ? 3000 : SPEED.boot });
  }
  await term.print([{ text: '' }, { text: 'Avvio di FONDAZIONE OS…', cls: 'dim' }], { cps: fast ? Infinity : 400 });
  store.state.bootSeen = true;
  store.save();
  await sleep(fast ? 300 : 900);
  window.removeEventListener('keydown', skip);
  screen.classList.add('is-leaving');
  await sleep(350);
  screen.remove();
}
