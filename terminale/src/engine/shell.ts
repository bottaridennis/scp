/** Command interpreter: parses input, runs commands, completes with Tab. */
import { Sound } from './audio.ts';
import { EventRunner } from './events.ts';
import { GUEST, type Game } from './game.ts';
import type { Theme } from './state.ts';
import { SPEED, type Line, type Terminal } from './terminal.ts';
import type { EventEntry, EventPayload, FileEntry } from './types.ts';
import { normalizePath, Tree } from './vfs.ts';

type Mode = { kind: 'command' } | { kind: 'password'; user: string } | { kind: 'confirm-reset' };

type Command = {
  usage: string;
  help: string;
  run: (args: string[], raw: string) => Promise<void> | void;
  /** What Tab completes for the arguments. */
  complete?: 'path' | 'user' | string[];
  hidden?: boolean;
};

const ORDER = ['help', 'login', 'logout', 'whoami', 'ls', 'cd', 'pwd', 'cat', 'search', 'decrypt', 'mail', 'clear', 'audio', 'tema', 'crediti', 'reset'];

export class Shell {
  private readonly term: Terminal;
  private readonly game: Game;
  readonly sound = new Sound();
  readonly events: EventRunner;
  private mode: Mode = { kind: 'command' };
  private readonly commands: Record<string, Command>;

  constructor(term: Terminal, game: Game) {
    this.term = term;
    this.game = game;
    this.events = new EventRunner(game, (ev, payload) => this.showEvent(ev, payload));
    this.commands = this.defineCommands();

    term.history = [...game.store.state.history];
    term.onSubmit = (value) => void this.handle(value);
    term.onComplete = (value) => this.complete(value);
    term.onKey = () => {
      this.sound.unlock();
      this.sound.click();
    };
    term.onType = () => this.sound.click();
    this.sound.enabled = game.store.state.settings.audio;
    applyTheme(game.store.state.settings.theme);
  }

  private get state() {
    return this.game.store.state;
  }

  private get home() {
    return this.game.user === GUEST ? '/' : this.game.homeOf(this.game.user);
  }

  /* Prompt -------------------------------------------------------- */

  updatePrompt() {
    if (this.mode.kind === 'password') {
      this.term.setPrompt('Password: ');
      this.term.setSecret(true);
      return;
    }
    this.term.setSecret(false);
    if (this.mode.kind === 'confirm-reset') {
      this.term.setPrompt('Conferma: ');
      return;
    }
    const cwd = this.state.cwd;
    const home = this.home;
    const shown = home !== '/' && (cwd === home || cwd.startsWith(`${home}/`)) ? `~${cwd.slice(home.length)}` : cwd;
    this.term.setPrompt(`${this.game.user}@${this.game.manifest.meta.host}:${shown}$ `);
  }

  /* Tree ---------------------------------------------------------- */

  private tree() {
    const homes = this.game.users.map((u) => this.game.homeOf(u));
    return new Tree(this.game.allFiles(), homes);
  }

  private resolve(arg: string | undefined) {
    return normalizePath(arg ?? '', this.state.cwd, this.home);
  }

  /** Returns the owner of a private path the current user may not open, if any. */
  private foreignHome(p: string): string | null {
    const m = p.match(/^\/home\/([^/]+)/);
    if (!m || m[1] === this.game.user) return null;
    return m[1];
  }

  /* Input --------------------------------------------------------- */

  private async handle(raw: string) {
    const mode = this.mode;
    if (mode.kind === 'password') {
      this.mode = { kind: 'command' };
      this.updatePrompt();
      await this.finishLogin(mode.user, raw);
      return;
    }
    if (mode.kind === 'confirm-reset') {
      this.mode = { kind: 'command' };
      this.updatePrompt();
      if (raw.trim() === 'RESET') {
        this.events.cancelAll();
        this.game.store.reset();
        await this.term.echo('Progressi cancellati. Riavvio…', 'warn');
        setTimeout(() => location.reload(), 600);
      } else {
        await this.term.echo('Reset annullato.', 'dim');
      }
      return;
    }

    const line = raw.trim();
    if (!line) return;
    this.state.history = this.term.history.slice(-100);
    this.game.store.save();

    const [name, ...args] = line.split(/\s+/);
    const cmd = this.commands[name.toLowerCase()];
    if (cmd) {
      await cmd.run(args, line);
    } else if (!(await this.events.tryCommand(line))) {
      await this.term.echo(`${name}: comando non trovato. Digita "help" per l'elenco dei comandi.`, 'err');
    }
    this.updatePrompt();
  }

