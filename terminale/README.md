# FONDAZIONE OS · Sito-47

Gioco narrativo nel browser: un computer della Fondazione SCP rimasto acceso in un sito
di contenimento abbandonato. Si accede con diversi profili, si leggono documenti, email
e log, si trovano credenziali e chiavi, si sale di livello e si ricostruisce cos'è
successo. Sul desktop c'è anche l'archivio SCP vero, filtrato per livello di accesso.

Vite + TypeScript, nessun framework, nessun backend. La storia del Sito-47 è cifrata in
fase di build: aprire il codice o il bundle non rivela niente di ciò che è bloccato.

```bash
npm install
npm run dev            # cifra content/ e avvia http://localhost:3001
npm run build          # cifra content/, controlla i tipi, crea dist/
npm run preview        # serve dist/ sotto il percorso di base
npm run build:content  # solo la cifratura della storia
```

Richiede Node 22.18 o superiore. L'archivio SCP usa il modulo del sito principale
(`../src/services/scpApi.ts`), quindi il gioco va compilato dentro questo repository.

## Come si gioca

**Avvio → ordine di incarico → schermata di login → desktop.**

Al primo avvio un popup («Ordine di incarico», testo in `gioco.json` → `intro`) spiega chi
è il giocatore, dove si trova, cosa deve fare e qual è lo scopo. Si rilegge dal menu Start
o con il comando `incarico`.

La schermata di login mostra `ospite` e gli utenti di `content/gioco.json`. L'ospite
entra senza password; per gli altri serve la password trovata nei documenti. Dopo il
primo accesso riuscito il profilo resta sbloccato: la chiave derivata è salvata nel
browser. Il cambio di profilo si fa sempre da **Start → Cambia utente**, senza
ricaricare la pagina.

Un utente con `"nascosto": true` in `gioco.json` non compare nell'elenco finché non vi si
accede una volta, da «Altro utente…» (nome e password) o con `login` nel terminale.

**Salto nel tempo.** Il comando `salto 2026` (o Impostazioni → Aspetto del sistema)
passa al tema «Moderno»: angoli arrotondati, superfici traslucide, barra delle
applicazioni centrata e menu Start a griglia. Cambia solo l'aspetto: app, finestre e
storia restano le stesse. `salto 1999` torna al tema classico. La scelta vale per tutti
i profili ed è salvata nel browser (stili in `src/os/modern.css`).

Ogni profilo ha il suo desktop: finestre aperte, posizione e dimensioni, sfondo e
documenti recenti sono salvati nel browser per utente (`fondos:<gioco>:<utente>`).

| App | Cosa fa |
|---|---|
| **Esplora risorse** | Filesystem del gioco e archivio SCP. File sopra il proprio livello visibili con lucchetto; all'apertura compare «ACCESSO NEGATO». Non mostra i file nascosti e non apre i file cifrati. |
| **Visualizzatore documenti** | `.txt`/`.log` del gioco in stile fascicolo con la censura; documenti SCP in HTML con classe, livello, sezioni del fascicolo, autore, fonte e licenza. |
| **Visualizzatore immagini** | Allegati degli SCP, con didascalia e crediti. |
| **Posta** | Interfaccia grafica sulla casella dell'utente del desktop. |
| **Terminale** | Il gioco originale. Se ne possono aprire più di uno. |
| **Telecamere** | Videosorveglianza del sito disegnata in tempo reale, con comportamenti inquietanti (`content/telecamere/`). |
| **Radio** | Ricevitore a onde corte: si sintonizzano le frequenze di `content/radio/`. |
| **Fonoteca** | Catalogo delle voci usate da Eco, sbloccate leggendo i documenti (`content/fonoteca/`). |
| **Impostazioni** | Aspetto del sistema (Classico 1999 / Moderno 2026), sfondo, fosforo del terminale, suoni, cancellazione dei progressi, crediti. |
| **Cestino** | Scorciatoia per `/.cestino`, dove finiscono i documenti cancellati. |
| **Ordine di incarico** | Il briefing iniziale (menu Start). |
| **Linea interna 4** | Si apre da sola quando l'intruso scrive. |

