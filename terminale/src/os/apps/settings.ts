/** Settings: wallpaper, terminal phosphor, sounds, progress reset, credits. */
import { setAudio, setOsTheme, setTheme } from '../../engine/shell.ts';
import type { AppDef } from '../desktop.ts';
import { h } from '../dom.ts';
import { ICONS } from '../icons.ts';
import { WALLPAPERS } from '../profile.ts';

export const settingsApp: AppDef = {
  id: 'settings',
  name: 'Impostazioni',
  icon: ICONS.settings,
  size: [460, 520],
  desktop: true,
  menu: true,
  launch({ session, desktop, win }) {
    const s = session.state.settings;
    const radio = (name: string, value: string, label: string, checked: boolean, onChange: () => void) =>
      h('label', { class: 'radio' }, h('input', { type: 'radio', name, value, checked, onchange: onChange }), label);
    const current = desktop.currentProfile?.wallpaper ?? 'fondazione';
    win.body.append(
      h(
        'div',
        { class: 'app-pad settings' },
        h(
          'fieldset',
          { class: 'group' },
          h('legend', {}, 'Aspetto del sistema'),
          radio('os', 'classico', 'Classico (1999)', s.os !== 'moderno', () => setOsTheme(session, 'classico')),
          radio('os', 'moderno', 'Moderno (2026)', s.os === 'moderno', () => setOsTheme(session, 'moderno')),
          h('p', { class: 'muted' }, 'Dal Terminale: salto 2026 / salto 1999.'),
        ),
        h(
          'fieldset',
          { class: 'group' },
          h('legend', {}, 'Sfondo del desktop'),
          ...Object.entries(WALLPAPERS).map(([k, label]) => radio('wall', k, label, k === current, () => desktop.setWallpaper(k))),
          h('p', { class: 'muted' }, 'Le icone si spostano trascinandole.'),
          h('button', { type: 'button', class: 'btn', onclick: () => desktop.resetIcons() }, 'Riordina le icone'),
        ),
        h(
          'fieldset',
          { class: 'group' },
          h('legend', {}, 'Terminale'),
          radio('phos', 'verde', 'Fosforo verde', s.theme === 'verde', () => setTheme(session, 'verde')),
          radio('phos', 'ambra', 'Fosforo ambra', s.theme === 'ambra', () => setTheme(session, 'ambra')),
        ),
        h(
          'fieldset',
          { class: 'group' },
          h('legend', {}, 'Suoni'),
          h('label', { class: 'radio' }, h('input', { type: 'checkbox', checked: s.audio, onchange: (e: Event) => setAudio(session, (e.target as HTMLInputElement).checked) }), 'Tastiera e ronzio del monitor'),
        ),
        h(
          'fieldset',
          { class: 'group' },
          h('legend', {}, 'Progressi'),
          h('p', { class: 'muted' }, 'Cancella file letti, chiavi sbloccate, eventi e desktop di tutti i profili.'),
          h(
            'button',
            {
              type: 'button',
              class: 'btn',
              onclick: () => {
                if (!confirm('Cancellare tutti i progressi? L’operazione non è reversibile.')) return;
                session.store.reset();
                try {
                  for (const k of Object.keys(localStorage)) if (k.startsWith('fondos:')) localStorage.removeItem(k);
                } catch {
                  /* ignore */
                }
                location.reload();
              },
            },
            'Cancella tutti i progressi…',
          ),
        ),
        h('fieldset', { class: 'group' }, h('legend', {}, 'Crediti e licenze'), h('pre', { class: 'credits' }, session.manifest.meta.crediti.join('\n'))),
      ),
    );
  },
};
