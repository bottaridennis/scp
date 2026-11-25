/**
 * Command interpreter of one terminal. Each terminal has its own account
 * (`login` here changes only this terminal) and its own working directory;
 * files are read through the shared virtual filesystem.
 */
import type { Game } from './game.ts';
import { GUEST } from './game.ts';
import type { Session } from './session.ts';
import { inTimeWindow } from './events.ts';
import type { OsTheme, Theme } from './state.ts';
import type { Line, Terminal } from './terminal.ts';
import { basename, normalizePath, type ReadResult, type VNode } from './vfs.ts';

type Mode = { kind: 'command' } | { kind: 'password'; user: string } | { kind: 'confirm-reset' };

type Command = {
  usage: string;
  help: string;
  run: (args: string[], raw: string) => Promise<void> | void;
  /** What Tab completes for the arguments. */
  complete?: 'path' | 'user' | string[];
};

export type ShellHost = {
  /** Opens a file or folder in the graphical apps (`open`). */
  open?: (path: string, account: Game) => void;
  /** Closes the terminal window (`exit`). */
  exit?: () => void;
  /** Called when this terminal's user changes. */
  userChanged?: (account: Game) => void;
  /** Opens a desktop app (telecamere, radio, fonoteca, incarico). */
  launch?: (appId: string, args?: unknown) => void;
};

const ORDER = [
  'help', 'aiuto', 'taccuino', 'incarico', 'login', 'logout', 'whoami', 'ls', 'cd', 'pwd', 'cat', 'stat', 'open', 'search', 'decrypt',
  'ripara', 'unisci', 'mail', 'rispondi', 'rete', 'connetti', 'radio', 'voci', 'telecamere',
  'clear', 'audio', 'tema', 'salto', 'crediti', 'reset', 'exit',
];

export class Shell {
  private readonly term: Terminal;
  private readonly session: Session;
  readonly account: Game;
  private readonly host: ShellHost;
  private mode: Mode = { kind: 'command' };
  private readonly commands: Record<string, Command>;
  cwd: string;

  constructor(term: Terminal, session: Session, account: Game, host: ShellHost = {}) {
    this.term = term;
    this.session = session;
    this.account = account;
    this.host = host;
    this.commands = this.defineCommands();
    this.cwd = this.home;

    term.history = [...session.state.history];
    term.onSubmit = (value) => void this.handle(value);
    term.onComplete = (value) => this.complete(value);
    term.onKey = () => {
      session.sound.unlock();
      session.sound.click();
    };
    term.onType = () => session.sound.click();
    this.updatePrompt();
  }

  private get fs() {
    return this.session.fs;
  }

  private get state() {
    return this.session.state;
  }

  private get home() {
    return this.account.user === GUEST ? '/' : this.account.homeOf(this.account.user);
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
    const home = this.home;
    const cwd = this.cwd;
    const node = cwd.match(/^\/rete\/([^/]+)/)?.[1];
    const shown = node
      ? cwd.slice(`/rete/${node}`.length) || '/'
      : home !== '/' && (cwd === home || cwd.startsWith(`${home}/`))
        ? `~${cwd.slice(home.length)}`
        : cwd;
    this.term.setPrompt(`${this.account.user}@${node ?? this.session.manifest.meta.host}:${shown}$ `);
  }

  private resolve(arg: string | undefined) {
    return normalizePath(arg ?? '', this.cwd, this.home);
  }