**Il terminale vede di più.** Solo da lì si usano `ls -a` (file nascosti, il cui nome
inizia con `.`), `decrypt`, `search` e le frasi segrete dei finali. Il terminale parte
con l'utente del desktop; `login` dentro un terminale cambia utente **solo per quella
finestra**, come un `su`. `open <file>` apre un file nelle app grafiche, `exit` chiude
la finestra.

Comandi: `help`, `incarico`, `login`, `logout`, `whoami`, `ls [-a]`, `cd`, `pwd`, `cat`,
`stat`, `open`, `search`, `decrypt`, `ripara <file> <parità>`, `unisci <frammenti…>`,
`mail`, `rispondi <mail> [opzione]`, `rete`, `connetti <nodo>`, `radio [MHz]`, `voci`,
`telecamere`, `clear`, `audio on|off`, `tema verde|ambra`, `salto [2026|1999]`, `crediti`,
`reset`, `exit`. I nomi con spazi vanno tra virgolette (`cd "Serie I"`) oppure con
`\ `; il Tab li completa da solo.

Gli **eventi** della storia funzionano su tutto il desktop:

| Tipo | Sul desktop |
|---|---|
| `sistema` | notifica in alto a destra (con link alla Posta se riguarda un messaggio) |
| `intruso` | glitch e finestra «Linea interna 4» che si apre e scrive da sola |
| `glitch` | distorsione a tutto schermo e notifica |
| (ora reale) | eventi con `ora`/`giorno` controllati ogni 20 secondi |
| `finale` | schermata finale a tutto schermo, con «Continua» o «Ricomincia» |

Un evento scatta quando un account aperto, del desktop o di un terminale, ha il livello
richiesto.

## Easter egg «Il Narratore»

Omaggio ad Amico Diverte. L'app **Podcast** (`src/os/apps/web.ts`) usa l'embed ufficiale di
Spotify, caricato solo quando si apre l'app; il **Browser** ha una pagina dedicata
(`sito47://narratore`) con i suoi link veri, che si aprono in una nuova scheda.

## Voci registrate

Registrazioni generate con ElevenLabs (MP3 mono 64 kbps). Si collegano con
`audio: <file>.mp3` su radio, eventi e voci della fonoteca, e con `"audio"` in `intro`
(`gioco.json`).

- **Livello 0**: file pubblici in `public/audio/`.
- **Livello ≥ 1**: sorgenti in `content/audio/`; il build le cifra con la chiave del livello
  (AES-GCM) in `public/data/audio/<hash>.bin`. Il browser le scarica e decifra solo quando
  un account aperto ha quel livello.

Partono da sole solo con i suoni attivi; i pulsanti «Ascolta» funzionano sempre.

## Struttura

```
content/                 storia in chiaro: NON pubblicata
  gioco.json             titolo, segreto, livelli, utenti e password, boot, incarico, crediti, archivio
  fs/  posta/  eventi/   documenti (e immagini), email, eventi
  radio/ fonoteca/ telecamere/   stazioni radio, voci, telecamere
scripts/build-content.ts cifra content/ in public/data/archivio.json
src/
  engine/                logica di gioco
    crypto-core.ts       AES-GCM e PBKDF2 condivisi da build e browser
    game.ts              un "account": utente, portachiavi, lettura e censura
    session.ts           account del desktop e dei terminali, eventi, filesystem montati
    vfs.ts               interfaccia FileSystem comune e MountFS
    game-fs.ts           il filesystem della storia
    shell.ts terminal.ts events.ts state.ts audio.ts
  archivio/              adattatore SCP → filesystem
    scp-fs.ts            cartelle finte, livelli, cache, paginazione
    sections.ts          divisione in documento e sezioni, allegati, testo per il terminale
  os/                    FONDAZIONE OS
    boot.ts login.ts desktop.ts wm.ts profile.ts events.ts dialog.ts
    apps/                terminal, explorer, viewer, mail, cameras, radio, voices, settings, trash, intro
```

### Filesystem virtuale

Terminale ed Esplora risorse usano solo `MountFS`, che instrada i percorsi:
`/archivio-scp/…` va a `ScpFS`, tutto il resto a `GameFS`. Entrambi implementano:

