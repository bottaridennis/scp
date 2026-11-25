---
tipo: obiettivo
titolo: Recuperare le credenziali del Dr. Ferri
livello: 1
inizio_login: g.rinaldi
fine_login: m.ferri
---
## Aiuto 1
Leggi la posta di Giulia: Ferri le ha lasciato qualcosa prima del test.

## Aiuto 2
Il file di Ferri è nascosto nella home di Giulia: Esplora risorse non lo mostra, il Terminale sì (ls -a). La chiave è la parola d'ordine del turno di notte: cercala nel log del centralino.

## Aiuto 3
Apri /archivio/comunicazioni/centralino-0303.log e leggi la riga delle 01:28. Poi nel Terminale: ls -a, decrypt .ferri-credenziali.enc seguito da quella parola, e infine cat .ferri-credenziali.enc. Dentro trovi utente e password di Ferri.
