/**
 * Shared state of the computer: the desktop account, the accounts opened by
 * terminals, the mounted filesystems, scripted events and sounds.
 *
 * An "account" is a Game instance: user + decrypted keyring. Every terminal
 * gets its own account, so `login` in a terminal changes only that terminal.
 * Decrypted file keys and progress are shared through the Store.
 */
import { Sound } from './audio.ts';
import { EventRunner } from './events.ts';
import { Game, GUEST } from './game.ts';
import { GameFS } from './game-fs.ts';
import type { Store } from './state.ts';
import type { AudioRef, Cond, EventEntry, EventPayload, Manifest, NoteEntry, ObjectiveEntry } from './types.ts';
import { MountFS } from './vfs.ts';

export type EventPresenter = (ev: EventEntry, payload: EventPayload, text: string) => Promise<void>;

export class Session {
  readonly manifest: Manifest;
  readonly store: Store;
  /** The account logged in on the desktop. */
  readonly desktop: Game;
  readonly gameFs = new GameFS();
  readonly fs = new MountFS(this.gameFs);
  readonly sound = new Sound();
  readonly events: EventRunner;
  /** Set by the user interface: how scripted events are shown. */
  presenter: EventPresenter = async () => {};
  private accounts = new Set<Game>();
  private listeners = new Set<() => void>();

  constructor(manifest: Manifest, store: Store) {
    this.manifest = manifest;
    this.store = store;
    this.desktop = new Game(manifest, store);
    this.accounts.add(this.desktop);
    this.gameFs.mountPoints = () => this.fs.points;
    this.gameFs.onRead = (path) => this.markRead(path);
    this.events = new EventRunner(store, () => [...this.accounts], async (ev, payload, account) => {
      const text = await account.renderBody(payload.testo);
      await this.presenter(ev, payload, text);
    });
    this.events.onFired = () => this.notify();
    this.events.startClock();
    this.sound.enabled = this.state.settings.audio;
  }

  get state() {
    return this.store.state;
  }

  get user() {
    return this.desktop.user;
  }

  /** Called whenever the user, the progress or the settings change. */
  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  notify() {
    this.listeners.forEach((fn) => fn());
  }

  /* Desktop login ------------------------------------------------- */

  /** Profiles on the login screen: guest plus every user of the game. */
  profiles(): { name: string; unlocked: boolean }[] {
    return [
      { name: GUEST, unlocked: true },
      ...this.desktop.users.filter((name) => this.desktop.isListed(name)).map((name) => ({ name, unlocked: this.desktop.hasStoredKey(name) })),
    ];
  }

  /** Logs the desktop in. Without a password it uses the stored derived key. */
  async loginDesktop(name: string, password?: string): Promise<boolean> {
    if (name === GUEST) {
      this.desktop.logout();
      this.afterLogin(GUEST);
      return true;
    }
    const ok = password ? await this.desktop.login(name, password) : await this.desktop.unlockWithStoredKey(name);
    if (!ok) return false;
    this.afterLogin(name);
    return true;
  }

  logoutDesktop() {
    this.desktop.logout();
    this.state.user = GUEST;
    this.store.save();
    this.notify();
  }

  private afterLogin(name: string) {
    this.state.user = name;
    this.recordLogin(name);
    this.notify();
  }

  /** Remembers that a user logged in (desktop or terminal): drives `dopo_login` events. */
  recordLogin(name: string) {
    if (name !== GUEST && !this.state.logins.includes(name)) this.state.logins.push(name);
    this.store.save();
    this.notify();
    this.events.check();
  }

  /* Terminal accounts --------------------------------------------- */

  /** A new account for a terminal, starting as the desktop user. */
  async openAccount(): Promise<Game> {
    const acc = new Game(this.manifest, this.store);
    if (this.desktop.user !== GUEST) await acc.unlockWithStoredKey(this.desktop.user);
    this.accounts.add(acc);
    return acc;
  }

  closeAccount(acc: Game) {
    if (acc !== this.desktop) this.accounts.delete(acc);
  }

  /** Accounts currently open (desktop and terminals). */
  openAccounts() {
    return [...this.accounts];
  }