  /* Commands ------------------------------------------------------ */

  private defineCommands(): Record<string, Command> {
    const t = this.term;
    return {
      help: {
        usage: 'help',
        help: 'mostra questo elenco',
        run: () => {
          const lines: Line[] = [{ text: 'COMANDI DISPONIBILI', cls: 'h' }];
          for (const key of ORDER) {
            const c = this.commands[key];
            if (!c || c.hidden) continue;
            lines.push({ text: `  ${c.usage.padEnd(26)} ${c.help}` });
          }
          lines.push({ text: '' }, { text: 'Tab completa i nomi dei file · ↑ ↓ scorrono la cronologia · un tasto salta il testo', cls: 'dim' });
          return t.print(lines, { cps: 2000 });
        },
      },
      login: {
        usage: 'login <utente>',
        help: 'accede con un altro account',
        complete: 'user',
        run: async ([user]) => {
          if (!user) return t.echo('Uso: login <utente>', 'err');
          const name = user.toLowerCase();
          if (name === this.game.user) return t.echo(`Sei già collegato come ${name}.`, 'dim');
          if (name === GUEST) return this.commands.logout.run([], 'logout');
          if (!this.game.hasUser(name)) return t.echo(`login: utente "${name}" sconosciuto.`, 'err');
          if (this.game.hasStoredKey(name) && (await this.game.unlockWithStoredKey(name))) {
            await t.echo('Credenziali memorizzate: verifica superata.', 'dim');
            return this.afterLogin(name);
          }
          this.mode = { kind: 'password', user: name };
          this.updatePrompt();
        },
      },
      logout: {
        usage: 'logout',
        help: 'chiude la sessione',
        run: async () => {
          if (this.game.user === GUEST) return t.echo('Nessuna sessione attiva.', 'dim');
          const was = this.game.user;
          this.game.logout();
          this.state.user = GUEST;
          this.state.cwd = '/';
          this.game.store.save();
          await t.echo(`Sessione di ${was} chiusa. Utente corrente: ${GUEST}.`, 'dim');
        },
      },
      whoami: {
        usage: 'whoami',
        help: 'mostra utente e livello di accesso',
        run: () => {
          const g = this.game;
          const k = g.keyring;
          return t.echo([
            { text: `Utente:  ${g.user}${k ? ` — ${k.nome}` : ''}` },
            ...(k ? [{ text: `Ruolo:   ${k.ruolo}` }] : []),
            { text: `Accesso: livello ${g.level} — ${g.levelLabel(g.level)}`, cls: 'hl' },
          ]);
        },
      },
      ls: {
        usage: 'ls [cartella]',
        help: 'elenca i file',
        complete: 'path',
        run: ([arg]) => this.ls(arg),
      },
      cd: {
        usage: 'cd <cartella>',
        help: 'cambia cartella',
        complete: 'path',
        run: ([arg]) => {
          const target = arg ? this.resolve(arg) : this.home;
          const owner = this.foreignHome(target);
          if (owner) return t.echo(`ACCESSO NEGATO — area personale di ${owner}`, 'err');
          const tree = this.tree();
          if (tree.file(target)) return t.echo(`cd: ${arg} non è una cartella`, 'err');
          if (!tree.isDir(target)) return t.echo(`cd: ${arg}: cartella inesistente`, 'err');
          this.state.cwd = target;
          this.game.store.save();
        },
      },
      pwd: {
        usage: 'pwd',
        help: 'mostra la cartella corrente',
        run: () => t.echo(this.state.cwd),
      },
      cat: {
        usage: 'cat <file>',
        help: 'legge un file',
        complete: 'path',
        run: ([arg]) => (arg ? this.cat(arg) : t.echo('Uso: cat <file>', 'err')),
      },
      search: {
        usage: 'search <parola>',
        help: 'cerca nei file leggibili',
        run: (args) => this.search(args.join(' ')),
      },
      decrypt: {
        usage: 'decrypt <file> <chiave>',
        help: 'decifra un file cifrato',
        complete: 'path',
        run: ([file, ...key]) => this.decrypt(file, key.join(' ')),
      },
      mail: {
        usage: 'mail [numero]',
        help: 'legge la posta dell’utente',
        run: ([n]) => this.mail(n),
      },
      clear: {
        usage: 'clear',
        help: 'pulisce lo schermo',
        run: () => t.clear(),
      },
      audio: {
        usage: 'audio on|off',
        help: 'suoni di tastiera e ronzio',
        complete: ['on', 'off'],
        run: ([v]) => {
          const on = v ? v.toLowerCase() === 'on' : !this.sound.enabled;
          this.sound.setEnabled(on);
          this.state.settings.audio = on;
          this.game.store.save();
          return t.echo(`Audio ${on ? 'attivato' : 'disattivato'}.`, 'dim');
        },
      },
      tema: {
        usage: 'tema verde|ambra',
        help: 'colore del fosforo',
        complete: ['verde', 'ambra'],
        run: ([v]) => {
          const theme: Theme = v?.toLowerCase() === 'ambra' ? 'ambra' : v?.toLowerCase() === 'verde' ? 'verde' : this.state.settings.theme === 'verde' ? 'ambra' : 'verde';
          applyTheme(theme);
          this.state.settings.theme = theme;
          this.game.store.save();
          return t.echo(`Fosforo ${theme}.`, 'dim');
        },
      },
      crediti: {
        usage: 'crediti',
        help: 'licenze e crediti',
        run: () => t.print(this.game.manifest.meta.crediti.join('\n'), { cps: 2000 }),
      },
      reset: {
        usage: 'reset',
        help: 'cancella tutti i progressi',
        run: async () => {
          this.mode = { kind: 'confirm-reset' };
          await t.echo('Questa operazione cancella tutti i progressi. Digita RESET per confermare.', 'warn');
        },
      },
    };
  }

