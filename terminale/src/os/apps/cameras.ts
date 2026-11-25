/**
 * Telecamere: the site's surveillance feeds, drawn live on a canvas.
 * Cameras, access levels, scene and behaviour come from content/telecamere/.
 */
import type { CameraEntry } from '../../engine/types.ts';
import type { AppDef } from '../desktop.ts';
import { h, icon } from '../dom.ts';
import { ICONS } from '../icons.ts';

const W = 320;
const H = 180;

/** Per-camera memory that survives switching feeds (the figure that comes closer…). */
const memory = new Map<string, { visits: number; seen: number }>();

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

function corridor(g: Ctx) {
  g.fillStyle = '#3a3a3a';
  g.fillRect(0, 0, W, H);
  const vx = W / 2;
  const vy = H * 0.42;
  // floor and ceiling
  g.fillStyle = '#2b2b2b';
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(W, H);
  g.lineTo(vx + 26, vy + 22);
  g.lineTo(vx - 26, vy + 22);
  g.fill();
  g.fillStyle = '#4a4a4a';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(vx + 26, vy - 18);
  g.lineTo(vx - 26, vy - 18);
  g.fill();
  // far doorway
  g.fillStyle = '#080808';
  g.fillRect(vx - 22, vy - 16, 44, 38);
  // ceiling lights
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    const y = (vy - 18) * t;
    const w = 60 * (1 - t) + 8;
    g.fillStyle = i === 2 ? '#6a6a6a' : '#cfcfcf';
    g.fillRect(vx - w / 2, y + 4 * (1 - t), w, 3 * (1 - t) + 1);
  }
  // side doors
  g.fillStyle = '#262626';
  for (const [x, w, top, bottom] of [[18, 24, 40, 168], [278, 24, 40, 168], [86, 12, 66, 124], [222, 12, 66, 124]]) {
    g.fillRect(x, top, w, bottom - top);
  }
  g.strokeStyle = '#555';
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(vx - 26, vy + 22);
  g.moveTo(W, H);
  g.lineTo(vx + 26, vy + 22);
  g.stroke();
}

function room(g: Ctx, kind: 'terminale' | 'stanza') {
  g.fillStyle = '#3b3b3b';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a2a2a';
  g.fillRect(0, 120, W, 60);
  // window / wall clock
  g.fillStyle = kind === 'terminale' ? '#1a1a1a' : '#2f2f2f';
  g.fillRect(230, 22, 60, 40);
  if (kind === 'stanza') {
    g.strokeStyle = '#bbb';
    g.beginPath();
    g.arc(70, 36, 12, 0, Math.PI * 2);
    g.moveTo(70, 36);
    g.lineTo(70, 27);
    g.moveTo(70, 36);
    g.lineTo(75, 38);
    g.stroke();
  }
  // desk
  g.fillStyle = '#555';
  g.fillRect(90, 108, 150, 10);
  g.fillRect(96, 118, 6, 40);
  g.fillRect(228, 118, 6, 40);
  if (kind === 'terminale') {
    // CRT with green glow
    g.fillStyle = '#6a6a6a';
    g.fillRect(140, 70, 52, 40);
    g.fillStyle = '#8fd19e';
    g.fillRect(146, 75, 40, 28);
  } else {
    // phone
    g.fillStyle = '#1c1c1c';
    g.fillRect(150, 98, 28, 10);
  }
}

function canteen(g: Ctx) {
  g.fillStyle = '#404040';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#2f2f2f';
  g.fillRect(0, 90, W, 90);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      const x = 30 + i * 72 + row * 10;
      const y = 104 + row * 36;
      g.fillStyle = '#5c5c5c';
      g.fillRect(x, y, 46, 6);
    }
  }
}

function entrance(g: Ctx, open: number) {
  g.fillStyle = '#383838';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#262626';
  g.fillRect(0, 140, W, 40);
  // exit sign
  g.fillStyle = '#9fe0a8';
  g.fillRect(140, 14, 40, 10);
  // double door, the right leaf opens into darkness
  g.fillStyle = '#050505';
  g.fillRect(110, 40, 100, 100);
  g.fillStyle = '#5a5a5a';
  g.fillRect(110, 40, 50, 100);
  g.fillRect(160 + open * 46, 40, 50 - open * 46, 100);
  g.strokeStyle = '#222';
  g.strokeRect(110, 40, 100, 100);
}

