---
id: arc42-state-contract-v1
title: GraphEngineeringStateV1-sopimus
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 6
tags:
  - arc42
  - state
  - runtime-contract
---

# GraphEngineeringStateV1-sopimus

## Tarkoitus

Tämä tiedosto määrittää viiden Graph Engineering -Loopin rajatun jaetun project Staten. State koordinoi valitun releasen, work-issuen, deployn ja verificationin nykytilaa vakailla viitteillä. Markdown, `tk` ja SQLite säilyvät omien tietojensa kanonisina lähteinä.

## Tila

`GraphEngineeringStateV1` on accepted päätöksellä `adr-022`. Sama rakenteellinen alkuarvo on materialisoitu project-local GraphNodejen State-sopimukseen. Runtime routing facts ja `DecisionStateV1` ovat erillisiä: policy projisoi vain konfiguroidut bounded JSON Pointer -arvot tästä Statesta eikä kopioi tai patchaa Decision Statea tähän sopimukseen.

## Alkuarvo

<!-- arc42-state-initial:start -->
```json
{
  "contractVersion": "GraphEngineeringStateV1",
  "releaseMap": {
    "path": ".ballet/releases/STORY-RELEASE-MAP.md",
    "selectedReleaseId": null,
    "status": "unselected"
  },
  "work": {
    "releaseTicketId": null,
    "activeIssueId": null,
    "remainingIssueCount": 0
  },
  "deployment": {
    "targetEnvironment": null,
    "authorization": null,
    "evidenceRefs": []
  },
  "verification": {
    "status": "not_started",
    "result": null,
    "evidenceRefs": [],
    "openGapIds": []
  }
}
```
<!-- arc42-state-initial:end -->

## Kenttien omistajuus

| Alue | Omistava vaihe | Sallittu sisältö | Kielletty sisältö |
| --- | --- | --- | --- |
| `releaseMap` | PLAN, VERIFY | Kanonisen kartan polku, valittu stable release ID ja rajattu status. | Kartan sisältö, Storyjen tai taskien kopiot. |
| `work` | PLAN, BUILD, VERIFY | Release-epicin ID, enintään yksi aktiivinen work-issue ja jäljellä olevien issueiden lukumäärä. | Ticket-rungot, kuvaukset, kommentit tai riippuvuusgraafi. |
| `deployment` | DEPLOY | Target environment sekä täsmällinen ihmisvaltuutus- ja evidenssiviite. | Credentialit, lokit tai implisiittinen deploy-lupa. |
| `verification` | VERIFY | Rajattu tulos, evidence-viitteet ja avoimien gapien vakaat ID:t. | Testitulosteet, diffi tai kokonaiset design-osiot. |

DESIGN päivittää omat 12 kanonista arc42-osiotaan eikä kopioi niitä Stateen. PLAN valitsee releasen ja materialisoi work-storen. BUILD käsittelee yhtä aktiivista issueta invocationissa. DEPLOY kirjaa vain hyväksytyn kohteen, valtuutuksen ja evidenssiviitteet. VERIFY kirjaa rajatun tuloksen ja sulkee tai avaa työtä kanonisissa lähteissä.

## Patch-velvoitteet

- Valmistunut Job ja Validation PASS voivat ehdottaa vain schema-valideja `add`, `remove` ja `replace` -operaatioita nykyisen Noden omistamiin kenttiin. Validation FAIL ei voi patchata Statea.
- Patch ei korvaa koko Statea eikä kopioi dokumentteja, `tk`-issueita, diffejä, lokeja tai salaisuuksia.
- Runtime soveltaa patchin vain current revisioniin ja committoi uuden revisionin atomisesti outcome- ja control-flow-evidenssin kanssa.
- Agentti ei kirjoita RunBook-transitionia, DONEa, repair targetia, continuationia, permissionia tai network policya Stateen. Ne omistaa immutable Root Snapshot ja runtime.
- Ulkoisen deploy-kirjoituksen valtuutuksen on oltava käyttäjän täsmällinen ja jäljitettävä; puuttuva lupa pysäyttää tilaan `needs_input`.

## Runtime- ja tracker-raja

SQLite v11 omistaa runtime-, policy decision/observation- ja outbox-totuuden. `DecisionStateV1` johdetaan jokaisessa SSP decision epochissa snapshotatusta feature-määrittelystä, canonical runtime-faktoista, current State revisionista ja authorization-faktoista. `.tickets/orchestration` ja `.tickets/work` omistavat ticketit. `GraphEngineeringStateV1` säilyttää näihin vain bounded references -viitteet.

## Kanoniset lähteet

`adr-015` omistaa atomic State revision -semantiikan ja `adr-022` Graph-, tracker- ja tämän State-shapen. [Story/Release Map](../releases/STORY-RELEASE-MAP.md) omistaa releasejärjestyksen; `tk` work-store toteutustaskit; SQLite runtimehistorian; arc42 Markdown tavoitetilan.

## Relevantit päätökset

`adr-006`, `adr-011`, `adr-015`, `adr-022` ja `adr-026`.

## Evidenssi

`npm run validate:arc42` vertaa oletus-GraphNodejen initial valuea rakenteellisesti tämän tiedoston JSON-markeriin. Runtime-, State patch-, policy projection- ja tracker-testit todentavat omistajuusrajat; `EVID-016`, `EVID-018` ja `EVID-021` indeksoivat tulokset.

## Avoimet kysymykset

- Uusi kenttä tai sopimusversio vaatii toistuvan, mitatun koordinointivajeen. Kenttää ei lisätä agenttipreferenssin tai dokumentointityön sivuvaikutuksena.

## Seuraava katselmointiperuste

Katselmoi vain, jos pilotti osoittaa toistuvan evidenssipohjaisen coordination gapin, jota ei voi ilmaista nykyisillä bounded references -kentillä.
