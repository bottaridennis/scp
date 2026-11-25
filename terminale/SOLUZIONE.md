# SOLUZIONE — Sito-47 · Terminale T-03

⚠ Spoiler completi. File escluso dalla build: serve per i test.

## Su FONDAZIONE OS

- I profili si cambiano da **Start → Cambia utente**: la schermata di login chiede la
  password (una volta sola: poi il profilo resta sbloccato). Dal Terminale `login`
  cambia utente solo in quella finestra.
- Esplora risorse non mostra i file nascosti (`.nome`) e non apre i file cifrati:
  `ls -a`, `decrypt`, `search` e le frasi dei finali si usano dal **Terminale**.
- Gli eventi compaiono sul desktop: notifiche, la finestra «Linea interna 4» che si apre
  da sola, glitch a tutto schermo, il finale a schermo intero.
- Il percorso qui sotto funziona tutto da un unico terminale (con `login`), oppure
  cambiando profilo dalla schermata di login e aprendo un terminale per ciascuno.

## Credenziali e chiavi

| Cosa                          | Valore              | Dove si trova                                              |
|-------------------------------|---------------------|------------------------------------------------------------|
| Password `g.rinaldi` (L1)     | `rinaldi214`        | `/manutenzione/nota-it.txt` (formula) + `/pubblico/rubrica-interni.txt` (interno 214) |
| Chiave `.ferri-credenziali.enc`| `veglia`            | `/archivio/comunicazioni/centralino-0303.log` (L1)          |
| Password `m.ferri` (L2)       | `fondoscala`        | `/home/g.rinaldi/.ferri-credenziali.enc` (decifrato)         |
| Password `a.costa` (L3)       | `saraceno1987`      | `/home/m.ferri/diario.txt` (regola) + `/archivio/verbali/verbale-trasferimento-1987.txt` (Monte Saraceno, 1987); `search saraceno` |
| Chiave `.registro-personale.enc` | `ritorno`         | `/archivio/protocolli/protocollo-silenzio.txt`, punto 6, leggibile solo a livello 3 |
| Finale buono                  | `sigilla nessuno ascolta` | `/home/a.costa/.registro-personale.enc`               |
| Finale cattivo                | `riapri 4471-vega`  | detto dall'intruso dopo la lettura del registro             |
| Chiave `.pagina-strappata.enc` (Ferri) | `creditore` | scritta nello spettrogramma `/archivio/ricerca/analisi/chiamata-0214.jpg` (L2) |
| Password `b.leone` (L2)       | `davide2019`        | `/.cestino/ir-47-0303-bozza-leone.txt` (L2): «il nome di Davide e l'anno in cui l'ho perso» |
| Password `d.marino` (L1)      | `libeccio`          | `/home/b.leone/indagine-marino.txt` (nome della barca) |
| Password `d-4719` (L1, profilo nascosto) | `ascoltami` | `/.registro-accessi.log`, riga [L3] |
| Password `p.vasari` (L4, profilo nascosto) | `cenere47` | `/home/a.costa/per-chi-resta.txt`, compare solo dopo il finale buono |

## Percorso

```
cat LEGGIMI.txt                       # (si apre da solo al primo accesso come ospite)
ls -a                                 # .registro-accessi.log: file nascosto, facoltativo
cat manutenzione/nota-it.txt          # password provvisoria = cognome + interno
cat pubblico/rubrica-interni.txt      # Rinaldi: interno 214
login g.rinaldi                        # password: rinaldi214
cat appunti.txt                        # il file di Ferri è nascosto e si apre con la parola del turno
ls -a                                  # .ferri-credenziali.enc
mail 2                                 # conferma: la chiave è la parola del turno
cat /archivio/comunicazioni/centralino-0303.log   # parola d'ordine VEGLIA
decrypt .ferri-credenziali.enc veglia
cat .ferri-credenziali.enc              # m.ferri / fondoscala
login m.ferri                          # password: fondoscala
cat diario.txt                         # password di Costa: nome della montagna + anno, senza "Monte"
search saraceno                        # oppure: cat /archivio/verbali/verbale-trasferimento-1987.txt
login a.costa                          # password: saraceno1987
cat promemoria.txt                     # chiave del registro = parola interdetta; il file è nascosto (ls -a)
cat /archivio/protocolli/protocollo-silenzio.txt  # al livello 3 compare: RITORNO
decrypt .registro-personale.enc ritorno
cat .registro-personale.enc             # la verità e la frase del sigillo
# attendere il messaggio dell'intruso (circa 8 secondi), poi:
sigilla nessuno ascolta                # FINALE BUONO
```

Il finale cattivo si ottiene digitando `riapri 4471-vega` dopo la supplica
dell'intruso (evento `e08-supplica`).

## Segreti secondari

Facoltativi, non servono per i finali.

