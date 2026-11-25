# SITO-47 · Terminale T-03

Gioco narrativo nel browser: un terminale della Fondazione SCP rimasto acceso in un
sito di contenimento abbandonato. Il giocatore legge archivi, email e log, trova
credenziali e chiavi, sale di livello e ricostruisce cos'è successo.

Vite + TypeScript, nessun framework, nessun backend. I contenuti sono cifrati in
fase di build: aprire il codice o il bundle non rivela niente di ciò che è bloccato.

```bash
npm install
npm run dev            # cifra content/ e avvia il server su http://localhost:3001
npm run build          # cifra content/, controlla i tipi, crea dist/
npm run preview        # serve dist/ sotto il percorso di base
npm run build:content  # solo la cifratura dei contenuti
```

In sviluppo ogni modifica a `content/` rigenera l'archivio e ricarica la pagina.
Richiede Node 22.18 o superiore: lo script di build è TypeScript eseguito direttamente da Node.

## Struttura

```
content/                 sorgenti in chiaro: NON vengono pubblicati
  gioco.json             titolo, segreto di build, livelli, utenti e password, boot, crediti
  fs/                    filesystem virtuale (percorso del file = percorso nel gioco)
    home/<utente>/       file privati, leggibili solo da quell'utente
  posta/<utente>/        email di ciascun utente
  eventi/                eventi scriptati
scripts/build-content.ts cifra content/ in public/data/archivio.json
src/engine/              motore generico (terminale, shell, crypto, eventi, audio, salvataggi)
src/main.ts              avvio e schermata di boot
SOLUZIONE.md             percorso completo per i test (non pubblicato)
```

Il motore non contiene testi della storia: per un nuovo capitolo basta aggiungere file
in `content/` e rilanciare la build.

## Aggiungere documenti

Crea un file `.md` sotto `content/fs/`. Il percorso nel gioco è quello del file senza
`.md`, quindi l'estensione mostrata al giocatore la scegli tu:

| File sorgente                                  | Nel gioco                         |
|------------------------------------------------|-----------------------------------|
| `content/fs/archivio/rapporto.txt.md`          | `/archivio/rapporto.txt`          |
| `content/fs/home/m.ferri/diario.txt.md`        | `/home/m.ferri/diario.txt`        |
| `content/fs/archivio/registro.log.md`          | `/archivio/registro.log`          |

Le cartelle si creano da sole. Il frontmatter è facoltativo:

```markdown
---
livello: 2        # 0 = pubblico, 1–5 = serve quel livello di accesso
cifrato: sì       # facoltativo: serve anche `decrypt <file> <chiave>`
chiave: veglia    # obbligatoria con cifrato: sì
---
# Titolo (diventa maiuscolo ed evidenziato)

Testo del documento.
> citazione (in grigio)
---               (riga separatrice)
```

Password, chiavi e comandi segreti non distinguono maiuscole e minuscole, e gli spazi
multipli contano come uno solo.

### Email

`content/posta/<utente>/<nome>.md`. I messaggi sono ordinati per `data`.

```markdown
---
da: a.costa
oggetto: T-09 approvato
data: 2026-03-02 18:40
a: m.ferri              # facoltativo, predefinito: il proprietario della casella
dopo_evento: e05-posta  # facoltativo: il messaggio compare solo dopo quell'evento
livello: 0              # facoltativo
---
Testo.
```

### Utenti

In `content/gioco.json`, campo `utenti`:

```json
{ "nome": "m.ferri", "nome_completo": "Dr. Marco Ferri", "ruolo": "Ricercatore",
  "livello": 2, "password": "fondoscala" }
```

L'utente `ospite` (livello 0) è implicito: è la sessione iniziale.

### Eventi

`content/eventi/<nome>.md`. Le condizioni si combinano in AND. `ritardo` sono i
secondi di attesa dopo che le condizioni diventano vere; senza condizioni, i secondi
dal caricamento della pagina.

```markdown
---
id: intruso-ferri
livello: 2               # il testo è cifrato con la chiave di quel livello
tipo: intruso            # sistema | intruso | glitch | finale
da: "???"                # mittente mostrato (solo per intruso)
dopo_lettura: /archivio/ricerca/test-47.log
dopo_login: m.ferri
dopo_evento: altro-id
comando: sigilla nessuno ascolta   # frase che il giocatore deve digitare
ritardo: 15
---
Testo del messaggio.
```

- **sistema**: avviso `[SISTEMA]` in rosso.
- **intruso**: glitch, intestazione "connessione in ingresso", testo lento.
- **glitch**: distorsione dello schermo, testo facoltativo.
- **finale**: chiude la partita e mostra il riepilogo.

Un evento con `comando` scatta quando il giocatore digita esattamente quella frase.
La frase non viene salvata nel bundle: c'è solo un hash e il testo dell'evento è
cifrato con una chiave derivata dalla frase stessa. Un evento scatta solo se il
giocatore ha il livello indicato.

