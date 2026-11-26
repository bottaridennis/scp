/** Per-user desktop state (wallpaper, open windows, recent files) in localStorage. */
export type SavedWindow = {
  app: string;
  args?: unknown;
  rect: { x: number; y: number; w: number; h: number };
  min?: boolean;
  max?: boolean;
};

export type Profile = {
  wallpaper: string;
  windows: SavedWindow[];
  recent: { path: string; title: string; at: number }[];
  visited: boolean;
  /** Desktop icon positions as grid cells ("app:<id>" / "file:<path>"); empty = automatic layout. */
  icons?: Record<string, { c: number; r: number }>;
};

const fresh = (): Profile => ({ wallpaper: 'fondazione', windows: [], recent: [], visited: false });

export class ProfileStore {
  private readonly prefix: string;

  constructor(gameId: string) {
    this.prefix = `fondos:${gameId}:`;
  }

  load(user: string): Profile {
    try {
      const raw = localStorage.getItem(this.prefix + user);
      return raw ? { ...fresh(), ...(JSON.parse(raw) as Partial<Profile>) } : fresh();
    } catch {
      return fresh();
    }
  }

  save(user: string, profile: Profile) {
    try {
      localStorage.setItem(this.prefix + user, JSON.stringify(profile));
    } catch {
      /* storage full or blocked */
    }
  }
}

export const WALLPAPERS: Record<string, string> = {
  fondazione: 'Fondazione',
  griglia: 'Griglia tecnica',
  notte: 'Turno di notte',
  tinta: 'Grigio istituzionale',
  bunker: 'Ingresso del sito (foto)',
  corridoio: 'Corridoio Ala Est (foto)',
};