function chamber(g: Ctx) {
  g.fillStyle = '#2c2c2c';
  g.fillRect(0, 0, W, H);
  // padded walls
  g.strokeStyle = '#353535';
  for (let x = 0; x < W; x += 20) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, H);
    g.stroke();
  }
  // table with reel-to-reel recorder
  g.fillStyle = '#4d4d4d';
  g.fillRect(120, 110, 80, 8);
  g.fillStyle = '#666';
  g.fillRect(130, 90, 60, 20);
  g.fillStyle = '#222';
  g.beginPath();
  g.arc(145, 92, 8, 0, Math.PI * 2);
  g.arc(175, 92, 8, 0, Math.PI * 2);
  g.fill();
}

function wall(g: Ctx) {
  g.fillStyle = '#3a3a3a';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#444';
  for (let y = 0; y < H; y += 14) {
    for (let x = (y / 14) % 2 ? -16 : 0; x < W; x += 32) g.fillRect(x + 1, y + 1, 30, 12);
  }
}

/* ------------------------------------------------------------------ */
/* Figures                                                             */
/* ------------------------------------------------------------------ */

function figure(g: Ctx, x: number, feet: number, height: number, alpha = 0.92, facing = true) {
  const head = height * 0.13;
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = '#060606';
  g.shadowColor = '#000';
  g.shadowBlur = 4;
  g.beginPath();
  g.arc(x, feet - height + head, head, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x - height * 0.16, feet - height + head * 2.1);
  g.lineTo(x + height * 0.16, feet - height + head * 2.1);
  g.lineTo(x + height * 0.11, feet);
  g.lineTo(x - height * 0.11, feet);
  g.fill();
  if (facing && height > 50) {
    g.shadowBlur = 0;
    g.fillStyle = '#d8d8d8';
    g.fillRect(x - head * 0.45, feet - height + head * 0.85, 2, 2);
    g.fillRect(x + head * 0.3, feet - height + head * 0.85, 2, 2);
  }
  g.restore();
}

function seated(g: Ctx, x: number, y: number) {
  g.fillStyle = '#0a0a0a';
  g.beginPath();
  g.arc(x, y - 30, 9, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x - 14, y - 22, 28, 30);
}