  /* Login --------------------------------------------------------- */

  private async finishLogin(user: string, password: string) {
    if (!password) {
      await this.term.echo('Accesso annullato.', 'dim');
      return;
    }
    await this.term.echo('Verifica credenziali…', 'dim');
    const ok = await this.game.login(user, password);
    if (!ok) {
      this.sound.alert('sistema');
      await this.term.echo('Autenticazione fallita.', 'err');
      this.updatePrompt();
      return;
    }
    await this.afterLogin(user);
  }

  private async afterLogin(user: string) {
    const g = this.game;
    const k = g.keyring!;
    this.state.user = user;
    this.state.cwd = g.homeOf(user);
    if (!this.state.logins.includes(user)) this.state.logins.push(user);
    g.store.save();
    const mail = g.visibleMail();
    const unread = mail.filter((m) => !this.state.mailRead.includes(`${user}/${m.id}`)).length;
    this.updatePrompt();
    await this.term.print([
      { text: `Accesso eseguito. Benvenuto/a, ${k.nome}.`, cls: 'ok' },
      { text: `Livello di accesso ${k.livello} — ${g.levelLabel(k.livello)}`, cls: 'hl' },
      { text: `Posta: ${mail.length} messaggi${unread ? `, ${unread} non letti` : ''}. Digita "mail".`, cls: 'dim' },
    ]);
    this.events.check();
  }

  /* Files --------------------------------------------------------- */

