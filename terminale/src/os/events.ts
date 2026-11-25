/**
 * Scripted events on the desktop: notifications, the intruder's chat window
 * that opens by itself, full-screen glitches and the ending.
 */
import type { Session } from '../engine/session.ts';
import type { EventEntry, EventPayload } from '../engine/types.ts';
import type { AppDef, Desktop } from './desktop.ts';
import { h } from './dom.ts';
import { ICONS } from './icons.ts';

type Message = { from: string; text: string; at: Date };

const log: Message[] = [];
let chatTarget: HTMLElement | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Types text into an element, character by character (skippable with a click). */
async function typeInto(el: HTMLElement, text: string, cps = 45) {
  let skip = false;
  const stop = () => (skip = true);
  el.addEventListener('click', stop, { once: true });
  for (let i = 0; i < text.length; ) {
    if (skip) {
      el.textContent = text;
      break;
    }
    i = Math.min(text.length, i + Math.max(1, Math.round(cps / 30)));
    el.textContent = text.slice(0, i);
    el.parentElement?.parentElement?.scrollTo({ top: 1e9 });
    await sleep(33);
  }
}

function bubble(m: Message) {
  const body = h('div', { class: 'chat-text' });
  const el = h(
    'div',
    { class: 'chat-msg' },
    h('div', { class: 'chat-meta' }, `${m.from} · linea interna 4 · ${m.at.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`),
    body,
  );
  return { el, body };
}

/** "Messaggi": the window the intruder writes in. */
export const messagesApp: AppDef = {
  id: 'messages',
  name: 'Linea interna 4',
  icon: ICONS.message,
  size: [460, 380],
  launch({ win }) {
    win.setTitle('Linea interna 4 — connessione in ingresso');
    const list = h('div', { class: 'chat crt-term' });
    for (const m of log) {
      const b = bubble(m);
      b.body.textContent = m.text;
      list.append(b.el);
    }
    if (!log.length) list.append(h('div', { class: 'crt-line t-dim' }, 'Nessuna connessione attiva.'));
    win.body.classList.add('is-terminal');
    win.body.append(list, h('div', { class: 'chat-input crt-term' }, h('span', { class: 't-dim' }, 'La linea è in sola ricezione.')));
    chatTarget = list;
    win.onClose = () => {
      if (chatTarget === list) chatTarget = null;
    };
  },
};

async function showIntruder(desktop: Desktop, from: string, text: string) {
  const m: Message = { from, text, at: new Date() };
  await desktop.glitch(500);
  await desktop.open('messages'); // renders the previous messages
  log.push(m);
  const list = chatTarget;
  if (!list) return;
  list.querySelector('.t-dim')?.remove();
  const b = bubble(m);
  list.append(b.el);
  await typeInto(b.body, text);
}

async function showEnding(session: Session, desktop: Desktop, text: string) {
  await desktop.glitch(1600);
  const out = h('div', { class: 'crt-line t-warn ending-text' });
  const minutes = Math.max(1, Math.round((Date.now() - session.state.startedAt) / 60000));
  const actions = h(
    'div',
    { class: 'ending-actions', hidden: true },
    h('div', { class: 'crt-line t-h' }, '════════════════  FINE  ════════════════'),
    h('div', { class: 'crt-line t-dim' }, `Documenti letti: ${session.state.read.length} · tempo: ${minutes} min`),
    h(
      'div',
      { class: 'ending-btns' },
      h('button', { type: 'button', class: 'btn', onclick: () => overlay.remove() }, 'Continua a esplorare'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => {
            session.store.reset();
            try {
              for (const k of Object.keys(localStorage)) if (k.startsWith('fondos:')) localStorage.removeItem(k);
            } catch {
              /* ignore */
            }
            location.reload();
          },
        },
        'Ricomincia da capo',
      ),
    ),
  );
  const overlay = h('div', { class: 'ending crt-term', role: 'dialog', 'aria-label': 'Fine' }, out, actions);
  document.body.append(overlay);
  await typeInto(out, text, 160);
  actions.hidden = false;
}

/** Installs the presenter used by the shared event runner. */
export function installEventPresenter(session: Session, desktop: Desktop) {
  desktop.register(messagesApp);
  session.presenter = async (ev: EventEntry, payload: EventPayload, text: string) => {
    switch (ev.tipo) {
      case 'sistema':
        session.sound.alert('sistema');
        desktop.toast('Avviso di sistema', text, 'warning', /mail|posta|messaggio/i.test(text) ? () => void desktop.open('mail') : undefined);
        session.notify();
        break;
      case 'glitch':
        session.sound.alert('intruso');
        await desktop.glitch(1200);
        if (text) desktop.toast('linea interna 4', text, 'alert');
        break;
      case 'intruso':
        session.sound.alert('intruso');
        await showIntruder(desktop, payload.da ?? '???', text);
        break;
      case 'finale':
        session.sound.alert('intruso');
        await showEnding(session, desktop, text);
        break;
    }
  };
}
