/** Right-click menus (desktop, icons, files), styled like the Start menu. */
import { h } from './dom.ts';

export type MenuItem = { label: string; action: () => void; disabled?: boolean } | 'sep';

let current: HTMLElement | null = null;

export function closeContextMenu() {
  current?.remove();
  current = null;
}

export function showContextMenu(x: number, y: number, items: MenuItem[]) {
  closeContextMenu();
  const menu = h(
    'div',
    { class: 'ctx-menu', role: 'menu' },
    ...items.map((it) =>
      it === 'sep'
        ? h('div', { class: 'menu-sep' })
        : h(
            'button',
            {
              type: 'button',
              role: 'menuitem',
              class: 'ctx-item',
              disabled: it.disabled,
              onclick: () => {
                closeContextMenu();
                it.action();
              },
            },
            it.label,
          ),
    ),
  );
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, innerWidth - r.width - 4)}px`;
  menu.style.top = `${Math.min(y, innerHeight - r.height - 4)}px`;
  current = menu;
  (menu.querySelector('.ctx-item:not([disabled])') as HTMLElement | null)?.focus();
}

document.addEventListener('pointerdown', (e) => {
  if (current && !current.contains(e.target as Node)) closeContextMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeContextMenu();
});
