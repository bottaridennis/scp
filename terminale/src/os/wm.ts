/**
 * Window manager: drag, resize, minimize, maximize, close, focus.
 * On small screens windows are full screen and only the active one is shown.
 */
import { h, icon, isMobile } from './dom.ts';

export type Rect = { x: number; y: number; w: number; h: number };

export type WinOptions = {
  app: string;
  title: string;
  icon: string;
  rect?: Partial<Rect>;
  size?: [number, number];
  minimized?: boolean;
  maximized?: boolean;
};

let nextId = 1;

export class Win {
  readonly id = nextId++;
  readonly app: string;
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly iconEl: HTMLElement;
  private readonly wm: WindowManager;
  title: string;
  iconSvg: string;
  minimized = false;
  maximized = false;
  rect: Rect;
  /** Arguments to restore this window later (e.g. the open path). */
  args: unknown = undefined;
  onClose: (() => void) | null = null;
  onFocus: (() => void) | null = null;

  constructor(wm: WindowManager, opts: WinOptions, rect: Rect) {
    this.wm = wm;
    this.app = opts.app;
    this.title = opts.title;
    this.iconSvg = opts.icon;
    this.rect = rect;
    this.iconEl = icon(opts.icon);
    this.titleEl = h('span', { class: 'win-title-text' }, opts.title);
    const btn = (label: string, cls: string, action: () => void) =>
      h('button', {
        type: 'button',
        class: `win-btn ${cls}`,
        'aria-label': label,
        title: label,
        onpointerdown: (e: Event) => e.stopPropagation(),
        onclick: (e: Event) => {
          e.stopPropagation();
          action();
        },
      });
    const titlebar = h(
      'div',
      { class: 'win-titlebar' },
      this.iconEl,
      this.titleEl,
      h(
        'div',
        { class: 'win-btns' },
        btn('Riduci a icona', 'is-min', () => this.minimize()),
        btn('Ingrandisci', 'is-max', () => this.toggleMaximize()),
        btn('Chiudi', 'is-close', () => this.close()),
      ),
    );
    this.body = h('div', { class: 'win-body' });
    const grip = h('div', { class: 'win-resize', 'aria-hidden': 'true' });
    this.el = h('section', { class: 'win', role: 'dialog', 'aria-label': opts.title }, titlebar, this.body, grip);
    this.el.addEventListener('pointerdown', () => this.focus(), true);
    titlebar.addEventListener('dblclick', () => this.toggleMaximize());
    this.enableDrag(titlebar);
    this.enableResize(grip);
    this.apply();
  }

  setTitle(title: string) {
    this.title = title;
    this.titleEl.textContent = title;
    this.el.setAttribute('aria-label', title);
    this.wm.changed();
  }

  setIcon(svg: string) {
    this.iconSvg = svg;
    this.iconEl.innerHTML = svg;
    this.wm.changed();
  }

  apply() {
    const r = this.rect;
    Object.assign(this.el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    this.el.classList.toggle('is-max', this.maximized);
    this.el.classList.toggle('is-min', this.minimized);
  }

  focus() {
    this.wm.focus(this);
  }

  minimize() {
    this.minimized = true;
    this.apply();
    this.wm.focusTop();
    this.wm.changed();
  }

  restore() {
    this.minimized = false;
    this.apply();
    this.focus();
  }

  toggleMaximize() {
    this.maximized = !this.maximized;
    this.apply();
    this.wm.changed();
  }

  close() {
    this.onClose?.();
    this.wm.remove(this);
  }

  private enableDrag(handle: HTMLElement) {
    handle.addEventListener('pointerdown', (e) => {
      if (this.maximized || isMobile() || e.button !== 0) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const { x, y } = this.rect;
      const bounds = this.wm.bounds();
      handle.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        this.rect.x = Math.min(Math.max(x + ev.clientX - startX, -this.rect.w + 80), bounds.width - 80);
        this.rect.y = Math.min(Math.max(y + ev.clientY - startY, 0), bounds.height - 28);
        this.apply();
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        this.wm.changed();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  private enableResize(grip: HTMLElement) {
    grip.addEventListener('pointerdown', (e) => {
      if (this.maximized || isMobile()) return;
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const { w, h: height } = this.rect;
      grip.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        this.rect.w = Math.max(300, w + ev.clientX - startX);
        this.rect.h = Math.max(180, height + ev.clientY - startY);
        this.apply();
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        this.wm.changed();
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  }
}

export class WindowManager {
  readonly layer: HTMLElement;
  private windows: Win[] = [];
  private z = 10;
  private cascade = 0;
  active: Win | null = null;
  /** Called whenever the set or state of windows changes (taskbar, saving). */
  onChange: () => void = () => {};

  constructor(layer: HTMLElement) {
    this.layer = layer;
  }

  bounds() {
    return this.layer.getBoundingClientRect();
  }

  list() {
    return [...this.windows];
  }

  open(opts: WinOptions): Win {
    const b = this.bounds();
    const [dw, dh] = opts.size ?? [640, 440];
    const w = Math.min(opts.rect?.w ?? dw, Math.max(300, b.width - 20));
    const height = Math.min(opts.rect?.h ?? dh, Math.max(200, b.height - 20));
    const step = (this.cascade++ % 8) * 26;
    const rect: Rect = {
      x: opts.rect?.x ?? Math.max(8, Math.min(b.width - w - 8, 90 + step)),
      y: opts.rect?.y ?? Math.max(8, Math.min(b.height - height - 8, 30 + step)),
      w,
      h: height,
    };
    const win = new Win(this, opts, rect);
    win.maximized = Boolean(opts.maximized);
    win.minimized = Boolean(opts.minimized);
    win.apply();
    this.windows.push(win);
    this.layer.appendChild(win.el);
    if (!win.minimized) this.focus(win);
    this.changed();
    return win;
  }

  focus(win: Win) {
    if (win.minimized) {
      win.minimized = false;
      win.apply();
    }
    if (this.active !== win) {
      win.el.style.zIndex = String(++this.z);
      this.active?.el.classList.remove('is-active');
      this.active = win;
      win.el.classList.add('is-active');
      win.onFocus?.();
      this.changed();
    }
  }

  /** Focuses the top-most visible window (after one is minimized or closed). */
  focusTop() {
    const visible = this.windows.filter((w) => !w.minimized).sort((a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex));
    this.active?.el.classList.remove('is-active');
    this.active = null;
    if (visible[0]) this.focus(visible[0]);
    else this.changed();
  }

  remove(win: Win) {
    this.windows = this.windows.filter((w) => w !== win);
    win.el.remove();
    if (this.active === win) {
      this.active = null;
      this.focusTop();
    } else this.changed();
  }

  /** Taskbar click: restore, focus or minimize. */
  toggle(win: Win) {
    if (win.minimized) win.restore();
    else if (this.active === win) win.minimize();
    else win.focus();
  }

  closeAll() {
    for (const w of [...this.windows]) w.close();
  }

  changed() {
    this.onChange();
  }
}