| Segreto | Come si scopre |
|---|---|
| **Contrabbando delle bobine** — Ferri e Marino vendevano bobine originali di Monte Saraceno allo «Studio Acustico Meridiana»; T-09 serviva a Ferri per la «registrazione completa» che gli avrebbe saldato un debito di 40.000 € | L1: `/archivio/logistica/inventario-camera4.txt` (bobine 4→1) e `spedizioni-febbraio.log` (3 pacchi da 0,9 kg). L2: diario di Ferri → spettrogramma (`CREDITORE`) → `decrypt .pagina-strappata.enc creditore`. Account `d.marino`: `ricevute.txt`, `.contatto-meridiana.txt`, posta |
| **Leone ha parlato con Eco** — alle 02:40 ha chiamato lui l'interno 4 per risentire il fratello morto, e gli ha insegnato procedure e codici; Vasari gli ha fatto riscrivere il rapporto | centralino (riga 02:40, dettaglio a L2), `stat` del rapporto preliminare (autore `p.vasari`), bozza nel **Cestino**, telecamere 02:38, account `b.leone` (posta di Vasari e di «d.leone») |
| **La parola l'ha detta Costa** — T-03 fu eseguito da lei, per sentire la voce del padre; poi ha corretto il registro attribuendolo a «D-4719» | `ls -a /archivio/ricerca` → `.test-47.log.bak` (la parola si legge a L3); `stat test-47.log` (modificato da a.costa alle 23:52); mail del Comitato Etico a Costa; `per-chi-resta.txt` |
| **Giulia è rientrata** — era nel sito alle 03:52–04:20, ha chiamato Costa alle 04:02 e ha mentito sulla malattia | `/archivio/sicurezza/telecamere-0303.log` (L2), `ls -a` nella home di Rinaldi → `.bozza-per-anna.txt` |
| **D-4719 non esiste** — il nome inventato da Costa è diventato un account di Eco | `/.registro-accessi.log` a L3 → «Altro utente…» al login (o `login d-4719`) → `chi-mi-ascolta.txt`, `voci.txt` |
| **Comitato Etico insabbiato** — i D-class ascoltatori non erano informati; Vasari ha archiviato su ordine O5 | mail CE-47-002 a Costa (esito a L4), `/home/p.vasari/archiviazione-comitato.txt` |
| **Epilogo: il Sito-47 è un'esca** — il Consiglio O5 voleva riaprire il ponte verso un'organizzazione ostile; il finale «cattivo» avrebbe servito i suoi piani | dopo il finale buono: `per-chi-resta.txt` → `p.vasari` (L4) → `/archivio/direzione/rapporto-o5.txt`, `per-anna.txt`. Il livello 4 sblocca anche Thaumiel e Apollyon nell'archivio SCP; `eco-origine.wav.txt` (L5) resta chiuso |

Altro: **Cestino** sul desktop (`/.cestino`), **Proprietà** in Esplora risorse e `stat` nel
terminale mostrano autore e ultima modifica; i profili `d-4719` e `p.vasari` non compaiono
al login finché non vi si accede una volta da «Altro utente…».

## Eventi

| Evento                 | Quando                                         | Livello |
|------------------------|------------------------------------------------|---------|
| `e01-linea4`           | 75 s dopo il caricamento                       | 0       |
| `e02-intruso-rinaldi`  | 25 s dopo il login di g.rinaldi                | 1       |
| `e03-glitch-centralino`| 3 s dopo aver letto il registro del centralino | 1       |
| `e04-intruso-ferri`    | 20 s dopo il login di m.ferri                  | 2       |
| `e05-posta-ferri`      | 10 s dopo aver letto `test-47.log`; sblocca una nuova mail di m.ferri | 2 |
| `e06-glitch-scheda`    | 2 s dopo aver letto la scheda PROV-47          | 2       |
| `e07-intruso-costa`    | 15 s dopo il login di a.costa                  | 3       |
| `e08-supplica`         | 8 s dopo aver letto il registro di Costa       | 3       |
| `e09-glitch-backup`    | 3 s dopo `.test-47.log.bak`                    | 2       |
| `e10-intruso-leone`    | 18 s dopo il login di b.leone                  | 2       |
| `e11-intruso-fantasma` | 6 s dopo il login di d-4719                    | 1       |
| `e12-glitch-pagina`    | 2 s dopo `.pagina-strappata.enc`               | 2       |
| `finale-sigillo`       | comando `sigilla nessuno ascolta` dopo il registro | 3   |
| `finale-ponte`         | comando `riapri 4471-vega` dopo la supplica    | 3       |

## La storia, in breve

Nel 1987 la Fondazione recupera da una stazione di ascolto su Monte Saraceno un
registratore che continua a riprodurre le voci dei tre operatori scomparsi. Al
Sito-47 il fenomeno, PROV-47 «Eco», viene contenuto in Camera 4 con il Protocollo
SILENZIO: Eco memorizza ciò che sente e risponde con le voci di chi ha parlato, e ha
bisogno di essere ascoltato per esistere.

Il 3 marzo 2026 il Dr. Ferri, per il test T-09, usa la parola d'ordine del turno di
notte per collegare la linea di Camera 4 alla rete dati. La linea è bidirezionale ed
Eco passa nella rete: scrive email con le firme del personale, chiama tutti i
telefoni, attira Ferri in Camera 4, dove muore. Il direttore Vasari attiva il
Protocollo CENERE e isola la rete.

La Dr.ssa Costa capisce che isolarlo non basta: senza ascoltatori Eco dorme, ma non
muore. Il sigillo che azzera la rete funziona solo mentre Eco sta parlando con
qualcuno. Lascia T-03 acceso in modalità ospite e dissemina l'archivio di indizi,
perché chi arriva dopo salga fino al suo livello e, leggendo, attiri Eco allo
scoperto. Eco, con la voce di Costa, cerca di convincere il giocatore a riaprire il
ponte di rete con il codice che ha imparato da lei.
