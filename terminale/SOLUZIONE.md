# SOLUZIONE — Sito-47 · Terminale T-03

⚠ Spoiler completi. File escluso dalla build: serve per i test.

## Credenziali e chiavi

| Cosa                          | Valore              | Dove si trova                                              |
|-------------------------------|---------------------|------------------------------------------------------------|
| Password `g.rinaldi` (L1)     | `rinaldi214`        | `/manutenzione/nota-it.txt` (formula) + `/pubblico/rubrica-interni.txt` (interno 214) |
| Chiave `ferri-credenziali.enc`| `veglia`            | `/archivio/comunicazioni/centralino-0303.log` (L1)          |
| Password `m.ferri` (L2)       | `fondoscala`        | `/home/g.rinaldi/ferri-credenziali.enc` (decifrato)         |
| Password `a.costa` (L3)       | `saraceno1987`      | `/home/m.ferri/diario.txt` (regola) + `/archivio/verbali/verbale-trasferimento-1987.txt` (Monte Saraceno, 1987); `search saraceno` |
| Chiave `registro-personale.enc` | `ritorno`         | `/archivio/protocolli/protocollo-silenzio.txt`, punto 6, leggibile solo a livello 3 |
| Finale buono                  | `sigilla nessuno ascolta` | `/home/a.costa/registro-personale.enc`               |
| Finale cattivo                | `riapri 4471-vega`  | detto dall'intruso dopo la lettura del registro             |

## Percorso

```
cat LEGGIMI.txt
cat manutenzione/nota-it.txt          # password provvisoria = cognome + interno
cat pubblico/rubrica-interni.txt      # Rinaldi: interno 214
login g.rinaldi                        # password: rinaldi214
cat appunti.txt                        # il file di Ferri si apre con la parola del turno di notte
mail 2                                 # conferma: la chiave è la parola del turno
cat /archivio/comunicazioni/centralino-0303.log   # parola d'ordine VEGLIA
decrypt ferri-credenziali.enc veglia
cat ferri-credenziali.enc              # m.ferri / fondoscala
login m.ferri                          # password: fondoscala
cat diario.txt                         # password di Costa: nome della montagna + anno, senza "Monte"
search saraceno                        # oppure: cat /archivio/verbali/verbale-trasferimento-1987.txt
login a.costa                          # password: saraceno1987
cat promemoria.txt                     # chiave del registro = parola interdetta del Protocollo Silenzio
cat /archivio/protocolli/protocollo-silenzio.txt  # al livello 3 compare: RITORNO
decrypt registro-personale.enc ritorno
cat registro-personale.enc             # la verità e la frase del sigillo
# attendere il messaggio dell'intruso (circa 8 secondi), poi:
sigilla nessuno ascolta                # FINALE BUONO
```

Il finale cattivo si ottiene digitando `riapri 4471-vega` dopo la supplica
dell'intruso (evento `e08-supplica`).

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
