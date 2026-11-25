/**
 * The terminal UI: typewriter output, prompt, history, Tab completion,
 * masked input and glitch effects. Knows nothing about the game.
 */

export type Line = { text: string; cls?: string };

type Job = { lines: Line[]; cps: number; resolve: () => void };

export type PrintOptions = {
  cls?: string;
  /** Characters per second; Infinity prints instantly. */
  cps?: number;
};

export const SPEED = { normal: 600, slow: 45, boot: 220 } as const;

const GLITCH_CHARS = '▓▒░█▚▞#%&@$?!<>/\\|';

export class Terminal {
  readonly root: HTMLElement;
  private readonly out: HTMLElement;
  private readonly inputLine: HTMLElement;
  private readonly promptEl: HTMLElement;
  readonly input: HTMLInputElement;

  private queue: Job[] = [];
  private running = false;
  private skipRequested = false;

  history: string[] = [];
  private histIndex = -1;
  private draft = '';

  /** Called with the submitted line. */
  onSubmit: (value: string) => void = () => {};
  /** Returns the completed input, or a list of candidates to show. */
  onComplete: (value: string) => { value?: string; options?: string[] } = () => ({});
  /** Called on every key press (for sounds). */
  onKey: () => void = () => {};
  /** Called for every few characters typed by the typewriter. */
  onType: () => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="crt-output" role="log" aria-live="polite" aria-relevant="additions"></div>
      <form class="crt-input" autocomplete="off">
        <label class="crt-prompt" for="crt-cmd"></label>
        <input id="crt-cmd" class="crt-field" type="text" autocomplete="off" autocapitalize="off"
          autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Comando" />
      </form>`;
    this.out = root.querySelector('.crt-output')!;
    this.inputLine = root.querySelector('.crt-input')!;
    this.promptEl = root.querySelector('.crt-prompt')!;
    this.input = root.querySelector('.crt-field')!;

    this.inputLine.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    this.input.addEventListener('keydown', (e) => this.onKeyDown(e));
    // Tapping the screen focuses the prompt (or skips the typewriter).
    root.addEventListener('pointerup', () => {
      if (window.getSelection()?.toString()) return;
      if (this.running) this.skip();
      this.focus();
    });
    window.addEventListener('keydown', (e) => {
      if (e.target !== this.input && this.running && !e.metaKey && !e.ctrlKey) this.skip();
    });
  }

  /* Output -------------------------------------------------------- */

  print(content: string | Line[], opts: PrintOptions = {}): Promise<void> {
    const lines: Line[] =
      typeof content === 'string'
        ? content.split('\n').map((text) => ({ text, cls: opts.cls }))
        : content.map((l) => ({ ...l, cls: l.cls ?? opts.cls }));
    return new Promise((resolve) => {
      this.queue.push({ lines, cps: opts.cps ?? SPEED.normal, resolve });
      if (!this.running) void this.drain();
    });
  }

  /** Prints instantly, bypassing the typewriter. */
  echo(content: string | Line[], cls?: string) {
    return this.print(content, { cls, cps: Infinity });
  }

  get busy() {
    return this.running;
  }

  skip() {
    this.skipRequested = true;
  }

  private async drain() {
    this.running = true;
    this.root.classList.add('is-busy');
    while (this.queue.length) {
      const job = this.queue.shift()!;
      for (const line of job.lines) {
        const el = document.createElement('div');
        el.className = `crt-line${line.cls ? ` ${line.cls.split(' ').map((c) => `t-${c}`).join(' ')}` : ''}`;
        this.out.appendChild(el);
        if (this.skipRequested || job.cps === Infinity || !line.text) {
          el.textContent = line.text || ' ';
        } else {
          await this.typeLine(el, line.text, job.cps);
        }
        this.scroll();
      }
      job.resolve();
    }
    this.skipRequested = false;
    this.running = false;
    this.root.classList.remove('is-busy');
    this.scroll();
  }

  private typeLine(el: HTMLElement, text: string, cps: number): Promise<void> {
    const chars = [...text];
    return new Promise((resolve) => {
      let shown = 0;
      let last = performance.now();
      let carry = 0;
      let sound = 0;
      const step = (now: number) => {
        if (this.skipRequested) shown = chars.length;
        else {
          carry += ((now - last) / 1000) * cps;
          last = now;
          const n = Math.floor(carry);
          carry -= n;
          shown = Math.min(chars.length, shown + n);
          sound += n;
          if (sound >= 3) {
            sound = 0;
            this.onType();
          }
        }
        el.textContent = chars.slice(0, shown).join('');
        this.scroll();
        if (shown >= chars.length) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  private scroll() {
    this.root.scrollTop = this.root.scrollHeight;
  }

  clear() {
    this.out.replaceChildren();
  }

  /* Input --------------------------------------------------------- */

  setPrompt(text: string) {
    this.promptEl.textContent = text;
  }

  setSecret(secret: boolean) {
    this.input.type = secret ? 'password' : 'text';
  }

  focus() {
    // Avoid popping the virtual keyboard while reading on touch devices only when asked.
    this.input.focus({ preventScroll: true });
  }

  private submit() {
    if (this.running) {
      this.skip();
      return;
    }
    const value = this.input.value;
    const secret = this.input.type === 'password';
    this.input.value = '';
    this.histIndex = -1;
    this.echo([{ text: `${this.promptEl.textContent ?? ''}${secret ? '•'.repeat(value.length) : value}`, cls: 'cmd' }]);
    if (!secret && value.trim() && this.history[this.history.length - 1] !== value) {
      this.history.push(value);
      if (this.history.length > 200) this.history.shift();
    }
    this.onSubmit(value);
  }

  historyPrev() {
    if (!this.history.length || this.input.type === 'password') return;
    if (this.histIndex === -1) {
      this.draft = this.input.value;
      this.histIndex = this.history.length - 1;
    } else if (this.histIndex > 0) this.histIndex--;
    this.setInput(this.history[this.histIndex]);
  }

  historyNext() {
    if (this.histIndex === -1) return;
    if (this.histIndex < this.history.length - 1) {
      this.histIndex++;
      this.setInput(this.history[this.histIndex]);
    } else {
      this.histIndex = -1;
      this.setInput(this.draft);
    }
  }

  complete() {
    if (this.input.type === 'password') return;
    const res = this.onComplete(this.input.value);
    if (res.value !== undefined) this.setInput(res.value);
    if (res.options?.length) {
      this.echo([
        { text: `${this.promptEl.textContent ?? ''}${this.input.value}`, cls: 'cmd' },
        { text: res.options.join('   '), cls: 'dim' },
      ]);
    }
    this.focus();
  }

  private setInput(value: string) {
    this.input.value = value;
    requestAnimationFrame(() => this.input.setSelectionRange(value.length, value.length));
  }

  private onKeyDown(e: KeyboardEvent) {
    this.onKey();
    if (this.running && e.key !== 'Tab') {
      this.skip();
      if (e.key === 'Enter') e.preventDefault();
      return;
    }
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.historyPrev();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.historyNext();
        break;
      case 'Tab':
        e.preventDefault();
        this.complete();
        break;
      case 'l':
        if (e.ctrlKey) {
          e.preventDefault();
          this.clear();
        }
        break;
    }
  }

  /* Effects ------------------------------------------------------- */

  /** Briefly distorts the screen and scrambles the last lines. */
  glitch(duration = 900): Promise<void> {
    const lines = Array.from(this.out.children).slice(-10) as HTMLElement[];
    const originals = lines.map((l) => l.textContent ?? '');
    const scramble = () =>
      lines.forEach((l, i) => {
        l.textContent = [...originals[i]]
          .map((c) => (c !== ' ' && Math.random() < 0.18 ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] : c))
          .join('');
      });
    this.root.classList.add('is-glitch');
    const timer = setInterval(scramble, 70);
    return new Promise((resolve) =>
      setTimeout(() => {
        clearInterval(timer);
        lines.forEach((l, i) => (l.textContent = originals[i]));
        this.root.classList.remove('is-glitch');
        resolve();
      }, duration),
    );
  }
}
