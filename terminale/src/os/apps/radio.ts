/** Radio: a short-wave receiver. Stations, levels and transmissions come from content/radio/. */
import type { RadioEntry } from '../../engine/types.ts';
import type { AppDef } from '../desktop.ts';
import { h } from '../dom.ts';
import { ICONS } from '../icons.ts';

const MIN = 2;
const MAX = 30;
const STATIC = '░▒▓ ·.:;~ ';

export const radioApp: AppDef = {
  id: 'radio',
  name: 'Radio',
  icon: ICONS.radio,
  size: [560, 430],
  desktop: true,
  menu: true,
  launch({ session, win }) {
    const acc = session.desktop;
    let freq = 7.0;
    const display = h('div', { class: 'radio-freq' });
    const meter = h('div', { class: 'radio-meter' }, h('span'));
    const dial = h('input', { type: 'range', min: String(MIN), max: String(MAX), step: '0.005', class: 'radio-dial', 'aria-label': 'Sintonia' }) as HTMLInputElement;
    const input = h('input', { type: 'text', class: 'field radio-input', 'aria-label': 'Frequenza in MHz', placeholder: 'es. 7,215' }) as HTMLInputElement;
    const out = h('div', { class: 'radio-out crt-term', 'aria-live': 'polite' });
    const step = (d: number) => h('button', { type: 'button', class: 'btn tool', onclick: () => setFreq(freq + d) }, d > 0 ? `+${d}` : String(d));
    win.body.append(
      h(
        'div',
        { class: 'radio' },
        h('div', { class: 'radio-panel' }, display, meter),
        dial,
        h('div', { class: 'radio-controls' }, step(-0.1), step(-0.005), input, step(0.005), step(0.1)),
        out,
      ),
    );

    let station: RadioEntry | null = null;
    let typing = 0;
    let noiseTimer = 0;

    const onAir = () => session.manifest.radio.filter((s) => !s.v || session.state.fired.includes(s.v));

    function setFreq(f: number) {
      freq = Math.min(MAX, Math.max(MIN, Math.round(f * 1000) / 1000));
      dial.value = String(freq);
      display.textContent = `${freq.toFixed(3).replace('.', ',')} MHz`;
      const near = onAir().reduce<{ s: RadioEntry; d: number } | null>((best, s) => {
        const d = Math.abs(s.f - freq);
        return !best || d < best.d ? { s, d } : best;
      }, null);
      const strength = near ? Math.max(0, 1 - near.d / 0.06) : 0;
      (meter.firstElementChild as HTMLElement).style.width = `${Math.round(strength * 100)}%`;
      const tuned = near && near.d < 0.0051 ? near.s : null;
      if (tuned !== station) {
        station = tuned;
        void play();
      }
    }

    async function play() {
      const my = ++typing;
      clearInterval(noiseTimer);
      out.replaceChildren();
      if (!station) {
        noiseTimer = window.setInterval(() => {
          out.textContent = Array.from({ length: 6 }, () => Array.from({ length: 48 }, () => STATIC[Math.floor(Math.random() * STATIC.length)]).join('')).join('\n');
        }, 120);
        return;
      }
      const p = await acc.openLevel(station.b, station.l);
      if (my !== typing) return;
      if (!p) {
        out.textContent = 'Segnale presente, ma cifrato. (Livello di accesso insufficiente)';
        return;
      }
      const text = await acc.renderBody(p.testo);
      const head = h('div', { class: 'crt-line t-hl' }, `◉ ${p.nome}`);
      const body = h('div', { class: 'crt-line' });
      out.append(head, body);
      session.sound.alert('sistema');
      for (let i = 0; i <= text.length; i += 2) {
        if (my !== typing) return;
        body.textContent = text.slice(0, i);
        out.scrollTop = out.scrollHeight;
        await new Promise((r) => setTimeout(r, 28));
      }
    }

    dial.addEventListener('input', () => setFreq(Number(dial.value)));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') setFreq(Number(input.value.replace(',', '.')) || freq);
    });
    win.onClose = () => {
      typing++;
      clearInterval(noiseTimer);
    };
    setFreq(freq);
  },
};