  /** The highest clearance among open accounts. */
  highest() {
    return [...this.accounts].sort((a, b) => b.level - a.level)[0];
  }

  /** Sends a mail reply: records its signal, which may fire events. */
  reply(user: string, mailId: string, signal: string) {
    const key = `${user}/${mailId}`;
    if (this.state.replied.includes(key)) return false;
    this.state.replied.push(key);
    this.events.signal(signal);
    return true;
  }

  /**
   * Plays the recording attached to a station, event or voice: public (`a`) or encrypted (`ax`,
   * decrypted with the clearance of any open account). Resolves to the playing element, or null.
   */
  async playRecording(item: { a?: string; ax?: AudioRef }, force = false): Promise<HTMLAudioElement | null> {
    if (!this.sound.enabled && !force) return null;
    if (item.a) return this.sound.voice(item.a, force);
    if (!item.ax) return null;
    const account = this.highest();
    if (!account || account.level < item.ax.l) return null;
    const url = await account.openAudio(item.ax);
    if (!url) return null;
    const audio = this.sound.play(url, force);
    const release = () => URL.revokeObjectURL(url);
    if (audio) {
      audio.addEventListener('ended', release);
      audio.addEventListener('pause', release);
    } else release();
    return audio;
  }

  /* Notebook ------------------------------------------------------ */

  /** True when every part of the condition holds ("a|b" in evento: any of them). */
  condMet(c: Cond) {
    const st = this.state;
    if (c.lettura && !st.read.includes(c.lettura)) return false;
    if (c.login && !st.logins.includes(c.login)) return false;
    if (c.evento && !c.evento.split('|').some((e) => st.fired.includes(e))) return false;
    return true;
  }

  /** The objective to pursue now: the first one started and not yet completed. */
  currentObjective(): ObjectiveEntry | null {
    for (const o of this.manifest.taccuino.o) {
      if (o.start && !this.condMet(o.start)) continue;
      const done = Object.keys(o.end).length > 0 && this.condMet(o.end);
      if (!done) return o;
    }
    return null;
  }

  /** Notes written so far whose level some open account can read, newest first. */
  notes(): NoteEntry[] {
    const level = this.highest()?.level ?? 0;
    return this.manifest.taccuino.n.filter((n) => n.l <= level && this.condMet(n.cond)).reverse();
  }

  /** Decrypts a notebook entry with the clearance of any open account. */
  openNotebook<T>(entry: { l: number; b: import('./types.ts').Sealed<T> }): Promise<T | null> {
    const account = this.highest();
    return account ? account.openLevel(entry.b, entry.l) : Promise.resolve(null);
  }

  /** Reveals the next hint for the current objective; returns how many are shown. */
  nextHint(o: ObjectiveEntry) {
    const n = Math.min(3, (this.state.hints[o.id] ?? 0) + 1);
    this.state.hints[o.id] = n;
    this.store.save();
    this.notify();
    return n;
  }

  unseenNotes() {
    return this.notes().filter((n) => !this.state.notesSeen.includes(n.id)).length;
  }

  markNotesSeen() {
    const ids = this.notes().map((n) => n.id).filter((id) => !this.state.notesSeen.includes(id));
    if (!ids.length) return;
    this.state.notesSeen.push(...ids);
    this.store.save();
    this.notify();
  }

  /** Voices of the catalogue unlocked so far. */
  voiceUnlocked(v: { cond: { lettura?: string; evento?: string } }) {
    return (!v.cond.lettura || this.state.read.includes(v.cond.lettura)) && (!v.cond.evento || this.state.fired.includes(v.cond.evento));
  }

  /* Progress ------------------------------------------------------ */

  markRead(path: string) {
    if (!this.state.read.includes(path)) {
      this.state.read.push(path);
      this.store.save();
      this.notify(); // the notebook may have something new
    }
    this.events.check();
  }

  markMailRead(user: string, id: string) {
    const key = `${user}/${id}`;
    if (!this.state.mailRead.includes(key)) {
      this.state.mailRead.push(key);
      this.store.save();
      this.notify();
    }
  }

  unreadMail(acc: Game = this.desktop): number {
    return acc.visibleMail().filter((m) => !this.state.mailRead.includes(`${acc.user}/${m.id}`)).length;
  }
}