## Censura progressiva

Dentro qualunque documento, email o evento:

| Sintassi              | Sotto il livello richiesto       | Con il livello |
|-----------------------|----------------------------------|----------------|
| `[[L3: testo]]`       | `█████` della stessa lunghezza   | `testo`        |
| `[[L3!: testo]]`      | `[DATI ELIMINATI]`               | `testo`        |

Ogni porzione è cifrata a parte con la chiave del suo livello, anche dentro un
documento pubblico. Le porzioni non si possono annidare.

## Come funziona la cifratura

Tutto usa AES-GCM a 256 bit e PBKDF2-SHA256 (`iterazioni` in `gioco.json`), con la
Web Crypto API sia nello script di build (Node) sia nel browser: il codice condiviso
è in `src/engine/crypto-core.ts`.

1. **Chiavi di livello.** Per ogni livello 1–5 la build deriva una chiave da
   `segreto` (HMAC-SHA256). Le chiavi restano stabili tra una build e l'altra, così i
   progressi salvati continuano a funzionare. Cambiando `segreto` si invalidano.
2. **Documenti di livello N** sono cifrati con la chiave del livello N. Le porzioni
   `[[LN: …]]` sono cifrate a parte con la chiave del loro livello.
3. **Portachiavi utente.** Per ogni utente la build cifra, con una chiave derivata via
   PBKDF2 dalla sua password, un pacchetto con le chiavi dei livelli fino al suo, i
   file della sua home e la sua posta. Il login riesce se la decifratura riesce: nel
   bundle non c'è nessuna password.
4. **File cifrati** (`cifrato: sì`) hanno un secondo strato, con chiave PBKDF2 della
   `chiave` da trovare nel gioco.
5. **Comandi segreti** degli eventi: il testo è cifrato con una chiave PBKDF2 della
   frase. Nel manifest resta solo un hash troncato, usato come filtro rapido.

Nel browser le chiavi derivate (non le password) restano in `localStorage`, così il
giocatore non deve reinserirle. `reset` cancella tutto.

Restano visibili in chiaro solo i documenti di livello 0, i nomi dei file con il loro
livello, i nomi utente, le condizioni degli eventi e i testi di boot e crediti.

**Controllo anti-spoiler.** A fine build lo script verifica che il segreto e qualunque
sequenza di 6 parole di testo riservato non compaiano in chiaro nell'output: in quel
caso la build fallisce. Se una password o una chiave compare in un documento pubblico
riceverai solo un avviso, perché può essere voluto.

> **Attenzione:** `content/` non viene pubblicato su Pages, ma se il repository è
> pubblico chiunque può leggerlo su GitHub, `SOLUZIONE.md` compresa. Per evitare
> spoiler tieni i contenuti in un repository privato, o rendi privato questo, e
> pubblica solo `dist/`.

## Deploy su GitHub Pages

Il sito viene servito sotto un sottopercorso. Il `base` di Vite si imposta con
`BASE_PATH` (predefinito `/scp/terminale/`; in `npm run dev` è sempre `/`):

```bash
BASE_PATH=/nome-repo/ npm run build
```

**In questo repository** il workflow `.github/workflows/deploy.yml` compila il gioco e
lo copia in `dist/terminale/` del sito principale: viene pubblicato sotto
`<dominio>/scp/terminale/`.

**In un repository dedicato** usa un workflow come questo (Settings → Pages → Source:
GitHub Actions):

```yaml
name: Deploy
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
        env: { BASE_PATH: "/${{ github.event.repository.name }}/" }
      - uses: actions/upload-pages-artifact@v3
        with: { path: ./dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.d.outputs.page_url }}" }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
```

Prima di pubblicare cambia `segreto` in `content/gioco.json`.

## Comandi del gioco

`help`, `login <utente>`, `logout`, `whoami`, `ls`, `cd`, `pwd`, `cat <file>`,
`search <parola>`, `decrypt <file> <chiave>`, `mail [n]`, `clear`, `audio on|off`,
`tema verde|ambra`, `crediti`, `reset`.

Tab completa comandi, file e utenti. ↑ e ↓ scorrono la cronologia. Un tasto qualsiasi,
o un tocco sullo schermo, salta l'effetto macchina da scrivere. Su schermi touch
compare una barra con Tab, ↑, ↓ e Salta.

## Licenza dei contenuti

Il gioco è ambientato nell'universo della Fondazione SCP (SCP Wiki,
<https://scp-wiki.wikidot.com>), distribuito con licenza
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Il Sito-47,
l'anomalia PROV-47 e i personaggi sono originali, ma come opera derivata
dell'universo SCP anche i testi del gioco (`content/`) sono distribuiti con licenza
CC BY-SA 3.0, con l'attribuzione mostrata dal comando `crediti`. Il font VT323 è
distribuito con licenza SIL Open Font License 1.1.
