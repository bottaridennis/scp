/**
 * Login screen. Logging in decrypts the user's keyring exactly like the
 * terminal `login` command; a profile unlocked once enters without password.
 */
import { GUEST } from '../engine/game.ts';
import type { Session } from '../engine/session.ts';
import { h, icon } from './dom.ts';
import { ICONS } from './icons.ts';

const OTHER = '\u0000altro';

export class LoginScreen {
  private readonly session: Session;
  private readonly el: HTMLElement;
  private readonly list: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly formLabel: HTMLElement;
  private readonly password: HTMLInputElement;
  private readonly username: HTMLInputElement;
  private readonly userRow: HTMLElement;
  private readonly error: HTMLElement;
  private selected: string | null = null;
  private onLogin: (user: string) => void = () => {};

  constructor(session: Session, mount: HTMLElement) {
    this.session = session;
    this.list = h('div', { class: 'login-profiles', role: 'list' });
    this.formLabel = h('label', { for: 'login-password' });
    this.password = h('input', { id: 'login-password', type: 'password', autocomplete: 'off', class: 'field', spellcheck: 'false' });
    this.username = h('input', { id: 'login-user', type: 'text', autocomplete: 'off', autocapitalize: 'off', class: 'field', spellcheck: 'false' });
    this.userRow = h('div', { class: 'login-user-row', hidden: true }, h('label', { for: 'login-user' }, 'Nome utente:'), this.username);
    this.error = h('p', { class: 'login-error', role: 'alert' });
    const submit = h('button', { type: 'submit', class: 'btn btn-default' }, 'Accedi');
    const cancel = h('button', { type: 'button', class: 'btn', onclick: () => this.select(null) }, 'Annulla');
    this.form = h('form', { class: 'login-form', hidden: true }, this.userRow, this.formLabel, this.password, this.error, h('div', { class: 'btn-row' }, submit, cancel));
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
    const other = h(
      'button',
      { type: 'button', role: 'listitem', class: `profile${this.selected === OTHER ? ' is-selected' : ''}`, onclick: () => this.select(OTHER) },
      icon(ICONS.user, 'ico ico-lg'),
      h('span', { class: 'profile-text' }, h('strong', {}, 'Altro utente…'), h('small', {}, 'Accesso con nome utente e password')),
    );
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
      other,
    );
  }

  private select(name: string | null) {
    this.selected = name;
    this.error.textContent = '';
    this.password.value = '';
    this.form.hidden = !name;
    this.userRow.hidden = name !== OTHER;
    this.username.value = '';
    if (name === OTHER) {
      this.formLabel.textContent = 'Password:';
      setTimeout(() => this.username.focus(), 0);
    } else if (name) {
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
    const name = this.selected === OTHER ? this.username.value.trim().toLowerCase() : this.selected;
    if (!name) {
      this.error.textContent = 'Inserisci il nome utente.';
      return;
    }
    if (name === GUEST) {
      await this.session.loginDesktop(GUEST);
      return this.done(GUEST);
    }
    if (!this.session.desktop.hasUser(name)) {
      this.session.sound.alert('sistema');
      this.error.textContent = 'Utente o password errati. Accesso negato.';
      return;
    }
    if (!this.password.value && this.session.desktop.hasStoredKey(name) && (await this.session.loginDesktop(name))) {
      return this.done(name);
    }
    if (!this.password.value) {
      this.error.textContent = 'Inserisci la password.';
      return;
    }
    this.busy(true);
    this.error.textContent = 'Verifica delle credenziali…';
    const ok = await this.session.loginDesktop(name, this.password.value);
    this.busy(false);
    if (!ok) {
      this.session.sound.alert('sistema');
      this.error.textContent = this.selected === OTHER ? 'Utente o password errati. Accesso negato.' : 'Password errata. Accesso negato.';
      this.password.select();
      return;
    }
    this.done(name);
  }

  private busy(on: boolean) {
    this.el.classList.toggle('is-busy', on);
  }

  private done(name: string) {
    this.hide();
    this.onLogin(name);
  }
}
