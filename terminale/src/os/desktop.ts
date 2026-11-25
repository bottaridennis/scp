/**
 * FONDAZIONE OS desktop: icons, windows, taskbar, Start menu, notifications.
 * One desktop per logged-in profile; its layout is saved per user.
 */
import type { Game } from '../engine/game.ts';
import { GUEST } from '../engine/game.ts';
import type { Session } from '../engine/session.ts';
import { h, icon, isTouch } from './dom.ts';
import { ICONS } from './icons.ts';
import { ProfileStore, type Profile, type SavedWindow } from './profile.ts';
import { WindowManager, type Win } from './wm.ts';

export type AppContext = { session: Session; desktop: Desktop; win: Win };

export type AppDef = {
  id: string;
  name: string;
  icon: string;
  size?: [number, number];
  /** Several windows of this app may be open at once. */
  multi?: boolean;
  /** Shown as a desktop icon / in the Start menu. */
  desktop?: boolean;
  menu?: boolean;
  /** Fills win.body. May set win.onClose, win.args, win.title. */
  launch: (ctx: AppContext, args?: unknown) => void | Promise<void>;
  /** For single-instance apps: reuse the open window with new arguments. */
  reuse?: (ctx: AppContext, args?: unknown) => void;
  /** Badge next to the desktop icon (e.g. unread mail). */
  badge?: (session: Session) => string;
};

export class Desktop {
  readonly session: Session;
  readonly root: HTMLElement;
  private readonly desk: HTMLElement;
  private readonly iconsEl: HTMLElement;
  private readonly tasksEl: HTMLElement;
  private readonly trayUser: HTMLElement;
  private readonly trayLevel: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly toasts: HTMLElement;
  readonly wm: WindowManager;
  private readonly apps = new Map<string, AppDef>();
  private readonly profiles: ProfileStore;
  private profile: Profile | null = null;
  private user = GUEST;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private restoring = false;
  /** Called by "Cambia utente". */
  onSwitchUser: () => void = () => {};

  constructor(session: Session, mount: HTMLElement) {
    this.session = session;
    this.profiles = new ProfileStore(session.manifest.id);
    this.iconsEl = h('nav', { class: 'desk-icons', 'aria-label': 'Icone del desktop' });
    const layer = h('div', { class: 'wm-layer' });
    this.toasts = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    this.desk = h('div', { class: 'desk wall-fondazione' }, h('div', { class: 'desk-mark', 'aria-hidden': 'true' }, 'FONDAZIONE SCP', h('small', {}, 'SECURE · CONTAIN · PROTECT')), this.iconsEl, layer, this.toasts);
    this.wm = new WindowManager(layer);
    this.wm.onChange = () => {
      this.renderTasks();
      this.scheduleSave();
    };

    this.menu = h('div', { class: 'startmenu', hidden: true, role: 'menu' });
    this.tasksEl = h('div', { class: 'tasks' });
    this.trayLevel = h('span', { class: 'tray-level' });
    this.trayUser = h('span', { class: 'tray-user' });
    this.clock = h('span', { class: 'tray-clock' });
    const startBtn = h(
      'button',
      { type: 'button', class: 'start-btn', 'aria-haspopup': 'menu', onclick: () => this.toggleMenu() },
      icon(ICONS.logo),
      h('span', {}, 'Start'),
    );
    const taskbar = h('footer', { class: 'taskbar' }, startBtn, this.tasksEl, h('div', { class: 'tray' }, this.trayLevel, this.trayUser, this.clock));
    this.root = h('div', { class: 'os', hidden: true }, this.desk, this.menu, taskbar);
    mount.appendChild(this.root);

    document.addEventListener('pointerdown', (e) => {
      if (!this.menu.hidden && !this.menu.contains(e.target as Node) && !startBtn.contains(e.target as Node)) this.closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeMenu();
    });
    session.onChange(() => {
      if (!this.root.hidden) {
        this.renderTray();
        this.renderIcons();
      }
    });
  }

  register(app: AppDef) {
    this.apps.set(app.id, app);
  }

  get account(): Game {
    return this.session.desktop;
  }

  /* Session ------------------------------------------------------- */

