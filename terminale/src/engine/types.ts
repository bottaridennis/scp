/** Data formats shared by the content build script and the browser engine. */

/** AES-GCM ciphertext. */
export type Envelope = { iv: string; ct: string };

/** A value that is either stored in clear ({ p }) or encrypted in one or more layers. */
export type Sealed<T> = { p: T } | Envelope;

/** A censored portion of a document: `[[L3: testo]]`. */
export type Segment = {
  /** Level required to read it. */
  l: number;
  /** Length of the hidden text, used to draw ████ of the right size. */
  n: number;
  /** true for `[[L3!: …]]`, rendered as [DATI ELIMINATI]. */
  x: boolean;
  /** The text, encrypted with the level key. */
  d: Envelope;
};

/** A document body: text with segment markers (\u0001<index>\u0001) plus the segments. */
export type DocBody = { t: string; g: Segment[] };

export type FileEntry = {
  /** Absolute virtual path, e.g. /archivio/ricerca/scheda.txt */
  p: string;
  /** Minimum access level. */
  l: number;
  /** Encrypted file: also needs `decrypt <file> <key>`. */
  e: boolean;
  /** Size in characters (shown by ls). */
  s: number;
  /** Body: level layer outside, decrypt layer inside. */
  b: Sealed<DocBody>;
};

export type MailEntry = {
  id: string;
  da: string;
  a: string;
  oggetto: string;
  data: string;
  /** Hidden until this event has fired. */
  dopo?: string;
  l: number;
  b: Sealed<DocBody>;
};

export type Keyring = {
  nome: string;
  ruolo: string;
  livello: number;
  /** Raw AES keys (base64) for every level up to the user's own. */
  chiavi: Record<string, string>;
  home: FileEntry[];
  posta: MailEntry[];
};

export type EventKind = 'sistema' | 'intruso' | 'glitch' | 'finale';

export type EventPayload = { da?: string; testo: DocBody };

export type EventEntry = {
  id: string;
  l: number;
  tipo: EventKind;
  cond: {
    lettura?: string;
    login?: string;
    evento?: string;
    /** Hash prefix of the command phrase (the phrase itself is never stored). */
    cmd?: string;
  };
  ritardo: number;
  b: Sealed<EventPayload>;
};

export type Manifest = {
  v: 1;
  id: string;
  iter: number;
  meta: {
    titolo: string;
    host: string;
    livelli: Record<string, string>;
    logo: string[];
    boot: string[];
    crediti: string[];
  };
  /** Per-level check values used to validate keys restored from localStorage. */
  check: Record<string, Envelope>;
  /** Users and their keyrings, each sealed with PBKDF2(password). */
  utenti: { n: string; k: Envelope }[];
  files: FileEntry[];
  eventi: EventEntry[];
};
