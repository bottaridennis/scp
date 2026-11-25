/**
 * Login screen. Logging in decrypts the user's keyring exactly like the
 * terminal `login` command; a profile unlocked once enters without password.
 */
import { GUEST } from '../engine/game.ts';
import type { Session } from '../engine/session.ts';
import { h, icon } from './dom.ts';
import { ICONS } from './icons.ts';

export class LoginScreen {
  private readonly session: Session;
  private readonly el: HTMLElement;
  private readonly list: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly formLabel: HTMLElement;
  private readonly password: HTMLInputElement;
  private readonly error: HTMLElement;
  private selected: string | null = null;
  private onLogin: (user: string) => void = () => {};

  constructor(session: Session, mount: HTMLElement) {
    this.session = session;
    this.list = h('div', { class: 'login-profiles', role: 'list' });
    this.formLabel = h('label', { for: 'login-password' });
    this.password = h('input', { id: 'login-password', type: 'password', autocomplete: 'off', class: 'field', spellcheck: 'false' });
    this.error = h('p', { class: 'login-error', role: 'alert' });
    const submit = h('button', { type: 'submit', class: 'btn btn-default' }, 'Accedi');
    const cancel = h('button', { type: 'button', class: 'btn', onclick: () => this.select(null) }, 'Annulla');
    this.form = h('form', { class: 'login-form', hidden: true }, this.formLabel, this.password, this.error, h('div', { class: 'btn-row' }, submit, cancel));
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit();
    });
    const meta = session.manifest.meta;
    this.el = h(
      'div',
      { class: 'login', hidden: true },
      h(
        'div',
        { class: 'login-box bevel', role: 'dialog', 'aria-label': 'Accesso al sistema' },
        h('div', { class: 'login-head' }, icon(ICONS.logo, 'ico ico-xl'), h('div', {}, h('strong', {}, 'FONDAZIONE OS'), h('small', {}, `${meta.titolo}`))),
        h('div', { class: 'login-body' }, h('p', { class: 'login-hint' }, 'Seleziona un profilo per accedere alla postazione.'), this.list, this.form),
        h('div', { class: 'login-foot' }, h('span', {}, 'Ogni accesso è registrato.'), h('button', { type: 'button', class: 'btn', onclick: () => location.reload() }, 'Riavvia')),
      ),
    );
    mount.appendChild(this.el);
  }

  show(onLogin: (user: string) => void) {
    this.onLogin = onLogin;
    this.select(null);
    this.render();
    this.el.hidden = false;
    (this.list.querySelector('button') as HTMLElement | null)?.focus();
  }

  hide() {
    this.el.hidden = true;
  }

  private render() {
    this.list.replaceChildren(
      ...this.session.profiles().map((p) =>
        h(
          'button',
          {
            type: 'button',
            role: 'listitem',
            class: `profile${this.selected === p.name ? ' is-selected' : ''}`,
            onclick: () => void this.choose(p.name, p.unlocked),
          },
          icon(p.name === GUEST ? ICONS.guest : ICONS.user, 'ico ico-lg'),
          h(
            'span',
            { class: 'profile-text' },
            h('strong', {}, p.name),
            h('small', {}, p.name === GUEST ? 'Accesso pubblico, nessuna password' : p.unlocked ? 'Credenziali memorizzate' : 'Protetto da password'),
          ),
        ),
      ),
    );
  }

  private select(name: string | null) {
    this.selected = name;
    this.error.textContent = '';
    this.password.value = '';
    this.form.hidden = !name;
    if (name) {
      this.formLabel.textContent = `Password per ${name}:`;
      setTimeout(() => this.password.focus(), 0);
    }
    this.render();
  }

  private async choose(name: string, unlocked: boolean) {
    if (name === GUEST || unlocked) {
      this.busy(true);
      const ok = await this.session.loginDesktop(name);
      this.busy(false);
      if (ok) return this.done(name);
    }
    this.select(name);
  }

  private async submit() {
    if (!this.selected) return;
    if (!this.password.value) {
      this.error.textContent = 'Inserisci la password.';
      return;
    }
    this.busy(true);
    this.error.textContent = 'Verifica delle credenziali…';
    const ok = await this.session.loginDesktop(this.selected, this.password.value);
    this.busy(false);
    if (!ok) {
      this.session.sound.alert('sistema');
      this.error.textContent = 'Password errata. Accesso negato.';
      this.password.select();
      return;
    }
    this.done(this.selected);
  }

  private busy(on: boolean) {
    this.el.classList.toggle('is-busy', on);
  }

  private done(name: string) {
    this.hide();
    this.onLogin(name);
  }
}
