/**
 * Screensaver after a few idle minutes: the Foundation mark drifts across a black screen.
 * Now and then, for a single frame, it reads something else.
 */
import type { Desktop } from './desktop.ts';
import { h } from './dom.ts';

const IDLE_MS = 3 * 60_000;
const WHISPERS = ['TI VEDO', 'SONO QUI', 'NON SPEGNERE', 'ASCOLTO', 'OSPITE', '03:05'];

export function installScreensaver(desktop: Desktop) {
  let last = Date.now();
  let active: (() => void) | null = null;
  const wake = () => {
    last = Date.now();
    active?.();
  };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, wake, { passive: true, capture: true });

  setInterval(() => {
    if (active || desktop.root.hidden || document.hidden || Date.now() - last < IDLE_MS) return;
    if (document.querySelector('.ending, .intro-overlay')) return;
    start();
  }, 5000);

  function start() {
    const word = h('div', { class: 'saver-mark' }, 'FONDAZIONE SCP');
    const sub = h('small', {}, 'SECURE · CONTAIN · PROTECT');
    word.append(sub);
    const screen = h('div', { class: 'saver', 'aria-hidden': 'true' }, word);
    document.body.append(screen);
    let x = Math.random() * 200;
    let y = Math.random() * 200;
    let dx = 1.2;
    let dy = 0.9;
    let raf = 0;
    let frame = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      const maxX = innerWidth - word.offsetWidth;
      const maxY = innerHeight - word.offsetHeight;
      x += dx;
      y += dy;
      if (x < 0 || x > maxX) dx = -dx;
      if (y < 0 || y > maxY) dy = -dy;
      word.style.transform = `translate(${Math.max(0, Math.min(maxX, x))}px, ${Math.max(0, Math.min(maxY, y))}px)`;
      frame++;
      // Very rarely, for one frame, the text is not the logo.
      if (frame % 60 === 0 && Math.random() < 0.06) {
        word.firstChild!.textContent = WHISPERS[Math.floor(Math.random() * WHISPERS.length)];
        word.classList.add('is-other');
        setTimeout(() => {
          word.firstChild!.textContent = 'FONDAZIONE SCP';
          word.classList.remove('is-other');
        }, 90);
      }
    };
    raf = requestAnimationFrame(step);
    active = () => {
      cancelAnimationFrame(raf);
      screen.remove();
      active = null;
    };
  }
}
