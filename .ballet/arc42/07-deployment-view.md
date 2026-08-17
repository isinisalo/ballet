---
id: arc42-section-07
title: Käyttöönottonäkymä
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-17'
version: 2
tags:
  - arc42
  - deployment
arc42Section: 7
---

# 7. Käyttöönottonäkymä

## Tarkoitus

Tämä osio kuvaa turvallisuuden, eristyksen, palautumisen ja jakelun kannalta merkittävät tekniset ympäristöt sekä rakennusosien sijoittumisen niihin. Nykyinen deployment-yksikkö on yksi macOS-kone ja yksi täsmällinen Git-checkout.

## Tila

DEP-001 ja DEP-002 ovat toteutettua paikallista deploymentia. DEP-003:n paketointi- ja smoke-polku on toteutettu, mutta yksittäisen ulkoisen julkaisun evidenssi syntyy vasta erikseen valtuutetussa release-ajossa.

## Topologia

```mermaid
flowchart TB
  user["Paikallinen käyttäjä"] --> browser["Browser / React SPA"]
  subgraph mac["macOS host"]
    browser <-->|"127.0.0.1 HTTP JSON/SSE"| service["Checkout-kohtainen Node/Express process"]
    launchd["launchd + Ballet CLI"] -->|"lifecycle"| service
    subgraph checkout["Git checkout"]
      project["Versionhallittu project truth"]
      db[".git/ballet/state.sqlite"]
      runs[".git/ballet/worktrees/<root-run-id>"]
    end
    service <-->|"read"| project
    service <-->|"transactions"| db
    service <-->|"branch/worktree"| runs
    service --> lane1["Codex FIFO lane"]
    service --> lane2["Copilot FIFO lane"]
  end
  lane1 --> codex["Codex app-server process"]
  lane2 --> copilot["Copilot SDK/CLI process"]
  release["Valtuutettu release pipeline"] -.->|"verified macOS arm64/x64 bundle"| launchd
```

## Deployment-yksiköt

| ID | Ympäristö ja mapping | Rajapinnat | Laatu- ja riskimerkitys |
| --- | --- | --- | --- |
| DEP-001 | Yksi macOS Git-checkout hostaa yhden loopback Ballet Node -prosessin, React-assetit ja `.git/ballet/state.sqlite`-kannan; launchd ylläpitää lifecyclea. BB-001 palvellaan BB-002:n kautta, BB-003/BB-008 luetaan checkoutista ja BB-004–BB-006 käyttävät samaa paikallista runtimea. | Browser `127.0.0.1`, paikallinen tiedostojärjestelmä, SQLite ja provider-prosessit. | Checkout-eristys ja yksinkertainen operointi; ei remote control planea tai HA-failoveria. |
| DEP-002 | Jokainen Root Run käyttää omaa `.git/ballet/worktrees/<root-run-id>`-hakemistoa ja Run-branchia; canonical runtime-faktat pysyvät checkoutin SQLite-kannassa. | Git worktree, provider task `cwd`, runtime-storet ja Run API. | Active checkout -suoja, attributable output ja restart-safe-faktat; stale worktree jää diagnosoitavaksi. |
| DEP-003 | Release bundle sisältää paketoidun Noden, compiled backend/CLI:n, frontendin ja native-riippuvuudet macOS arm64/x64:lle; verification/attestation tapahtuu ennen aktivointia. | GitHub release/attestation ja mahdollinen Homebrew vain valtuutuksen jälkeen. | Supply-chain integrity ja rollback-mahdollisuus; ulkoiset palvelut ja kirjoitus vaativat ihmisvaltuutuksen. |

## Tiedosto- ja prosessisijoittelu