  private async ls(arg?: string) {
    const t = this.term;
    const dir = this.resolve(arg ?? '.');
    const owner = this.foreignHome(dir);
    if (owner) return t.echo(`ACCESSO NEGATO — area personale di ${owner}`, 'err');
    const tree = this.tree();
    const file = tree.file(dir);
    const entries = file ? [{ name: dir.split('/').pop()!, dir: false, file, path: dir }] : tree.isDir(dir) ? tree.list(dir) : null;
    if (!entries) return t.echo(`ls: ${arg}: file o cartella inesistente`, 'err');
    if (!entries.length) return t.echo('(cartella vuota)', 'dim');
    const lines: Line[] = entries.map((e) => {
      if (e.dir) return { text: `${e.name}/`, cls: 'dir' };
      const f = e.file!;
      const name = e.name.padEnd(30);
      if (!this.game.canRead(f)) return { text: `${name} [L${f.l}] accesso negato`, cls: 'locked' };
      if (f.e && !this.game.isUnlocked(f)) return { text: `${name} [CIFRATO]`, cls: 'warn' };
      return { text: `${name} ${formatSize(f.s)}${f.l ? `  [L${f.l}]` : ''}${f.e ? '  [decifrato]' : ''}` };
    });
    return t.echo(lines);
  }

  private findFile(arg: string): { path: string; file?: FileEntry; error?: string } {
    const path = this.resolve(arg);
    const owner = this.foreignHome(path);
    if (owner) return { path, error: `ACCESSO NEGATO — area personale di ${owner}` };
    const tree = this.tree();
    if (tree.isDir(path)) return { path, error: `${arg}: è una cartella` };
    const file = tree.file(path);
    if (!file) return { path, error: `${arg}: file inesistente` };
    return { path, file };
  }

  private async cat(arg: string) {
    const t = this.term;
    const { file, error } = this.findFile(arg);
    if (!file) return t.echo(error!, 'err');
    const res = await this.game.read(file);
    if (res.status === 'denied') {
      this.sound.alert('sistema');
      return t.echo(`ACCESSO NEGATO — Livello ${res.level} richiesto`, 'err');
    }
    if (res.status === 'encrypted') {
      return t.echo([
        { text: noise(4), cls: 'dim' },
        { text: `${file.p}: file cifrato. Usa: decrypt ${arg} <chiave>`, cls: 'warn' },
      ]);
    }
    await t.print([{ text: `── ${file.p} ${'─'.repeat(Math.max(4, 44 - file.p.length))}`, cls: 'dim' }, ...formatDoc(res.text)]);
    if (!this.state.read.includes(file.p)) {
      this.state.read.push(file.p);
      this.game.store.save();
    }
    this.events.check();
  }

  private async decrypt(arg: string | undefined, key: string) {
    const t = this.term;
    if (!arg || !key) return t.echo('Uso: decrypt <file> <chiave>', 'err');
    const { file, error } = this.findFile(arg);
    if (!file) return t.echo(error!, 'err');
    if (!this.game.canRead(file)) return t.echo(`ACCESSO NEGATO — Livello ${file.l} richiesto`, 'err');
    if (!file.e) return t.echo(`${arg}: il file non è cifrato.`, 'dim');
    if (this.game.isUnlocked(file)) return t.echo(`${arg}: già decifrato. Usa: cat ${arg}`, 'dim');
    await t.print('Decifratura in corso ▒▒▒▒▒▒▒▒▒▒', { cls: 'dim', cps: 40 });
    if (await this.game.decrypt(file, key)) {
      await t.echo(`Decifratura riuscita. Usa: cat ${arg}`, 'ok');
      this.events.check();
    } else {
      this.sound.alert('sistema');
      await t.echo('Chiave non valida.', 'err');
    }
  }

