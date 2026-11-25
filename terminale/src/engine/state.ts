/** Progress saved in localStorage. Every access is wrapped: storage may be unavailable. */

export type Theme = 'verde' | 'ambra';
/** Look of FONDAZIONE OS: late-90s institutional or modern (2026). */
export type OsTheme = 'classico' | 'moderno';

export type SaveState = {
  user: string;
  cwd: string;
  history: string[];
  /** PBKDF2-derived user keys (base64) so the player never re-types a password. */
  userKeys: Record<string, string>;
  /** Keys of files unlocked with `decrypt` (base64). */
  fileKeys: Record<string, string>;
  fired: string[];
  read: string[];
  logins: string[];
  mailRead: string[];
  ending: string | null;
  /** Corrupted files repaired with `ripara`. */
  repaired: string[];
  /** Mail replies already sent ("user/mailId"). */
  replied: string[];
  introSeen: boolean;
  bootSeen: boolean;
  startedAt: number;
  settings: { theme: Theme; audio: boolean; os: OsTheme };
};

function fresh(): SaveState {
  return {
    user: 'ospite',
    cwd: '/',
    history: [],
    userKeys: {},
    fileKeys: {},
    fired: [],
    read: [],
    logins: [],
    mailRead: [],
    ending: null,
    repaired: [],
    replied: [],
    introSeen: false,
    bootSeen: false,
    startedAt: Date.now(),
    settings: { theme: 'verde', audio: false, os: 'classico' },
  };
}

export class Store {
  readonly key: string;
  state: SaveState;

  constructor(gameId: string) {
    this.key = `terminale:${gameId}`;
    this.state = this.load();
  }

  private load(): SaveState {
    const base = fresh();
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } };
    } catch {
      return base;
    }
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.state));
    } catch {
      /* storage full or blocked: progress stays in memory */
    }
  }

  reset() {
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* ignore */
    }
    this.state = fresh();
  }

  addUnique(list: 'fired' | 'read' | 'logins' | 'mailRead', value: string) {
    if (!this.state[list].includes(value)) {
      this.state[list].push(value);
      this.save();
    }
  }
}