  async start(user: string) {
    this.user = user;
    this.profile = this.profiles.load(user);
    this.setWallpaper(this.profile.wallpaper, false);
    this.root.hidden = false;
    this.renderIcons();
    this.renderTray();
    this.tickClock();
    this.clockTimer = setInterval(() => this.tickClock(), 15_000);

    this.restoring = true;
    const saved = this.profile.windows;
    if (saved.length) {
      for (const w of saved) await this.open(w.app, w.args, w);
    } else if (!this.profile.visited) {
      await this.firstVisit();
    }
    this.restoring = false;
    this.profile.visited = true;
    this.save();
  }

  /** Default windows the first time a profile logs in. */
  private async firstVisit() {
    if (this.apps.has('viewer') && this.user === GUEST) await this.open('viewer', { path: '/LEGGIMI.txt' });
    else if (this.apps.has('mail') && this.user !== GUEST) await this.open('mail');
    else await this.open('terminal');
  }

  stop() {
    this.save();
    this.restoring = true;
    this.wm.closeAll();
    this.restoring = false;
    clearInterval(this.clockTimer);
    this.closeMenu();
    this.toasts.replaceChildren();
    this.root.hidden = true;
    this.profile = null;
  }

  private scheduleSave() {
    if (this.restoring) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 300);
  }

  private save() {
    if (!this.profile) return;
    this.profile.windows = this.wm.list().map(
      (w): SavedWindow => ({ app: w.app, args: w.args, rect: { ...w.rect }, min: w.minimized, max: w.maximized }),
    );
    this.profiles.save(this.user, this.profile);
  }

  get currentProfile() {
    return this.profile;
  }

  setWallpaper(name: string, persist = true) {
    this.desk.className = `desk wall-${name}`;
    if (this.profile && persist) {
      this.profile.wallpaper = name;
      this.save();
    }
  }

  addRecent(path: string, title: string) {
    if (!this.profile) return;
    this.profile.recent = [{ path, title, at: Date.now() }, ...this.profile.recent.filter((r) => r.path !== path)].slice(0, 10);
    this.scheduleSave();
  }

  /* Apps ---------------------------------------------------------- */

  async open(appId: string, args?: unknown, saved?: SavedWindow): Promise<Win | null> {
    const app = this.apps.get(appId);
    if (!app) return null;
    this.closeMenu();
    if (!app.multi) {
      const existing = this.wm.list().find((w) => w.app === appId);
      if (existing) {
        app.reuse?.({ session: this.session, desktop: this, win: existing }, args);
        existing.focus();
        return existing;
      }
    }
    const win = this.wm.open({
      app: app.id,
      title: app.name,
      icon: app.icon,
      size: app.size,
      rect: saved?.rect,
      minimized: saved?.min,
      maximized: saved?.max,
    });
    win.args = args;
    try {
      await app.launch({ session: this.session, desktop: this, win }, args);
    } catch (err) {
      win.body.replaceChildren(h('div', { class: 'app-error' }, `Errore dell’applicazione: ${(err as Error).message}`));
    }
    this.wm.changed();
    return win;
  }

  appsWith(pred: (a: AppDef) => boolean) {
    return [...this.apps.values()].filter(pred);
  }

  /* UI ------------------------------------------------------------ */

  private renderIcons() {
    this.iconsEl.replaceChildren(
      ...this.appsWith((a) => Boolean(a.desktop)).map((app) => {
        const badge = app.badge?.(this.session);
        const el = h(
          'button',
          { type: 'button', class: 'desk-icon', title: app.name },
          h('span', { class: 'desk-icon-img', html: app.icon }),
          h('span', { class: 'desk-icon-label' }, app.name),
          badge ? h('span', { class: 'desk-icon-badge' }, badge) : null,
        );
        // Double click on desktop, single tap on touch screens.
        el.addEventListener(isTouch() ? 'click' : 'dblclick', () => void this.open(app.id));
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') void this.open(app.id);
        });
        return el;
      }),
    );
  }

  private renderTasks() {
    this.tasksEl.replaceChildren(
      ...this.wm.list().map((w) =>
        h(
          'button',
          {
            type: 'button',
            class: `task${this.wm.active === w && !w.minimized ? ' is-active' : ''}`,
            title: w.title,
            onclick: () => this.wm.toggle(w),
          },
          icon(w.iconSvg),
          h('span', {}, w.title),
        ),
      ),
    );
  }

  private renderTray() {
    const acc = this.account;
    const level = acc.level;
    this.trayLevel.className = `tray-level lvl-${level}`;
    this.trayLevel.textContent = `L${level}`;
    this.trayLevel.title = `Livello di accesso ${level} — ${acc.levelLabel(level)}`;
    this.trayUser.replaceChildren(icon(acc.user === GUEST ? ICONS.guest : ICONS.user), h('span', {}, acc.user));
  }

  private tickClock() {
    const now = new Date();
    this.clock.textContent = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    this.clock.title = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  private toggleMenu() {
    if (this.menu.hidden) this.openMenu();
    else this.closeMenu();
  }

  private openMenu() {
    const acc = this.account;
    const k = acc.keyring;
    const item = (svg: string, label: string, action: () => void) =>
      h('button', { type: 'button', role: 'menuitem', class: 'menu-item', onclick: () => { this.closeMenu(); action(); } }, icon(svg), h('span', {}, label));
    this.menu.replaceChildren(
      h(
        'div',
        { class: 'menu-side', 'aria-hidden': 'true' },
        h('span', {}, 'FONDAZIONE OS'),
      ),
      h(
        'div',
        { class: 'menu-main' },
        h(
          'div',
          { class: 'menu-user' },
          icon(acc.user === GUEST ? ICONS.guest : ICONS.user, 'ico ico-lg'),
          h('div', {}, h('strong', {}, k?.nome ?? 'Ospite'), h('small', {}, `${acc.user} · Livello ${acc.level} — ${acc.levelLabel(acc.level)}`)),
        ),
        ...this.appsWith((a) => Boolean(a.menu)).map((a) => item(a.icon, a.name, () => void this.open(a.id))),
        ...(this.profile?.recent.length
          ? [
              h('div', { class: 'menu-sep' }, 'Documenti recenti'),
              ...this.profile.recent.slice(0, 5).map((r) => item(ICONS.doc, r.title, () => this.openPath(r.path))),
            ]
          : []),
        h('div', { class: 'menu-sep' }),
        item(ICONS.swap, 'Cambia utente…', () => this.onSwitchUser()),
        item(ICONS.power, 'Riavvia', () => location.reload()),
      ),
    );
    this.menu.hidden = false;
    (this.menu.querySelector('.menu-item') as HTMLElement | null)?.focus();
  }

  private closeMenu() {
    this.menu.hidden = true;
  }

  /** Opens a path with the right app (explorer, document viewer, image viewer). */
  openPath(path: string, account?: Game) {
    void this.session.fs.stat(path, account ?? this.account).then((node) => {
      if (!node) return this.toast('Percorso non trovato', path, 'warning');
      if (node.kind === 'dir') return void this.open('explorer', { path });
      if (node.kind === 'image') return void this.open('image', { path });
      return void this.open('viewer', { path });
    });
  }

  /** Notification in the top-right corner. */
  toast(title: string, text: string, kind: 'info' | 'warning' | 'alert' = 'info', onClick?: () => void) {
    const el = h(
      'div',
      { class: `toast toast-${kind}`, role: 'alert' },
      icon(kind === 'alert' ? ICONS.message : kind === 'warning' ? ICONS.warning : ICONS.logo),
      h('div', {}, h('strong', {}, title), h('p', {}, text)),
    );
    if (onClick) {
      el.classList.add('is-clickable');
      el.addEventListener('click', () => {
        onClick();
        el.remove();
      });
    }
    this.toasts.appendChild(el);
    setTimeout(() => el.classList.add('is-leaving'), 7000);
    setTimeout(() => el.remove(), 7600);
  }

  /** Full-screen glitch effect. */
  glitch(ms = 900): Promise<void> {
    document.body.classList.add('is-glitch');
    return new Promise((r) =>
      setTimeout(() => {
        document.body.classList.remove('is-glitch');
        r();
      }, ms),
    );
  }
}