  private async search(query: string) {
    const t = this.term;
    const q = query.trim().toLowerCase();
    if (q.length < 3) return t.echo('Uso: search <parola> (almeno 3 caratteri)', 'err');
    const hits: Line[] = [];
    const add = (where: string, text: string) => {
      text.split('\n').forEach((line, i) => {
        const idx = line.toLowerCase().indexOf(q);
        if (idx === -1) return;
        const start = Math.max(0, idx - 30);
        const snippet = `${start ? '…' : ''}${line.slice(start, idx + q.length + 40).trim()}${idx + q.length + 40 < line.length ? '…' : ''}`;
        hits.push({ text: `${where}:${i + 1}  ${snippet}` });
      });
    };
    for (const f of this.tree().allFiles()) {
      if (f.p.toLowerCase().includes(q)) hits.push({ text: `${f.p}  (nome del file)`, cls: 'dim' });
      if (!this.game.canRead(f) || !this.game.isUnlocked(f)) continue;
      const res = await this.game.read(f);
      if (res.status === 'ok') add(f.p, res.text);
    }
    for (const [i, m] of this.game.visibleMail().entries()) {
      add(`mail ${i + 1}`, `${m.oggetto}\n${await this.game.readMail(m)}`);
    }
    if (!hits.length) return t.echo(`Nessun risultato per "${query}" nei file accessibili.`, 'dim');
    const shown = hits.slice(0, 20);
    return t.echo([
      ...shown,
      { text: `${hits.length} risultat${hits.length === 1 ? 'o' : 'i'}${hits.length > shown.length ? ` (mostrati ${shown.length})` : ''}.`, cls: 'dim' },
    ]);
  }

  private async mail(n?: string) {
    const t = this.term;
    const g = this.game;
    if (g.user === GUEST) return t.echo('L’utente ospite non ha una casella di posta. Effettua il login.', 'err');
    const list = g.visibleMail();
    if (!list.length) return t.echo('Nessun messaggio.', 'dim');
    if (!n) {
      const lines: Line[] = [{ text: `  #  ${'DATA'.padEnd(17)} ${'DA'.padEnd(14)} OGGETTO`, cls: 'dim' }];
      list.forEach((m, i) => {
        const unread = !this.state.mailRead.includes(`${g.user}/${m.id}`);
        lines.push({ text: `${unread ? '*' : ' '}${String(i + 1).padStart(2)}  ${m.data.padEnd(17)} ${m.da.padEnd(14)} ${m.oggetto}`, cls: unread ? 'hl' : undefined });
      });
      lines.push({ text: 'Usa "mail <numero>" per leggere. * = non letto', cls: 'dim' });
      return t.echo(lines);
    }
    const m = list[Number(n) - 1];
    if (!m) return t.echo(`mail: messaggio ${n} inesistente`, 'err');
    const body = await g.readMail(m);
    await t.print([
      { text: `Da:      ${m.da}`, cls: 'hl' },
      { text: `A:       ${m.a}` },
      { text: `Data:    ${m.data}` },
      { text: `Oggetto: ${m.oggetto}`, cls: 'hl' },
      { text: '─'.repeat(48), cls: 'dim' },
      ...formatDoc(body),
    ]);
    const id = `${g.user}/${m.id}`;
    if (!this.state.mailRead.includes(id)) {
      this.state.mailRead.push(id);
      g.store.save();
    }
  }

  /* Events -------------------------------------------------------- */

  private async showEvent(ev: EventEntry, payload: EventPayload) {
    const t = this.term;
    const text = await this.game.renderBody(payload.testo);
    switch (ev.tipo) {
      case 'sistema':
        this.sound.alert('sistema');
        await t.print(text ? `[SISTEMA] ${text}` : '', { cls: 'sys' });
        break;
      case 'glitch':
        this.sound.alert('intruso');
        await t.glitch(1200);
        if (text) await t.print(text, { cls: 'intr', cps: SPEED.slow });
        break;
      case 'intruso':
        this.sound.alert('intruso');
        await t.glitch(500);
        await t.print(`>> connessione in ingresso · ${payload.da ?? '???'} · linea interna 4`, { cls: 'intr-head', cps: Infinity });
        await t.print(text, { cls: 'intr', cps: SPEED.slow });
        break;
      case 'finale': {
        this.sound.alert('intruso');
        await t.glitch(1600);
        await t.print(text, { cls: 'final', cps: 160 });
        const minutes = Math.max(1, Math.round((Date.now() - this.state.startedAt) / 60000));
        await t.print(
          [
            { text: '' },
            { text: '════════════════  FINE  ════════════════', cls: 'h' },
            { text: `Documenti letti: ${this.state.read.length} · tempo: ${minutes} min`, cls: 'dim' },
            { text: 'Digita "reset" per ricominciare.', cls: 'dim' },
          ],
          { cps: 300 },
        );
        break;
      }
    }
    this.updatePrompt();
  }