function face(g: Ctx) {
  g.fillStyle = '#050505';
  g.beginPath();
  g.ellipse(W / 2, H / 2 + 10, 70, 95, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#eee';
  g.fillRect(W / 2 - 30, H / 2 - 12, 5, 4);
  g.fillRect(W / 2 + 25, H / 2 - 12, 5, 4);
  g.fillStyle = '#1b1b1b';
  g.beginPath();
  g.ellipse(W / 2, H / 2 + 40, 14, 22, 0, 0, Math.PI * 2);
  g.fill();
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export const camerasApp: AppDef = {
  id: 'cameras',
  name: 'Telecamere',
  icon: ICONS.camera,
  size: [820, 520],
  desktop: true,
  menu: true,
  launch({ session, desktop, win }) {
    const acc = session.desktop;
    const list = h('nav', { class: 'cam-list', 'aria-label': 'Telecamere' });
    const canvas = h('canvas', { width: W, height: H, class: 'cam-canvas', 'aria-label': 'Immagine della telecamera' });
    const nameEl = h('span', { class: 'cam-name' });
    const timeEl = h('span', { class: 'cam-time' });
    const msgEl = h('div', { class: 'cam-msg', 'aria-live': 'polite' });
    const screen = h('div', { class: 'cam-screen' }, canvas, h('div', { class: 'cam-hud' }, nameEl, h('span', { class: 'cam-rec' }, '● REC'), timeEl), msgEl);
    win.body.append(h('div', { class: 'cams' }, list, screen));
    const g = canvas.getContext('2d')!;

    let current: { cam: CameraEntry; messages: string[] } | null = null;
    let since = performance.now();
    let lostUntil = 0;
    let ghostUntil = 0;
    let nextMsg = 0;
    let nextFlash = performance.now() + 60_000 + Math.random() * 60_000;
    let raf = 0;
    let last = 0;

    const visible = () => session.manifest.camere.filter((c) => !c.v || session.state.fired.includes(c.v));

    function renderList() {
      list.replaceChildren(
        ...visible().map((c) => {
          const locked = c.l > acc.level;
          return h(
            'button',
            {
              type: 'button',
              class: `cam-item${current?.cam.id === c.id ? ' is-active' : ''}${locked ? ' is-locked' : ''}`,
              onclick: () => void select(c),
            },
            icon(locked ? ICONS.docLocked : ICONS.camera),
            h('span', {}, h('strong', {}, c.nome), h('small', {}, locked ? `Livello ${c.l} richiesto` : 'in linea')),
          );
        }),
      );
    }

    async function select(cam: CameraEntry) {
      if (cam.l > acc.level) {
        current = null;
        nameEl.textContent = cam.nome;
        msgEl.textContent = `ACCESSO NEGATO — Livello ${cam.l} richiesto`;
        renderList();
        return;
      }
      const payload = await acc.openLevel(cam.b, cam.l);
      const mem = memory.get(cam.id) ?? { visits: 0, seen: 0 };
      mem.visits++;
      memory.set(cam.id, mem);
      current = { cam, messages: payload?.messaggi ?? [] };
      since = performance.now();
      lostUntil = 0;
      nextMsg = since + 2500;
      nameEl.textContent = cam.nome;
      msgEl.textContent = '';
      win.setTitle(`Telecamere — ${cam.nome}`);
      renderList();
      // "avvicina": the figure is one step closer at every return; at the end it reaches the lens.
      if (cam.comportamento === 'avvicina' && mem.visits >= 6) {
        mem.visits = 0;
        session.sound.alert('intruso');
        lostUntil = performance.now() + 4200;
        ghostUntil = performance.now() + 700;
        void desktop.glitch(700);
      }
    }

    function say(text: string) {
      msgEl.textContent = text;
      msgEl.classList.remove('is-new');
      void msgEl.offsetWidth;
      msgEl.classList.add('is-new');
    }

    canvas.addEventListener('click', () => {
      // Looking closer makes the second person disappear… and notice you.
      if (current?.cam.comportamento === 'seduto' && ghostUntil > performance.now()) {
        ghostUntil = 0;
        session.sound.alert('intruso');
        desktop.toast('linea interna 4', 'non girarti.', 'alert');
      }
    });

    function draw(now: number) {
      raf = requestAnimationFrame(draw);
      if (now - last < 80) return; // ~12 fps, like an old DVR
      last = now;
      const date = new Date();
      const glitchTime = Math.random() < 0.01;
      timeEl.textContent = `03/03/2026 ${glitchTime ? '03:05:00' : date.toLocaleTimeString('it-IT')}`;

      if (!current) {
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, H);
        noise(g, 0.5);
        return;
      }
      if (lostUntil > now) {
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, H);
        if (ghostUntil > now) face(g);
        else noise(g, 0.9);
        text(g, 'SEGNALE PERSO');
        return;
      }
      const { cam } = current;
      const t = (now - since) / 1000;
      if (now > nextMsg && current.messages.length) {
        nextMsg = now + 9000 + Math.random() * 9000;
        say(current.messages[Math.floor(Math.random() * current.messages.length)]);
      }
      const mem = memory.get(cam.id)!;

      switch (cam.scena) {
        case 'corridoio':
          corridor(g);
          break;
        case 'terminale':
          room(g, 'terminale');
          break;
        case 'stanza':
          room(g, 'stanza');
          break;
        case 'mensa':
          canteen(g);
          break;
        case 'ingresso':
          entrance(g, Math.min(1, t / 90));
          break;
        case 'camera4':
          chamber(g);
          break;
        case 'muro':
          wall(g);
          break;
        default:
          g.fillStyle = '#333';
          g.fillRect(0, 0, W, H);
      }

      switch (cam.comportamento) {
        case 'avvicina': {
          const step = Math.min(mem.visits, 5);
          const height = 26 + step * step * 6.5;
          figure(g, W / 2 + Math.sin(t * 0.3) * 0.6, H * 0.42 + 22 + step * 15, height);
          break;
        }
        case 'fermo':
          figure(g, W / 2, H * 0.42 + 70, 96 + Math.sin(t * 0.8) * 0.5);
          break;
        case 'seduto': {
          seated(g, 166, 132);
          if (now > ghostUntil && Math.random() < 0.006) ghostUntil = now + 1600;
          if (ghostUntil > now) figure(g, 210, 150, 118, 0.85);
          break;
        }
        case 'sedie': {
          // chairs turned towards the lens; one more turns every 20 seconds
          const turned = Math.min(8, 4 + Math.floor(t / 20) + mem.visits);
          for (let i = 0; i < 8; i++) {
            const x = 40 + (i % 4) * 72 + Math.floor(i / 4) * 10;
            const y = 98 + Math.floor(i / 4) * 36;
            g.fillStyle = '#1d1d1d';
            if (i < turned) {
              g.fillRect(x + 14, y - 14, 16, 14);
              g.fillRect(x + 14, y, 16, 3);
            } else g.fillRect(x + 14, y - 6, 16, 4);
          }
          if (Math.random() < 0.004) seated(g, 72, 112);
          break;
        }
        case 'porta': {
          const open = Math.min(1, t / 90);
          if (open > 0.85) {
            g.fillStyle = '#ddd';
            g.fillRect(186, 78, 2, 2);
            g.fillRect(196, 78, 2, 2);
          }
          break;
        }
        case 'telefono': {
          if (Math.floor(t * 2) % 2) {
            g.fillStyle = '#c33';
            g.fillRect(180, 98, 4, 4);
          }
          if (Math.random() < 0.01) {
            g.fillStyle = '#0a0a0a';
            g.fillRect(156, 86, 10, 14); // a hand reaching the receiver
          }
          break;
        }
        case 'segnale': {
          if (Math.random() < 0.985 && ghostUntil < now) {
            g.fillStyle = '#000';
            g.fillRect(0, 0, W, H);
            noise(g, 0.25);
            text(g, 'SEGNALE ASSENTE');
            if (Math.random() < 0.004) ghostUntil = now + 900;
            return;
          }
          figure(g, 160, 120, 70, 0.95);
          vu(g, now);
          break;
        }
        case 'muro': {
          const prints = Math.min(14, Math.floor(t / 6) + mem.visits);
          g.fillStyle = '#1c1c1c';
          for (let i = 0; i < prints; i++) {
            const px = 40 + ((i * 53) % 240);
            const py = 40 + ((i * 37) % 110);
            g.beginPath();
            g.ellipse(px, py, 6, 8, 0, 0, Math.PI * 2);
            g.fill();
            for (let f = -2; f <= 2; f++) g.fillRect(px + f * 3, py - 14, 2, 7);
          }
          break;
        }
      }

      noise(g, 0.12);
      scanlines(g);
      if (Math.random() < 0.02) tear(g);
      if (now > nextFlash) {
        nextFlash = now + 90_000 + Math.random() * 120_000;
        face(g);
      }
    }

    const off = session.onChange(renderList);
    win.onClose = () => {
      cancelAnimationFrame(raf);
      off();
    };
    renderList();
    const first = visible().find((c) => c.l <= acc.level);
    if (first) void select(first);
    raf = requestAnimationFrame(draw);
  },
};

function noise(g: Ctx, amount: number) {
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * amount;
    const v = Math.max(0, Math.min(255, (d[i] + d[i + 1] + d[i + 2]) / 3 + n));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
}

function scanlines(g: Ctx) {
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
}

function tear(g: Ctx) {
  const y = Math.floor(Math.random() * H);
  const h = 4 + Math.floor(Math.random() * 10);
  const strip = g.getImageData(0, y, W, h);
  g.putImageData(strip, Math.floor((Math.random() - 0.5) * 30), y);
}

function text(g: Ctx, s: string) {
  g.fillStyle = '#e6e6e6';
  g.font = 'bold 14px monospace';
  g.textAlign = 'center';
  g.fillText(s, W / 2, H / 2);
  g.textAlign = 'start';
}

function vu(g: Ctx, now: number) {
  g.fillStyle = '#ddd';
  g.font = '9px monospace';
  g.fillText('AUDIO: VOCE RILEVATA', 8, H - 12);
  const level = 20 + Math.abs(Math.sin(now / 90)) * 60;
  g.fillRect(110, H - 18, level, 5);
}