  /** Shows a waiting line if an operation (e.g. the remote archive) is slow. */
  private async slow<T>(work: Promise<T>, label = 'Connessione all’archivio centrale…'): Promise<T> {
    const timer = setTimeout(() => void this.term.echo(label, 'dim'), 350);
    try {
      return await work;
    } finally {
      clearTimeout(timer);
    }
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
        this.session.events.cancelAll();
        this.session.store.reset();
        try {
          for (const k of Object.keys(localStorage)) if (k.startsWith('fondos:')) localStorage.removeItem(k);
        } catch {
          /* ignore */
        }
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
    this.session.store.save();

    const [name, ...args] = tokenize(line);
    const cmd = this.commands[name.toLowerCase()];
    if (cmd) {
      await cmd.run(args, line);
    } else if (!(await this.session.events.tryCommand(line))) {
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
            if (c) lines.push({ text: `  ${c.usage.padEnd(26)} ${c.help}` });
          }
          lines.push(
            { text: '' },
            { text: 'Tab completa i nomi · ↑ ↓ cronologia · un tasto salta il testo', cls: 'dim' },
            { text: 'I nomi con spazi vanno tra virgolette: cd "Serie I"', cls: 'dim' },
            { text: 'I file che iniziano con "." sono nascosti: usa ls -a.', cls: 'dim' },
          );
          return t.print(lines, { cps: 2000 });
        },
      },
      login: {
        usage: 'login <utente>',
        help: 'cambia utente in questo terminale',
        complete: 'user',
        run: async ([user]) => {
          if (!user) return t.echo('Uso: login <utente>', 'err');
          const name = user.toLowerCase();
          if (name === this.account.user) return t.echo(`Sei già collegato come ${name}.`, 'dim');
          if (name === GUEST) return this.commands.logout.run([], 'logout');
          if (!this.account.hasUser(name)) return t.echo(`login: utente "${name}" sconosciuto.`, 'err');
          if (this.account.hasStoredKey(name) && (await this.account.unlockWithStoredKey(name))) {
            await t.echo('Credenziali memorizzate: verifica superata.', 'dim');
            return this.welcome();
          }
          this.mode = { kind: 'password', user: name };
          this.updatePrompt();
        },
      },
      logout: {
        usage: 'logout',
        help: 'torna all’utente ospite (solo in questo terminale)',
        run: async () => {
          if (this.account.user === GUEST) return t.echo('Nessuna sessione attiva.', 'dim');
          const was = this.account.user;
          this.account.logout();
          this.cwd = '/';
          this.host.userChanged?.(this.account);
          await t.echo(`Sessione di ${was} chiusa. Utente corrente: ${GUEST}.`, 'dim');
        },
      },
      whoami: {
        usage: 'whoami',
        help: 'mostra utente e livello di accesso',
        run: () => {
          const a = this.account;
          const k = a.keyring;
          return t.echo([
            { text: `Utente:  ${a.user}${k ? ` — ${k.nome}` : ''}` },
            ...(k ? [{ text: `Ruolo:   ${k.ruolo}` }] : []),
            { text: `Accesso: livello ${a.level} — ${a.levelLabel(a.level)}`, cls: 'hl' },
          ]);
        },
      },
      ls: {
        usage: 'ls [-a] [cartella]',
        help: 'elenca i file (-a: anche i nascosti)',
        complete: 'path',
        run: (args) => this.ls(args.find((a) => !a.startsWith('-')), args.includes('-a')),
      },
      cd: {
        usage: 'cd <cartella>',
        help: 'cambia cartella',
        complete: 'path',
        run: ([arg]) => this.cd(arg),
      },
      pwd: {
        usage: 'pwd',
        help: 'mostra la cartella corrente',
        run: () => t.echo(this.cwd),
      },
      cat: {
        usage: 'cat <file>',
        help: 'legge un file',
        complete: 'path',
        run: ([arg]) => (arg ? this.cat(arg) : t.echo('Uso: cat <file>', 'err')),
      },
      stat: {
        usage: 'stat <file>',
        help: 'proprietà di un file (autore, modifica)',
        complete: 'path',
        run: ([arg]) => (arg ? this.stat(arg) : t.echo('Uso: stat <file>', 'err')),
      },
      open: {
        usage: 'open <file>',
        help: 'apre un file o una cartella nelle app grafiche',
        complete: 'path',
        run: ([arg]) => this.open(arg),
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
          const on = v ? v.toLowerCase() === 'on' : !this.session.sound.enabled;
          setAudio(this.session, on);
          return t.echo(`Audio ${on ? 'attivato' : 'disattivato'}.`, 'dim');
        },
      },
      tema: {
        usage: 'tema verde|ambra',
        help: 'colore del fosforo del terminale',
        complete: ['verde', 'ambra'],
        run: ([v]) => {
          const cur = this.state.settings.theme;
          const theme: Theme = v?.toLowerCase() === 'ambra' ? 'ambra' : v?.toLowerCase() === 'verde' ? 'verde' : cur === 'verde' ? 'ambra' : 'verde';
          setTheme(this.session, theme);
          return t.echo(`Fosforo ${theme}.`, 'dim');
        },
      },
      salto: {
        usage: 'salto [2026|1999]',
        help: 'salto nel tempo: cambia l’aspetto del sistema',
        complete: ['2026', '1999'],
        run: async ([v]) => {
          const current = this.state.settings.os;
          const target: OsTheme = v === '1999' ? 'classico' : v === '2026' ? 'moderno' : current === 'moderno' ? 'classico' : 'moderno';
          if (target === current) return t.echo(`Il sistema è già nel ${target === 'moderno' ? '2026' : '1999'}.`, 'dim');
          await t.print(
            target === 'moderno'
              ? 'Salto temporale: 1999 → 2026\nDownload degli aggiornamenti di FONDAZIONE OS ▒▒▒▒▒▒▒▒▒▒ 100%\nInstallazione in corso… non spegnere il terminale.'
              : 'Salto temporale: 2026 → 1999\nRipristino della configurazione originale ▒▒▒▒▒▒▒▒▒▒ 100%',
            { cls: 'dim', cps: 90 },
          );
          setOsTheme(this.session, target);
          return t.echo(target === 'moderno' ? 'Benvenuto nel 2026. (Per tornare indietro: salto 1999)' : 'Bentornato nel 1999. (Per tornare avanti: salto 2026)', 'ok');
        },
      },
      crediti: {
        usage: 'crediti',
        help: 'licenze e crediti',
        run: () => t.print(this.session.manifest.meta.crediti.join('\n'), { cps: 2000 }),
      },
      aiuto: {
        usage: 'aiuto',
        help: 'obiettivo attuale e un suggerimento in più (fino a 3)',
        run: async () => {
          const o = this.session.currentObjective();
          if (!o) return t.echo('Nessun obiettivo in corso.', 'dim');
          const p = await this.session.openNotebook(o);
          if (!p) return t.echo('Obiettivo cifrato: serve un livello di accesso più alto.', 'warn');
          const already = this.state.hints[o.id] ?? 0;
          const n = already >= p.aiuti.length ? already : this.session.nextHint(o);
          const lines: Line[] = [{ text: `OBIETTIVO — ${p.titolo}`, cls: 'h' }];
          p.aiuti.slice(0, n).forEach((h, i) => lines.push({ text: `Aiuto ${i + 1}: ${h}`, cls: i === n - 1 ? 'hl' : 'dim' }));
          if (n < p.aiuti.length) lines.push({ text: `(digita di nuovo «aiuto» per un suggerimento più preciso: ${n}/${p.aiuti.length})`, cls: 'dim' });
          return t.print(lines, { cps: 400 });
        },
      },
      taccuino: {
        usage: 'taccuino',
        help: 'gli appunti presi finora (anche nell’app Taccuino)',
        run: async () => {
          const notes = this.session.notes();
          if (!notes.length) return t.echo('Taccuino vuoto: annoto da solo quello che scopro leggendo i documenti.', 'dim');
          const lines: Line[] = [{ text: 'TACCUINO', cls: 'h' }];
          for (const n of notes) {
            const p = await this.session.openNotebook(n);
            if (p) lines.push({ text: `• ${p.testo}` });
          }
          this.session.markNotesSeen();
          return t.print(lines, { cps: 2000 });
        },
      },
      // Easter egg (not listed in help): a tribute to a horror storyteller.
      amicodiverte: {
        usage: 'amicodiverte',
        help: '',
        run: async () => {
          this.session.sound.alert('sistema');
          await t.print('Riconoscimento vocale in corso ░▒▓▒░▒▓▒░', { cls: 'dim', cps: 40 });
          await t.print(
            [
              { text: 'Narratore riconosciuto.', cls: 'hl' },
              { text: 'Livello di autorizzazione: PODCAST' },
              { text: 'Gli ascoltatori sono già collegati.' },
              { text: '' },
              { text: 'Il tuo fascicolo è in /archivio/sicurezza/soggetti-di-interesse/', cls: 'dim' },
            ],
            { cps: 60 },
          );
          await new Promise((r) => setTimeout(r, 1800));
          return t.print('…e anche qualcun altro. Abbassa la voce.', { cls: 'warn', cps: 25 });
        },
      },
      reset: {
        usage: 'reset',
        help: 'cancella tutti i progressi',
        run: async () => {
          this.mode = { kind: 'confirm-reset' };
          await t.echo('Questa operazione cancella tutti i progressi. Digita RESET per confermare.', 'warn');
        },
      },
      incarico: {
        usage: 'incarico',
        help: 'rilegge l’ordine di incarico',
        run: () => {
          const intro = this.session.manifest.meta.intro;
          if (!intro) return t.echo('Nessun incarico registrato.', 'dim');
          return t.print([{ text: intro.titolo, cls: 'h' }, ...intro.testo.flatMap((p) => [{ text: p }, { text: '' }])], { cps: 2000 });
        },
      },
      ripara: {
        usage: 'ripara <file> <parità>',
        help: 'ripara un file corrotto con la sua copia di parità',
        complete: 'path',
        run: ([file, parity]) => this.repair(file, parity),
      },
      unisci: {
        usage: 'unisci <frammenti…>',
        help: 'ricompone una chiave dai suoi frammenti',
        complete: 'path',
        run: (args) => this.join(args),
      },
      rispondi: {
        usage: 'rispondi <mail> [opzione]',
        help: 'risponde a un messaggio di posta',
        run: ([n, k]) => this.replyMail(n, k),
      },
      rete: {
        usage: 'rete',
        help: 'elenca i nodi della rete interna',
        run: async () => {
          const { entries } = await this.fs.list('/rete', this.account);
          if (!entries.length) return t.echo('Nessun nodo raggiungibile.', 'dim');
          return t.echo([
            { text: 'NODI DELLA RETE INTERNA (isolata dal 03/03/2026 04:52)', cls: 'h' },
            ...entries.filter((e) => e.kind === 'dir').map((e) => ({ text: `  ${e.name.padEnd(16)} ${e.locked ? 'accesso negato' : 'raggiungibile'}`, cls: e.locked ? 'locked' : undefined })),
            { text: 'Usa: connetti <nodo>', cls: 'dim' },
          ]);
        },
      },
      connetti: {
        usage: 'connetti <nodo>',
        help: 'si collega a un altro nodo della rete',
        run: async ([node]) => {
          if (!node) return t.echo('Uso: connetti <nodo>  (vedi "rete")', 'err');
          const target = `/rete/${node.toLowerCase()}`;
          const st = await this.fs.stat(target, this.account);
          if (!st || st.kind !== 'dir') return t.echo(`connetti: nodo "${node}" non raggiungibile.`, 'err');
          if (st.locked) return t.echo(`ACCESSO NEGATO — ${st.reason}`, 'err');
          await t.print(`Connessione a ${node.toUpperCase()} ▒▒▒▒▒▒`, { cls: 'dim', cps: 60 });
          this.cwd = target;
          return t.echo(`Connesso a ${node.toUpperCase()}. "cd /" per tornare a T-03.`, 'ok');
        },
      },
      radio: {
        usage: 'radio [MHz]',
        help: 'sintonizza il ricevitore radio',
        run: ([f]) => (f ? this.tune(f) : this.host.launch ? this.host.launch('radio') : t.echo('Uso: radio <frequenza in MHz>', 'err')),
      },
      voci: {
        usage: 'voci',
        help: 'catalogo delle voci identificate',
        run: () => this.voices(),
      },
      telecamere: {
        usage: 'telecamere',
        help: 'apre la videosorveglianza',
        run: () => (this.host.launch ? this.host.launch('cameras') : t.echo('Nessuna interfaccia grafica disponibile.', 'err')),
      },
      exit: {
        usage: 'exit',
        help: 'chiude il terminale',
        run: () => {
          if (this.host.exit) this.host.exit();
          else return t.echo('Non puoi chiudere questo terminale.', 'dim');
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
    if (!(await this.account.login(user, password))) {
      this.session.sound.alert('sistema');
      await this.term.echo('Autenticazione fallita.', 'err');
      this.updatePrompt();
      return;
    }
    await this.welcome();
  }

  private async welcome() {
    const a = this.account;
    const k = a.keyring!;
    this.cwd = this.home;
    this.session.recordLogin(a.user);
    this.host.userChanged?.(a);
    const mail = a.visibleMail();
    const unread = this.session.unreadMail(a);
    this.updatePrompt();
    await this.term.print([
      { text: `Accesso eseguito in questo terminale. Benvenuto/a, ${k.nome}.`, cls: 'ok' },
      { text: `Livello di accesso ${k.livello} — ${a.levelLabel(k.livello)}`, cls: 'hl' },
      { text: `Posta: ${mail.length} messaggi${unread ? `, ${unread} non letti` : ''}. Digita "mail".`, cls: 'dim' },
    ]);
  }

  /* Files --------------------------------------------------------- */

  private nodeLine(n: VNode): Line {
    const name = n.kind === 'dir' ? `${n.name}/` : n.name;
    const padded = name.padEnd(30);
    if (n.locked) return { text: `${padded} [L${n.level}] ${n.label ?? n.reason ?? 'accesso negato'}`, cls: 'locked' };
    if (n.encrypted) return { text: `${padded} [CIFRATO]`, cls: 'warn' };
    const info = [n.label, n.size !== undefined && n.kind !== 'dir' ? formatSize(n.size) : '', n.level ? `[L${n.level}]` : '']
      .filter(Boolean)
      .join('  ');
    return { text: info ? `${padded} ${info}` : name, cls: n.kind === 'dir' ? 'dir' : undefined };
  }

  private async ls(arg: string | undefined, all: boolean) {
    const t = this.term;
    const path = this.resolve(arg ?? '.');
    const node = await this.slow(this.fs.stat(path, this.account));
    if (!node) return t.echo(`ls: ${arg ?? path}: file o cartella inesistente`, 'err');
    if (node.kind !== 'dir') return t.echo([this.nodeLine(node)]);
    if (node.locked) return t.echo(`ACCESSO NEGATO — ${node.reason}`, 'err');
    let res;
    try {
      res = await this.slow(this.fs.list(path, this.account));
    } catch {
      return t.echo('Connessione all’archivio centrale fallita. Riprova.', 'err');
    }
    const hidden = res.entries.filter((e) => e.hidden).length;
    const entries = all ? res.entries : res.entries.filter((e) => !e.hidden);
    if (!entries.length) return t.echo(hidden ? `(nessun file visibile — ${hidden} nascosti, usa ls -a)` : '(cartella vuota)', 'dim');
    return t.echo(entries.map((e) => this.nodeLine(e)));
  }

  private async cd(arg?: string) {
    const t = this.term;
    const target = arg ? this.resolve(arg) : this.home;
    const node = await this.slow(this.fs.stat(target, this.account));
    if (!node) return t.echo(`cd: ${arg}: cartella inesistente`, 'err');
    if (node.kind !== 'dir') return t.echo(`cd: ${arg} non è una cartella`, 'err');
    if (node.locked) return t.echo(`ACCESSO NEGATO — ${node.reason}`, 'err');
    this.cwd = node.path;
  }

  private async cat(arg: string) {
    const t = this.term;
    const path = this.resolve(arg);
    let res: ReadResult;
    try {
      res = await this.slow(this.fs.read(path, this.account));
    } catch {
      return t.echo('Connessione all’archivio centrale fallita. Riprova.', 'err');
    }
    if (!res.ok) {
      if (res.reason === 'denied') this.session.sound.alert('sistema');
      if (res.reason === 'encrypted') return t.echo([{ text: noise(4), cls: 'dim' }, { text: res.message, cls: 'warn' }]);
      return t.echo(res.message, 'err');
    }
    const header: Line = { text: `── ${path} ${'─'.repeat(Math.max(4, 44 - path.length))}`, cls: 'dim' };
    if (res.kind === 'text') return t.print([header, ...formatDoc(res.text)]);
    if (res.kind === 'image') {
      await t.echo([header]);
      await t.printImage(res.src, res.caption);
      if (res.meta?.licence) await t.echo(res.meta.licence, 'dim');
      return;
    }
    const m = res.meta;
    await t.print(
      [
        header,
        { text: m.title, cls: 'h' },
        ...(m.classLabel ? [{ text: `Classe: ${m.classLabel} · Livello di accesso ${m.level ?? '?'}`, cls: 'dim' }] : []),
        { text: '' },
        ...formatDoc(res.text),
        { text: '' },
        ...(m.licence ? [{ text: m.licence, cls: 'dim' }] : []),
        ...(m.related?.length ? [{ text: `Nella cartella: ${m.related.map((r) => r.name).join(', ')}`, cls: 'dim' }] : []),
        { text: `Per la versione grafica: open "${basename(path)}"`, cls: 'dim' },
      ],
      { cps: 1500 },
    );
  }

  private async stat(arg: string) {
    const t = this.term;
    const path = this.resolve(arg);
    const node = await this.slow(this.fs.stat(path, this.account));
    if (!node) return t.echo(`stat: ${arg}: file inesistente`, 'err');
    const props = node.kind === 'dir' || node.locked ? null : await this.fs.props(path, this.account);
    const kind = node.kind === 'dir' ? 'cartella' : node.encrypted ? 'file cifrato' : node.kind === 'image' ? 'immagine' : node.kind === 'html' ? 'documento SCP' : 'documento di testo';
    return t.echo([
      { text: `File:      ${node.path}` },
      { text: `Tipo:      ${kind}${node.hidden ? ' (nascosto)' : ''}` },
      { text: `Livello:   ${node.level}${node.locked ? ` — ${node.reason ?? 'accesso negato'}` : ''}` },
      ...(node.size !== undefined && node.kind !== 'dir' ? [{ text: `Dim.:      ${formatSize(node.size)}` }] : []),
      ...(node.locked ? [{ text: 'Autore e data di modifica: riservati.', cls: 'dim' }] : node.encrypted ? [{ text: 'Autore e data di modifica: cifrati.', cls: 'dim' }] : []),
      ...(props?.autore ? [{ text: `Autore:    ${props.autore}`, cls: 'hl' }] : []),
      ...(props?.modificato ? [{ text: `Modificato: ${props.modificato}`, cls: 'hl' }] : []),
    ]);
  }

  private async repair(file?: string, parity?: string) {
    const t = this.term;
    if (!file || !parity) return t.echo('Uso: ripara <file> <copia di parità>', 'err');
    const target = this.resolve(file);
    const par = this.resolve(parity);
    const entry = this.session.gameFs.entry(target, this.account);
    if (!entry) return t.echo(`ripara: ${file}: file inesistente`, 'err');
    if (!entry.c) return t.echo(`${file}: il file non risulta danneggiato.`, 'dim');
    if (this.state.repaired.includes(target)) return t.echo(`${file}: già riparato.`, 'dim');
    const props = await this.fs.props(par, this.account);
    if (!props) return t.echo(`ripara: ${parity}: copia di parità non leggibile.`, 'err');
    const meta = await this.parityTarget(par);
    await t.print('Ricostruzione dei blocchi ▒▒▒▒▒▒▒▒▒▒▒▒', { cls: 'dim', cps: 50 });
    if (meta !== target) {
      this.session.sound.alert('sistema');
      return t.echo('Parità non corrispondente: il file appartiene a un altro documento.', 'err');
    }
    this.state.repaired.push(target);
    this.session.store.save();
    this.session.notify();
    return t.echo(`${file}: riparato. Usa: cat ${file}`, 'ok');
  }

  private async parityTarget(path: string): Promise<string | undefined> {
    const entry = this.session.gameFs.entry(path, this.account);
    if (!entry) return undefined;
    const res = await this.account.read(entry);
    return res.status === 'ok' ? res.meta?.ripara : undefined;
  }

  private async join(args: string[]) {
    const t = this.term;
    if (!args.length) return t.echo('Uso: unisci <frammento> <frammento> …', 'err');
    const parts: { n: number; tot: number; word: string }[] = [];
    for (const a of args) {
      const res = await this.fs.read(this.resolve(a), this.account);
      if (!res.ok || res.kind !== 'text') return t.echo(`unisci: ${a}: ${res.ok ? 'non è un frammento' : res.message}`, 'err');
      const m = res.text.match(/FRAMMENTO\s+(\d+)\s*\/\s*(\d+)[^«"]*[«"]([^»"]+)[»"]/i);
      if (!m) return t.echo(`unisci: ${a}: non è un frammento.`, 'err');
      parts.push({ n: Number(m[1]), tot: Number(m[2]), word: m[3].trim() });
    }
    parts.sort((a, b) => a.n - b.n);
    const tot = parts[0].tot;
    const missing = Array.from({ length: tot }, (_, i) => i + 1).filter((n) => !parts.some((p) => p.n === n));
    const phrase = Array.from({ length: tot }, (_, i) => parts.find((p) => p.n === i + 1)?.word ?? '_____').join(' ');
    return t.echo([
      { text: `Chiave ricomposta: ${phrase}`, cls: missing.length ? 'warn' : 'ok' },
      { text: missing.length ? `Frammenti mancanti: ${missing.join(', ')} di ${tot}.` : 'Chiave completa.', cls: 'dim' },
    ]);
  }

  private async replyMail(n?: string, k?: string) {
    const t = this.term;
    const a = this.account;
    if (a.user === GUEST) return t.echo('L’utente ospite non ha una casella di posta.', 'err');
    const m = a.visibleMail()[Number(n) - 1];
    if (!m) return t.echo('Uso: rispondi <numero mail> [opzione]', 'err');
    if (!m.r?.length) return t.echo('A questo messaggio non si può rispondere.', 'dim');
    if (this.state.replied.includes(`${a.user}/${m.id}`)) return t.echo('Hai già risposto a questo messaggio.', 'dim');
    const choice = Number(k);
    if (!choice) {
      return t.echo([{ text: `Risposte possibili a «${m.oggetto}»:`, cls: 'hl' }, ...m.r.map((r, i) => ({ text: `  ${i + 1}. ${r.t}` })), { text: `Usa: rispondi ${n} <opzione>`, cls: 'dim' }]);
    }
    const r = m.r[choice - 1];
    if (!r) return t.echo('Opzione inesistente.', 'err');
    this.session.reply(a.user, m.id, r.s);
    return t.echo(`Risposta inviata a ${m.da}: «${r.t}»`, 'ok');
  }

  private async tune(raw: string) {
    const t = this.term;
    const f = Number(raw.replace(',', '.'));
    if (!f) return t.echo('Uso: radio <frequenza in MHz>, es. radio 7,215', 'err');
    const fired = this.state.fired;
    const station = this.session.manifest.radio.find((s) => Math.abs(s.f - f) < 0.0051 && (!s.v || fired.includes(s.v)) && (!s.o || inTimeWindow(s.o)));
    await t.print(`Sintonia ${f.toFixed(3).replace('.', ',')} MHz ░▒░▒░▒░`, { cls: 'dim', cps: 60 });
    if (!station) return t.echo('…solo rumore.', 'dim');
    const p = await this.account.openLevel(station.b, station.l);
    if (!p) return t.echo('Segnale presente ma incomprensibile (cifratura di livello superiore).', 'warn');
    const text = await this.account.renderBody(p.testo);
    void this.session.playRecording(station);
    return t.print([{ text: `◉ ${p.nome}`, cls: 'hl' }, ...formatDoc(text)], { cps: 120 });
  }

  private async voices() {
    const t = this.term;
    const list = this.session.manifest.voci;
    const lines: Line[] = [];
    let known = 0;
    for (const v of list) {
      const unlocked = this.session.voiceUnlocked(v);
      const p = unlocked ? await this.account.openLevel(v.b, v.l) : null;
      if (p) known++;
      lines.push(p ? { text: `  ◉ ${p.nome}` } : { text: '  ○ ??? — voce non identificata', cls: 'dim' });
    }
    return t.echo([{ text: `FONOTECA DI ECO — voci identificate ${known}/${list.length}`, cls: 'h' }, ...lines, { text: 'Dettagli nell’app Fonoteca.', cls: 'dim' }]);
  }

  private async open(arg?: string) {
    const t = this.term;
    if (!arg) return t.echo('Uso: open <file o cartella>', 'err');
    if (!this.host.open) return t.echo('Nessuna interfaccia grafica disponibile.', 'err');
    const path = this.resolve(arg);
    const node = await this.slow(this.fs.stat(path, this.account));
    if (!node) return t.echo(`open: ${arg}: file inesistente`, 'err');
    if (node.locked) return t.echo(`ACCESSO NEGATO — ${node.reason}`, 'err');
    this.host.open(path, this.account);
    return t.echo(`Aperto in ${node.kind === 'dir' ? 'Esplora risorse' : node.kind === 'image' ? 'Visualizzatore immagini' : 'Visualizzatore documenti'}.`, 'dim');
  }

  private async decrypt(arg: string | undefined, key: string) {
    const t = this.term;
    if (!arg || !key) return t.echo('Uso: decrypt <file> <chiave>', 'err');
    const path = this.resolve(arg);
    const file = this.session.gameFs.entry(path, this.account);
    if (!file) return t.echo(`decrypt: ${arg}: file inesistente o non decifrabile`, 'err');
    if (!this.account.canRead(file)) return t.echo(`ACCESSO NEGATO — Livello ${file.l} richiesto`, 'err');
    if (!file.e) return t.echo(`${arg}: il file non è cifrato.`, 'dim');
    if (this.account.isUnlocked(file)) return t.echo(`${arg}: già decifrato. Usa: cat ${arg}`, 'dim');
    await t.print('Decifratura in corso ▒▒▒▒▒▒▒▒▒▒', { cls: 'dim', cps: 40 });
    if (await this.account.decrypt(file, key)) {
      await t.echo(`Decifratura riuscita. Usa: cat ${arg}`, 'ok');
      this.session.notify();
      this.session.events.check();
    } else {
      this.session.sound.alert('sistema');
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
    const acc = this.account;
    for (const f of acc.allFiles()) {
      if (f.p.toLowerCase().includes(q)) hits.push({ text: `${f.p}  (nome del file)`, cls: 'dim' });
      if (!acc.canRead(f) || !acc.isUnlocked(f)) continue;
      const res = await acc.read(f);
      if (res.status === 'ok') add(f.p, res.text);
    }
    for (const [i, m] of acc.visibleMail().entries()) add(`mail ${i + 1}`, `${m.oggetto}\n${await acc.readMail(m)}`);
    if (!hits.length) return t.echo(`Nessun risultato per "${query}" nei file accessibili.`, 'dim');
    const shown = hits.slice(0, 20);
    return t.echo([...shown, { text: `${hits.length} risultat${hits.length === 1 ? 'o' : 'i'}${hits.length > shown.length ? ` (mostrati ${shown.length})` : ''}.`, cls: 'dim' }]);
  }

  private async mail(n?: string) {
    const t = this.term;
    const a = this.account;
    if (a.user === GUEST) return t.echo('L’utente ospite non ha una casella di posta. Effettua il login.', 'err');
    const list = a.visibleMail();
    if (!list.length) return t.echo('Nessun messaggio.', 'dim');
    if (!n) {
      const lines: Line[] = [{ text: `  #  ${'DATA'.padEnd(17)} ${'DA'.padEnd(14)} OGGETTO`, cls: 'dim' }];
      list.forEach((m, i) => {
        const unread = !this.state.mailRead.includes(`${a.user}/${m.id}`);
        lines.push({ text: `${unread ? '*' : ' '}${String(i + 1).padStart(2)}  ${m.data.padEnd(17)} ${m.da.padEnd(14)} ${m.oggetto}`, cls: unread ? 'hl' : undefined });
      });
      lines.push({ text: 'Usa "mail <numero>" per leggere. * = non letto', cls: 'dim' });
      return t.echo(lines);
    }
    const m = list[Number(n) - 1];
    if (!m) return t.echo(`mail: messaggio ${n} inesistente`, 'err');
    const body = await a.readMail(m);
    await t.print([
      { text: `Da:      ${m.da}`, cls: 'hl' },
      { text: `A:       ${m.a}` },
      { text: `Data:    ${m.data}` },
      { text: `Oggetto: ${m.oggetto}`, cls: 'hl' },
      { text: '─'.repeat(48), cls: 'dim' },
      ...formatDoc(body),
    ]);
    this.session.markMailRead(a.user, m.id);
  }

  /* Completion ---------------------------------------------------- */

  private complete(value: string): { value?: string; options?: string[] } {
    if (this.mode.kind !== 'command') return {};
    const { start, text: current, index } = lastToken(value);
    const head = value.slice(0, start);
    if (index === 0) {
      const names = ORDER.filter((c) => c.startsWith(current.toLowerCase()));
      return pick(current, names, (n) => `${n} `, (p) => p);
    }
    const cmdName = tokenize(value)[0]?.toLowerCase();
    const cmd = this.commands[cmdName];
    if (!cmd?.complete) return {};
    if (cmdName === 'decrypt' && index > 1) return {};
    if (cmd.complete === 'user') {
      const users = this.account.users.filter((u) => u.startsWith(current.toLowerCase()));
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
    let names = this.fs.names(dir, this.account);
    if (!base.startsWith('.')) names = names.filter((n) => !n.startsWith('.'));
    names = names.filter((n) => n.toLowerCase().startsWith(base.toLowerCase()));
    return pick(
      base,
      names,
      (n) => `${head}${escapeArg(dirPart + n)}${n.endsWith('/') ? '' : ' '}`,
      (p) => `${head}${escapeArg(dirPart + p)}`,
    );
  }
}

/* Helpers ---------------------------------------------------------- */

/** Splits a command line, honouring "quotes", 'quotes' and backslash escapes. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let has = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      has = true;
    } else if (c === '\\' && i + 1 < line.length) {
      cur += line[++i];
      has = true;
    } else if (/\s/.test(c)) {
      if (has || cur) out.push(cur);
      cur = '';
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (has || cur) out.push(cur);
  return out;
}

/** The token being typed at the end of the line (for completion). */
function lastToken(line: string): { start: number; text: string; index: number } {
  let start = 0;
  let index = 0;
  let quote: string | null = null;
  let inToken = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '\\') {
      if (!inToken) {
        inToken = true;
        start = i;
      }
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      if (inToken) index++;
      inToken = false;
      continue;
    }
    if (!inToken) {
      inToken = true;
      start = i;
    }
    if (c === '"' || c === "'") quote = c;
  }
  if (!inToken) return { start: line.length, text: '', index };
  return { start, text: tokenize(line.slice(start))[0] ?? '', index };
}

function escapeArg(s: string) {
  return s.replace(/([\s"'\\])/g, '\\$1');
}

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
  return { options: options.length > 60 ? [...options.slice(0, 60), `… (${options.length - 60} altri)`] : options };
}

export function setTheme(session: Session, theme: Theme) {
  document.documentElement.dataset.phosphor = theme;
  session.state.settings.theme = theme;
  session.store.save();
  try {
    localStorage.setItem('terminale:tema', theme);
  } catch {
    /* ignore */
  }
  session.notify();
}

/** Switches the look of the desktop; only the theme changes. */
export function setOsTheme(session: Session, os: OsTheme) {
  document.documentElement.classList.add('os-switching');
  document.documentElement.dataset.os = os;
  session.state.settings.os = os;
  session.store.save();
  try {
    localStorage.setItem('terminale:os', os);
  } catch {
    /* ignore */
  }
  setTimeout(() => document.documentElement.classList.remove('os-switching'), 900);
  session.notify();
}

export function setAudio(session: Session, on: boolean) {
  session.sound.setEnabled(on);
  session.state.settings.audio = on;
  session.store.save();
  session.notify();
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

/** Light markup for documents: # titles, ## subtitles, > quotes, --- rules. */
export function formatDoc(text: string): Line[] {
  return text.split('\n').map((line) => {
    if (/^#\s/.test(line)) return { text: line.replace(/^#\s+/, '').toUpperCase(), cls: 'h' };
    if (/^##\s/.test(line)) return { text: line.replace(/^##\s+/, ''), cls: 'hl' };
    if (/^>\s?/.test(line)) return { text: `│ ${line.replace(/^>\s?/, '')}`, cls: 'quote' };
    if (/^-{3,}\s*$/.test(line)) return { text: '─'.repeat(48), cls: 'dim' };
    return { text: line };
  });
}