```ts
interface FileSystem {
  stat(path, account): Promise<VNode | null>;
  list(path, account, page?): Promise<{ entries: VNode[]; total: number }>;
  read(path, account): Promise<ReadResult>;   // text | html (+ meta) | image | errore
  names(dir, account): string[];              // sincrono, per il Tab
}
```

`VNode` riporta tipo, livello, `hidden`, `encrypted`, `locked` con il motivo ed
eventuale etichetta (classe o `[CLASSIFICATO]`). Per aggiungere un'altra sorgente basta
implementare l'interfaccia e chiamare `session.fs.mount('/percorso', fs)`.

## Archivio SCP

`/archivio-scp` viene costruito al volo dagli stessi dati del sito principale, riusando
`fetchScpMetadata`, `fetchScpNicknames`, `fetchScpContent` e `prepareContent` di
`../src/services/scpApi.ts`, più classi e serie di `../src/lib/scp.ts`:

```
/archivio-scp/Serie I/SCP-173 - The Sculpture - The Original/
    documento.html          articolo principale
    <sezione>.html          un file per ogni blocco a scomparsa o scheda del wiki
    allegati/immagine-1.jpg immagini dell'articolo
```

- Si carica solo l'indice, in background dopo il login. Il contenuto di una serie si
  scarica alla prima apertura di un suo documento e resta in cache.
- Le cartelle con migliaia di fascicoli sono paginate (200 per pagina) in Esplora risorse.
- Se l'API non risponde compare «Connessione all'archivio centrale fallita» con
  «Riprova»; le sorgenti alternative sono quelle del sito principale.
- Nel terminale una cartella si può indicare anche solo con la designazione:
  `cd "/archivio-scp/Serie I/SCP-173"`.
- Ogni documento mostra autore, link alla pagina originale, nota CC BY-SA 3.0 e crediti
  delle immagini. Nel terminale `cat` mostra una versione testuale pulita.

In questa sezione i livelli sono una **regola di gioco**, non una protezione: i dati sono
pubblici sul wiki. La storia del Sito-47 invece resta cifrata.

Configurazione in `content/gioco.json`:

```json
"archivio": {
  "cartella": "/archivio-scp",
  "livelli": { "safe": 1, "neutralized": 1, "explained": 1, "decommissioned": 1,
               "euclid": 2, "keter": 3, "thaumiel": 4, "apollyon": 4, "archon": 4,
               "esoteric-class": 5, "*": 5 },
  "livello_sezioni": 1,
  "sopra_livello": "bloccati"
}
```

- `livelli`: livello richiesto per ogni tag di classe; `*` vale per le classi speciali o
  sconosciute. Classi non previste dal sito principale (es. `archon`) si riconoscono dal tag.
- `livello_sezioni`: livelli in più per le sezioni (addendum, registri…), al massimo 5.
- `sopra_livello`: `"bloccati"` mostra i fascicoli superiori con lucchetto, designazione e
  `[CLASSIFICATO]`; `"nascosti"` non li elenca affatto.

Rimuovendo `archivio` da `gioco.json` l'archivio non viene montato.

## Scrivere la storia

### Documenti

Crea un file `.md` sotto `content/fs/`. Il percorso nel gioco è quello del file senza
`.md`: `content/fs/archivio/rapporto.txt.md` diventa `/archivio/rapporto.txt`. I file in
`content/fs/home/<utente>/` sono privati di quell'utente. Un nome che inizia con `.` è
nascosto, quindi visibile solo con `ls -a`.

```markdown
---
livello: 2        # 0 = pubblico, 1–5 = serve quel livello
cifrato: sì       # facoltativo: serve anche `decrypt <file> <chiave>`
chiave: veglia    # obbligatoria con cifrato: sì
autore: p.vasari  # facoltativo: mostrato da `stat` e «Proprietà»
modificato: 03/03/2026 07:41
dopo_evento: finale-sigillo   # facoltativo: il file esiste solo dopo l'evento
corrotto: sì      # facoltativo: illeggibile finché non viene riparato con `ripara`
ripara: /percorso/del/file    # solo nei file «copia di parità»
---
# Titolo
Testo. > citazione   --- (riga separatrice)
```

Password, chiavi e comandi segreti non distinguono maiuscole e minuscole.