| Kohde | Omistajuus | Säilyvyys | Huomio |
| --- | --- | --- | --- |
| Checkoutin tracked files | Projektin omistaja ja Git | Versionhallittu | Goals, ADR:t, arc42, project config, instructionit, skillit, source ja design. |
| `.git/ballet/state.sqlite` | Ballet runtime | Machine-local, restartien yli | DB schema/migration on startup-raja; tiedostoa ei commitata. |
| `.git/ballet/worktrees/<root-run-id>` | Root Run | Säilyy tarkastusta/valtuutettua integraatiota varten | Providerin `cwd`; active checkout ei ole työalue. |
| Node/Express process | launchd / CLI | Prosessikohtainen | Bindaa vain loopbackiin ja tunnistaa checkoutin. |
| Provider child process/session | BB-006 adapteri | Tehtävä-/sessio-kohtainen | Provider credentials ja protocol ovat adapterirajan ulkopuolisia; normalized outcome palaa runtimeen. |
| Release bundle | Release-operaattori | Artefakti- ja provenance-politiikan mukainen | Ei synny tai aktivoidu oletus-Root Runissa. |

## Käynnistys ja palautuminen

1. CLI/launchd ratkaisee checkoutin ja avaa sen runtime-tietokannan.
2. `LocalDatabase` soveltaa vain tunnetut skeemamigraatiot; tuntematon/epäonnistunut versio estää palvelun normaalin käynnistyksen.
3. Queue- ja Root Run -reconciliation lukevat commitoidut faktat RT-009:n mukaisesti.
4. React UI hakee tuoreen canonical read modelin; selainmuisti ei ole recovery-lähde.
5. Stale worktree tai interrupted provider-tehtävä näytetään diagnosoitavana eikä niitä siivota tai replayata hiljaisesti.

## Turvallisuus- ja verkkomapping

- Browser–service-liikenne pysyy `127.0.0.1`:ssä ja Origin-politiikan piirissä.
- Network-oikeus kuuluu yksittäiseen `ExecutionProfile`:en; palvelun paikallisuus ei itsessään valtuuta providerin verkkokäyttöä.
- Provider saa Run-worktreen `cwd`:ksi ja eksplisiittisen task payloadin.
- GitHub/Homebrew/CI/CD ovat DEP-003:n ulkoisia trust boundaryja; testin läpäisy ei valtuuta kirjoitusta niihin.
- Loop module -tiedosto tulee selaimen content-inputina tai versionhallittuna library data -lähteenä, ei backendin mielivaltaisena polkuna tai live registry -riippuvuutena.

## Kapasiteetti ja operointi

Arkkitehtuuri optimoi paikallista determinismiä, ei horisontaalista skaalausta. Provider-kohtaiset FIFO-kaistat rajaavat samanaikaisuutta. SQLite ja checkout-identiteetti tekevät yhdestä checkoutista consistency boundaryn. Usean checkoutin käyttö tarkoittaa useita erillisiä prosessi-/tietokanta-/worktree-kokonaisuuksia.

## Kanoniset lähteet

`README.md`, ADR-001, ADR-006, ADR-007 ja ADR-009 sekä `backend/cli/`, `backend/execution/git/`, `backend/storage/`, `scripts/` ja `packaging/`.

## Relevantit päätökset

`adr-001`, `adr-006`, `adr-007`, `adr-008`, `adr-009` ja `adr-011`.

## Evidenssi

Lifecycle-, checkout identity-, worktree-, SQLite-, recovery- ja packaged smoke -testit tuottavat paikallisen evidenssin. Tässä dokumentaatiotyössä ei väitetä uutta release publication -evidenssiä.

## Avoimet kysymykset

- Production hosting, non-macOS deployment, remote control plane tai jaettu runtime store eivät ole hyväksyttyjä.
- Operatiivisen backup/restore-politiikan tarve arvioidaan ennen tuotantokäyttöä; nykyinen recovery kattaa prosessirestartin, ei koneen menetystä.

## Seuraava katselmointiperuste

Katselmoi osio, kun tuettu OS, prosessitopologia, runtime-store, provider-prosessi tai release distribution -polku muuttuu.
