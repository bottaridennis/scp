/** Fonoteca: the voices Eco uses, identified one by one (content/fonoteca/). */
import type { AppDef } from '../desktop.ts';
import { h, icon } from '../dom.ts';
import { ICONS } from '../icons.ts';
import { typedText } from './viewer.ts';

export const voicesApp: AppDef = {
  id: 'voices',
  name: 'Fonoteca',
  icon: ICONS.voices,
  size: [560, 480],
  desktop: true,
  menu: true,
  badge: (session) => {
    const n = session.manifest.voci.filter((v) => session.voiceUnlocked(v)).length;
    return n ? `${n}/${session.manifest.voci.length}` : '';
  },
  launch({ session, win }) {
    const acc = session.desktop;
    const head = h('div', { class: 'voices-head' });
    const list = h('div', { class: 'voices-list' });
    win.body.append(h('div', { class: 'app-pad voices' }, head, list));

    async function render() {
      const items = await Promise.all(
        session.manifest.voci.map(async (v) => ({ v, p: session.voiceUnlocked(v) ? await acc.openLevel(v.b, v.l) : null })),
      );
      const known = items.filter((i) => i.p).length;
      head.replaceChildren(
        h('strong', {}, 'Voci in memoria di PROV-47'),
        h('span', { class: 'voices-count' }, `identificate ${known}/${items.length}`),
        h('div', { class: 'voices-bar' }, h('span', { style: `width:${Math.round((known / Math.max(1, items.length)) * 100)}%` })),
      );
      list.replaceChildren(
        ...(await Promise.all(
          items.map(async ({ p, v }) =>
            p
              ? h('details', { class: 'voice' }, h('summary', {}, icon(ICONS.voices), p.nome), typedText(await acc.renderBody(p.testo)))
              : h('div', { class: 'voice is-unknown' }, icon(ICONS.voices), session.voiceUnlocked(v) ? 'Voce cifrata — livello insufficiente' : '??? — voce non identificata'),
          ),
        )),
      );
    }
    const off = session.onChange(() => void render());
    win.onClose = () => off();
    void render();
  },
};
