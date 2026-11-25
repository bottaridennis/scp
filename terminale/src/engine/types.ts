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

/** Document properties (shown by `stat` and "Proprietà"), encrypted with the document. */
export type DocMeta = { autore?: string; modificato?: string; didascalia?: string; ripara?: string };

/** A document body: text with segment markers (\u0001<index>\u0001) plus the segments. Images keep a data URL in `t`. */
export type DocBody = { t: string; g: Segment[]; m?: DocMeta };

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
  /** Only present after this event has fired. */
  v?: string;
  /** Corrupted by Eco: shown garbled until repaired with `ripara`. */
  c?: boolean;
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
  /** Possible replies: text shown and signal recorded (fires events with dopo_evento). */
  r?: { t: string; s: string }[];
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

/** An encrypted recording in public/data/audio/, readable with the level key `l`. */
export type AudioRef = { f: string; l: number };

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
    /** Local time window, e.g. "03:00-03:10". */
    ora?: string;
    /** Local date, "MM-DD". */
    giorno?: string;
  };
  ritardo: number;
  /** Recorded voice in public/audio/, played when the event fires (sounds on). */
  a?: string;
  /** Encrypted recorded voice (events above level 0). */
  ax?: AudioRef;
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
    /** Optional mount of the real SCP archive (public data, levels are a game rule). */
    archivio?: ArchiveConfig;
    /** Briefing shown before the first login. */
    intro?: { titolo: string; testo: string[]; audio?: string };
  };
  radio: RadioEntry[];
  voci: VoiceEntry[];
  camere: CameraEntry[];
  web: WebEntry[];
  /** Per-level check values used to validate keys restored from localStorage. */
  check: Record<string, Envelope>;
  /** Users and their keyrings, each sealed with PBKDF2(password). */
  utenti: { n: string; k: Envelope; h?: boolean }[];
  files: FileEntry[];
  eventi: EventEntry[];
};

export type ArchiveConfig = {
  /** Mount point, e.g. /archivio-scp */
  cartella: string;
  /** Level required per object-class tag; "*" for unknown/special classes. */
  livelli: Record<string, number>;
  /** Extra levels required for addenda, logs and other sections (max 5). */
  livello_sezioni: number;
  /** "bloccati": shown with a lock and [CLASSIFICATO]; "nascosti": not listed. */
  sopra_livello: 'bloccati' | 'nascosti';
};

/* Radio, voice catalogue, cameras ------------------------------------ */

export type RadioPayload = { nome: string; testo: DocBody };
export type RadioEntry = {
  /** Frequency in MHz. */
  f: number;
  l: number;
  /** Only on air after this event. */
  v?: string;
  /** Only on air in this time window, "HH:MM-HH:MM" (local time). */
  o?: string;
  /** Recorded transmission in public/audio/. */
  a?: string;
  /** Encrypted recorded transmission (stations above level 0). */
  ax?: AudioRef;
  b: Sealed<RadioPayload>;
};

export type VoicePayload = { nome: string; testo: DocBody };
export type VoiceEntry = {
  id: string;
  l: number;
  /** Encrypted sample of the voice. */
  ax?: AudioRef;
  cond: { lettura?: string; evento?: string };
  b: Sealed<VoicePayload>;
};

export type WebPayload = { titolo: string; testo: DocBody };
export type WebEntry = {
  /** Normalised address, e.g. "intranet.sito47/turni". */
  u: string;
  l: number;
  /** Only reachable after this event. */
  v?: string;
  /** Bookmark label on the browser's start page, if any. */
  s?: { t: string; n: string };
  b: Sealed<WebPayload>;
};

export type CameraPayload = { messaggi: string[] };
export type CameraEntry = {
  id: string;
  nome: string;
  l: number;
  /** Scene drawn by the camera app. */
  scena: string;
  /** Scripted behaviour. */
  comportamento: string;
  /** Only visible after this event. */
  v?: string;
  b: Sealed<CameraPayload>;
};
