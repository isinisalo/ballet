---
id: adr-007
title: SQLite-pohjainen kestävä suoritus- ja ajastustila
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - sqlite
  - kestävä-tila
version: 1
---

# SQLite-pohjainen kestävä suoritus- ja ajastustila

## Konteksti

Balletin jonot, Runit, ihmisen vastausta odottavat Stepit, tapahtumat, finalisointi ja ajastukset eivät saa riippua yhden Node-prosessin muistista. Samalla tilan pitää pysyä yksittäisen checkoutin paikallisena eikä se tarvitse erillistä tietokantapalvelua.

## Päätös

Checkout-kohtainen ajonaikainen tila tallennetaan `better-sqlite3`-kirjastolla tiedostoon `.git/ballet/state.sqlite`.

- Tietokanta käyttää WAL-journalointia, `synchronous = FULL` -asetusta, foreign key -rajoitteita ja viiden sekunnin busy timeoutia.
- Skeema on eksplisiittisesti versioitu. Tuntematonta tai versioimatonta olemassa olevaa skeemaa ei muuteta hiljaisesti.
- `root_runs`, `loop_runs`, `step_runs`, `execution_tasks`, `execution_events` ja `loop_schedule_state` muodostavat kanonisen tallennetun tilan.
- ExecutionTaskin spesifikaatio on luonnin jälkeen muuttumaton ja suojataan tietokantatriggerillä.
- Yhdellä Loopilla saa olla vain yksi aktiivinen Run, ja samaa ajastettua esiintymää ei saa käynnistää kahdesti.
- Palveluntarjoajajono luetaan tallennetuista `queued`-tehtävistä FIFO-järjestyksessä.
- Odottamattoman katkoksen jälkeen tietokantaan jääneet `queued`-tehtävät jatkavat palvelun seuraavassa käynnistyksessä. `running`-tehtävät merkitään keskeytyneinä epäonnistuneiksi eikä niitä ajeta uudelleen.
- Ajastin säilyttää määritelmän hashin, seuraavan suoritusajan, viimeisimmän esiintymän ja tilan `started`, `skipped` tai `missed`.
- ExecutionEventit luetaan kasvavalla kohdistimella. Ei-terminaalista sisältöä säilytetään enintään yksi mebitavu tehtävää kohti, ja katkaisu merkitään näkyväksi tilaksi.

## Seuraukset

- Ihmisen vastausta odottava Run säilyy prosessin elinkaaren yli. Odottamattoman katkoksen jälkeen palvelu voi lisäksi jatkaa turvallisesti tietokantaan säilynyttä jonotettua työtä.
- Hallittu sammutus peruuttaa jonossa olevat ja käynnissä olevat tehtävät.
- Kesken ollut palveluntarjoajaprosessi ei aiheuta hiljaista kaksinkertaista suoritusta.
- Run-orkestrointi voi tehdä toisiinsa liittyvät tilamuutokset SQLite-transaktioissa.
- Ajastuksen pitkä katkos kirjataan `missed`-tilana sen sijaan, että kaikki menneet esiintymät käynnistettäisiin jälkikäteen.
- Paikallinen tietokanta on yhden kloonin historia; sitä ei synkronoida muiden checkoutien kanssa.
- Skeemamuutos edellyttää tietoista versiopäätöstä ja yhteensopivuusratkaisua.

## Toteutuksen lähteet

- `backend/storage/LocalDatabase.ts`
- `backend/execution/ExecutionStore.ts`
- `backend/runs/RootRunStore.ts`
- `backend/runtime-db.ts`
- `backend/scheduling/LoopScheduler.ts`