  /* Completion ---------------------------------------------------- */

  private complete(value: string): { value?: string; options?: string[] } {
    if (this.mode.kind !== 'command') return {};
    const endsWithSpace = /\s$/.test(value);
    const parts = value.trimStart().split(/\s+/);
    if (parts.length === 1 && !endsWithSpace) {
      const names = ORDER.filter((c) => c.startsWith(parts[0].toLowerCase()));
      return pick(parts[0], names, (n) => `${n} `, (prefix) => prefix);
    }
    const cmd = this.commands[parts[0].toLowerCase()];
    if (!cmd?.complete) return {};
    const current = endsWithSpace ? '' : parts[parts.length - 1];
    const head = value.slice(0, value.length - current.length);
    // decrypt completes only the file (2nd word)
    if (parts[0] === 'decrypt' && parts.length - (endsWithSpace ? 0 : 1) > 1) return {};

    if (cmd.complete === 'user') {
      const users = this.game.users.filter((u) => u.startsWith(current.toLowerCase()));
      return pick(current, users, (u) => `${head}${u} `, (p) => head + p);
    }
    if (Array.isArray(cmd.complete)) {
      const opts = cmd.complete.filter((o) => o.startsWith(current.toLowerCase()));
      return pick(current, opts, (o) => `${head}${o} `, (p) => head + p);
    }
    const slash = current.lastIndexOf('/');
    const dirPart = slash >= 0 ? current.slice(0, slash + 1) : '';
    const base = slash >= 0 ? current.slice(slash + 1) : current;
    const dir = this.resolve(dirPart || '.');
    const tree = this.tree();
    if (!tree.isDir(dir) || this.foreignHome(dir)) return {};
    const entries = tree.list(dir).filter((e) => e.name.toLowerCase().startsWith(base.toLowerCase()));
    const names = entries.map((e) => (e.dir ? `${e.name}/` : e.name));
    return pick(
      base,
      names,
      (n) => `${head}${dirPart}${n}${n.endsWith('/') ? '' : ' '}`,
      (p) => `${head}${dirPart}${p}`,
    );
  }
}

/* Helpers ---------------------------------------------------------- */

function pick(
  typed: string,
  options: string[],
  one: (o: string) => string,
  partial: (prefix: string) => string,
): { value?: string; options?: string[] } {
  if (!options.length) return {};
  if (options.length === 1) return { value: one(options[0]) };
  let prefix = options[0];
  for (const o of options) {
    while (!o.toLowerCase().startsWith(prefix.toLowerCase())) prefix = prefix.slice(0, -1);
  }
  if (prefix.length > typed.length) return { value: partial(prefix) };
  return { options };
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.phosphor = theme;
  try {
    // Read by the inline script in index.html to avoid a colour flash on load.
    localStorage.setItem('terminale:tema', theme);
  } catch {
    /* ignore */
  }
}

function formatSize(chars: number) {
  return chars < 1000 ? `${chars} B` : `${(chars / 1024).toFixed(1)} K`;
}

function noise(lines: number) {
  const chars = '0123456789ABCDEF';
  return Array.from({ length: lines }, () =>
    Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * 16)] + chars[Math.floor(Math.random() * 16)]).join(' '),
  ).join('\n');
}

/** Light markup for documents: # titles, > quotes, --- rules. */
export function formatDoc(text: string): Line[] {
  return text.split('\n').map((line) => {
    if (/^#\s/.test(line)) return { text: line.replace(/^#\s+/, '').toUpperCase(), cls: 'h' };
    if (/^##\s/.test(line)) return { text: line.replace(/^##\s+/, ''), cls: 'hl' };
    if (/^>\s?/.test(line)) return { text: `│ ${line.replace(/^>\s?/, '')}`, cls: 'quote' };
    if (/^-{3,}\s*$/.test(line)) return { text: '─'.repeat(48), cls: 'dim' };
    return { text: line };
  });
}
