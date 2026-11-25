/**
 * Scripted events: they fire after reading a file, after a login, after
 * another event, after a delay, or when the player types a secret command.
 */
import { normalizeSecret, sha256Hex } from './crypto-core.ts';
import type { Game } from './game.ts';
import type { Store } from './state.ts';
import type { EventEntry, EventPayload } from './types.ts';

export type EventDisplay = (ev: EventEntry, payload: EventPayload, account: Game) => Promise<void>;

/**
 * Events are shared by the desktop and every open terminal: an event fires
 * when any open account has the required level, and is decrypted with that
 * account's keys.
 */
export class EventRunner {
  private readonly accounts: () => Game[];
  private readonly store: Store;
  private readonly display: EventDisplay;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private firing = new Set<string>();
  /** Timed events without conditions count from page load. */
  private readonly loadedAt = Date.now();

  constructor(store: Store, accounts: () => Game[], display: EventDisplay) {
    this.store = store;
    this.accounts = accounts;
    this.display = display;
  }

  private get state() {
    return this.store.state;
  }

  private get manifest() {
    return this.accounts()[0].manifest;
  }

  private get level() {
    return Math.max(0, ...this.accounts().map((a) => a.level));
  }

  private async open(ev: EventEntry, cmdKey?: CryptoKey): Promise<{ payload: EventPayload; account: Game } | null> {
    for (const account of [...this.accounts()].sort((a, b) => b.level - a.level)) {
      const payload = await account.openEvent(ev, cmdKey);
      if (payload) return { payload, account };
    }
    return null;
  }

  private conditionsMet(ev: EventEntry): boolean {
    const { lettura, login, evento } = ev.cond;
    if (lettura && !this.state.read.includes(lettura)) return false;
    if (login && !this.state.logins.includes(login)) return false;
    if (evento && !this.state.fired.includes(evento)) return false;
    return true;
  }

  private pending(ev: EventEntry) {
    return !this.state.fired.includes(ev.id) && !this.firing.has(ev.id);
  }

  /** Schedules every event whose conditions are now true. Call after any state change. */
  check() {
    if (this.state.ending) return;
    for (const ev of this.manifest.eventi) {
      if (ev.cond.cmd || !this.pending(ev) || this.timers.has(ev.id)) continue;
      if (!this.conditionsMet(ev)) continue;
      if (ev.l > this.level) continue; // wait for an account with enough clearance
      const hasCondition = Boolean(ev.cond.lettura || ev.cond.login || ev.cond.evento);
      const delay = hasCondition
        ? ev.ritardo * 1000
        : Math.max(0, ev.ritardo * 1000 - (Date.now() - this.loadedAt));
      this.timers.set(
        ev.id,
        setTimeout(() => void this.run(ev), delay),
      );
    }
  }

  private async run(ev: EventEntry, cmdKey?: CryptoKey): Promise<boolean> {
    this.timers.delete(ev.id);
    if (!this.pending(ev) || this.state.ending) return false;
    const opened = await this.open(ev, cmdKey);
    if (!opened) return false; // keys missing: retried on the next check()
    this.firing.add(ev.id);
    try {
      await this.display(ev, opened.payload, opened.account);
    } finally {
      this.firing.delete(ev.id);
    }
    if (!this.state.fired.includes(ev.id)) this.state.fired.push(ev.id);
    if (ev.tipo === 'finale') this.state.ending = ev.id;
    this.store.save();
    this.check();
    return true;
  }

  /** Called with any unrecognised command line. Returns true if it triggered an event. */
  async tryCommand(line: string): Promise<boolean> {
    const phrase = normalizeSecret(line);
    if (!phrase) return false;
    const hash = (await sha256Hex(`${this.manifest.id}|cmd|${phrase}`)).slice(0, 12);
    for (const ev of this.manifest.eventi) {
      if (ev.cond.cmd !== hash || !this.pending(ev) || this.state.ending) continue;
      if (!this.conditionsMet(ev) || ev.l > this.level) continue;
      if (await this.run(ev, await this.accounts()[0].commandKey(ev, phrase))) return true;
    }
    return false;
  }

  cancelAll() {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
}