**Immagini.** Un `.png`/`.jpg` sotto `content/fs/` diventa un'immagine del gioco, cifrata
come i documenti. Per livello, metadati e didascalia aggiungi accanto un file con lo
stesso nome più `.md` (`chiamata-0214.jpg` + `chiamata-0214.jpg.md`): il testo è la didascalia.

**File corrotti.** Con `corrotto: sì` il testo appare alterato (in modo diverso a ogni
lettura) finché il giocatore non esegue `ripara <file> <parità>`, dove la copia di parità
è un altro file con `ripara: <percorso del file>`.

**Frammenti.** Un file che contiene `FRAMMENTO n/N: «parola»` viene letto dal comando
`unisci`, che ricompone le parole in ordine.

**Rete interna.** Le cartelle sotto `content/fs/rete/<nodo>/` sono i nodi elencati da
`rete`; `connetti <nodo>` ci entra e il prompt mostra il nome del nodo.

### Email

`content/posta/<utente>/<nome>.md`, ordinate per `data`:

```markdown
---
da: a.costa
oggetto: T-09 approvato
data: 2026-03-02 18:40
dopo_evento: e05-posta  # facoltativo: compare solo dopo quell'evento
risposta1: Sono qui.    # facoltativo: fino a 4 risposte possibili
risposta2: Non sei tu.
---
Testo.
```

Scegliere una risposta (pulsanti nella Posta o `rispondi <n> <opzione>`) registra il
segnale `risposta-<utente>-<mail>-<n>`, che gli eventi possono aspettare con
`dopo_evento`. Si risponde una sola volta per messaggio.

### Eventi

`content/eventi/<nome>.md`. Le condizioni si combinano in AND; `ritardo` sono i secondi
di attesa dopo che diventano vere.

```markdown
---
id: intruso-ferri
livello: 2
tipo: intruso            # sistema | intruso | glitch | finale
da: "???"
dopo_lettura: /archivio/ricerca/test-47.log
dopo_login: m.ferri
dopo_evento: altro-id
comando: sigilla nessuno ascolta   # frase da digitare nel terminale
ora: 03:00-03:10         # facoltativo: solo in quella fascia oraria reale
giorno: 03-03            # facoltativo: solo in quel giorno (MM-GG)
ritardo: 15
---
Testo del messaggio.
```

### Taccuino (obiettivi, aiuti e appunti)

```markdown
# content/taccuino/<nome>.md — un obiettivo
---
tipo: obiettivo
titolo: Entrare nel profilo di Giulia Rinaldi
livello: 0                    # cifrato con la chiave di questo livello
inizio_login: g.rinaldi       # facoltativo: inizio_lettura / inizio_login / inizio_evento
fine_login: m.ferri           # fine_lettura / fine_login / fine_evento ("a|b" = uno dei due)
---
## Aiuto 1
…
## Aiuto 2
…
## Aiuto 3
…  (mai la password scritta per intero: il controllo anti-spoiler la segnalerebbe)

# content/taccuino/<nome>.md — un appunto automatico
---
tipo: nota
livello: 1
dopo_lettura: /archivio/comunicazioni/centralino-0303.log
---
Testo dell'appunto.
```

L'obiettivo mostrato è il primo, in ordine di nome file, già iniziato e non ancora concluso
(`ultimo: sì` per uno senza fine). Gli aiuti si chiedono dall'app Taccuino o con `aiuto`.

### Pagine web (app Browser)

```markdown
# content/web/<cartella>/<nome>.md
---
indirizzo: intranet.sito47/turni   # senza https:// né www.
titolo: Turni e parole d'ordine
livello: 1                         # 403 sotto questo livello
segnalibro: Intranet del Sito-47   # facoltativo: compare nella pagina iniziale
nota: intranet.sito47 · …          # sottotitolo del segnalibro
dopo_evento: …                     # facoltativo
---
# Titolo
Testo con **grassetto**, *corsivo*, `codice`, [link](altro.indirizzo/pagina),
elenchi `- `, tabelle `| a | b |`, riquadri `> ` e censura [[L2: …]].
```

### Radio, fonoteca, telecamere

