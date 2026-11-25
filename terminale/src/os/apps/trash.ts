/** Cestino: a desktop shortcut to /.cestino, where deleted documents end up. */
import type { AppDef } from '../desktop.ts';
import { ICONS } from '../icons.ts';

export const trashApp: AppDef = {
  id: 'trash',
  name: 'Cestino',
  icon: ICONS.trash,
  desktop: true,
  launch() {},
  action: (desktop) => void desktop.open('explorer', { path: '/.cestino' }),
};