```markdown
# content/radio/<nome>.md
---
frequenza: 7.215         # MHz
livello: 0
nome: Frequenza morta
dopo_evento: …           # facoltativo
ora: 21:00-05:00         # facoltativo: in onda solo in questa fascia oraria
audio: file.mp3          # facoltativo, solo livello 0: registrazione in public/audio/
---
Testo trasmesso (censura supportata).

# content/fonoteca/<nome>.md
---
nome: Dr. Marco Ferri
livello: 2
dopo_lettura: /archivio/…   # oppure dopo_evento
---
Descrizione della voce.

# content/telecamere/<nome>.md
---
nome: CAM-E2 · Corridoio Ala Est
livello: 2
scena: corridoio         # corridoio | terminale | stanza | mensa | ingresso | camera4 | muro | studio
comportamento: avvicina  # avvicina | fermo | seduto | sedie | porta | telefono | segnale | muro | studio
dopo_evento: …           # facoltativo
---
Messaggi in sovrimpressione, uno per riga.
```

Comportamenti delle telecamere: `avvicina` (la figura in fondo è più vicina a ogni ritorno;
alla sesta volta raggiunge l'obiettivo), `fermo`, `seduto` (qualcuno al terminale, a volte
un secondo in piedi dietro: se lo guardi sparisce), `sedie` (si girano verso l'obiettivo),
`porta` (si apre da sola), `telefono`, `segnale` (nessun segnale, salvo qualche fotogramma),
`muro` (impronte di mani dall'interno), `studio` (ON AIR acceso, la sedia si gira verso il microfono). Tutti i testi sono cifrati come il resto.

### Censura progressiva

| Sintassi | Sotto il livello | Con il livello |
|---|---|---|
| `[[L3: testo]]` | `█████` della stessa lunghezza | `testo` |
| `[[L3!: testo]]` | `[DATI ELIMINATI]` | `testo` |

## Cifratura della storia

AES-GCM 256 e PBKDF2-SHA256 con la Web Crypto API, uguale in Node e nel browser
(`src/engine/crypto-core.ts`):

1. Ogni livello 1–5 ha una chiave stabile, derivata da `segreto` con HMAC.
2. I documenti di livello N sono cifrati con la chiave del livello N; le porzioni
   `[[LN: …]]` a parte, con la chiave del loro livello.
3. Per ogni utente la build cifra, con PBKDF2 della sua password, un portachiavi con le
   chiavi dei livelli fino al suo, i file della sua home e la sua posta.
4. I file `cifrato: sì` hanno un secondo strato con PBKDF2 della `chiave`.
5. Le frasi dei comandi segreti non sono nel bundle: solo un hash troncato e il testo
   cifrato con PBKDF2 della frase.

**Login dal desktop e dal terminale** usano lo stesso meccanismo: si deriva la chiave
dalla password e si decifra il portachiavi; se la decifratura fallisce la password è
sbagliata. Nel browser restano le chiavi derivate, non le password. Ogni terminale è un
account separato con il proprio portachiavi; le chiavi dei file decifrati e i progressi
sono condivisi.

**Controllo anti-spoiler:** la build fallisce se il segreto o sei parole consecutive di
testo riservato compaiono in chiaro nell'output.

> `content/` non viene pubblicato su Pages, ma in un repository pubblico è leggibile su
> GitHub, `SOLUZIONE.md` compresa. Prima del deploy cambia `segreto` in `gioco.json`.

## Deploy su GitHub Pages

Il `base` di Vite si imposta con `BASE_PATH` (predefinito `/scp/terminale/`; in
`npm run dev` è `/`). Il workflow `.github/workflows/deploy.yml` del repository compila
il sito principale, poi il gioco con `BASE_PATH=/<repo>/terminale/`, e lo copia in
`dist/terminale/`.

## Licenze

Il gioco è ambientato nell'universo della Fondazione SCP (SCP Wiki,
<https://scp-wiki.wikidot.com>, CC BY-SA 3.0): i testi originali del Sito-47
(`content/`) sono distribuiti con la stessa licenza. I documenti dell'archivio SCP
mostrano ciascuno autore, fonte, licenza e crediti delle immagini. Font VT323: SIL OFL 1.1.
