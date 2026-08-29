---
id: arc42-state-contract-v1
title: GraphEngineeringStateV1-sopimus
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 9
tags:
  - arc42
  - state
  - runtime-contract
---

# GraphEngineeringStateV1-sopimus

## Tarkoitus

Tämä tiedosto määrittää viiden Graph Engineering -Loopin rajatun jaetun project Staten. State koordinoi valitun releasen, work-issuen, deployn ja verificationin nykytilaa vakailla viitteillä. Markdown, `tk` ja SQLite säilyvät omien tietojensa kanonisina lähteinä.

## Tila

`GraphEngineeringStateV1` on accepted päätöksellä `adr-022` ja tarkennettu `adr-031`:ssä. Sama rakenteellinen alkuarvo on materialisoitu project-local Graphiin. Decision State, immutable authorization-snapshot ja acceptance-ledger ovat erillisiä: project State ei voi antaa actionille lupaa, muuttaa obligation-ID:tä/painoa tai patchata compiled policya.

Tämä sopimus kuvaa aktiivista v19-baselinea phase-09 cutoveriin asti. `goal-022` / `adr-034` -targetin **State** on eri käsite: Environmentin unique ascending `order` -arvon omistava execution unit, joka sisältää priority-ordered Actionit. Target-runtime ei käytä `GraphEngineeringStateV1`:tä compatibility readerina tai continuation-datana; exact target-semantics on [TARGET-CONTRACT](initiatives/environment-state-action-orchestration/TARGET-CONTRACT.md).

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
| `deployment` | DEPLOY | Target environment ja evidenssiviitteet. | Authorization-fakta, credentialit, lokit tai implisiittinen deploy-lupa. |
| `verification` | VERIFY | Rajattu tulos, evidence-viitteet ja avoimien gapien vakaat ID:t. | Testitulosteet, diffi tai kokonaiset design-osiot. |

DESIGN päivittää omat 12 kanonista arc42-osiotaan eikä kopioi niitä Stateen. PLAN valitsee releasen ja materialisoi work-storen. BUILD käsittelee yhtä aktiivista issueta invocationissa. DEPLOY kirjaa vain kohteen ja evidenssiviitteet; lupa tulee erillisestä immutable authorization-snapshotista. VERIFY kirjaa rajatun tuloksen ja sulkee tai avaa työtä kanonisissa lähteissä.

## Patch-velvoitteet

- Valmistunut Job ja Validation PASS voivat ehdottaa vain schema-valideja `add`, `remove` ja `replace` -operaatioita nykyisen Noden omistamiin kenttiin. Validation FAIL ei voi patchata Statea.
- Patch ei korvaa koko Statea eikä kopioi dokumentteja, `tk`-issueita, diffejä, lokeja tai salaisuuksia.
- Runtime soveltaa patchin vain current revisioniin ja committoi uuden revisionin atomisesti outcome- ja control-flow-evidenssin kanssa.
- Agentti ei kirjoita MDP-transitionia, DONEa, GraphNode-targetia, authorizationia, permissionia, acceptance-ledgeriä tai network policya Stateen. Ne omistaa immutable Root Snapshot ja runtime.
- Ulkoisen deploy-kirjoituksen valtuutuksen on oltava käyttäjän täsmällinen ja jäljitettävä; puuttuva lupa pysäyttää tilaan `needs_input`.

## Runtime- ja tracker-raja

SQLite v15 omistaa runtime-, scope-tagged policy decision/observation-, acceptance-ledger- ja outbox-totuuden. `DecisionStateV4` johdetaan jokaisessa global/local decision epochissa immutable scope-node-ID:stä, canonical runtime-faktoista, current State revisionista sekä erillisistä acceptance- ja authorization-snapshoteista. Acceptance-ledger ei kuulu Decision Stateen eikä GraphEngineeringStateen. `.tickets/orchestration` ja `.tickets/work` omistavat ticketit; State säilyttää niihin vain bounded references -viitteet.

## Kanoniset lähteet

`adr-015` omistaa atomic State revision -semantiikan ja `adr-022` Graph-, tracker- ja tämän State-shapen. [Story/Release Map](../releases/STORY-RELEASE-MAP.md) omistaa releasejärjestyksen; `tk` work-store toteutustaskit; SQLite runtimehistorian; arc42 Markdown tavoitetilan.

## Relevantit päätökset

`adr-006`, `adr-011`, `adr-015`, `adr-022`, aktiivisen baselineen `adr-033` sekä target-erotteluun `adr-034`.

## Evidenssi

`npm run validate:arc42` vertaa oletus-GraphNodejen initial valuea rakenteellisesti tämän tiedoston JSON-markeriin. Runtime-, State patch-, policy projection- ja tracker-testit todentavat omistajuusrajat; `EVID-016`, `EVID-018` ja `EVID-021` indeksoivat tulokset.

## Avoimet kysymykset

- Uusi kenttä tai sopimusversio vaatii toistuvan, mitatun koordinointivajeen. Kenttää ei lisätä agenttipreferenssin tai dokumentointityön sivuvaikutuksena.

## Seuraava katselmointiperuste

Katselmoi, jos aktiivisen v19:n coordination gap muuttuu tai phase-09 cutover poistaa tämän sopimuksen canonical pinnasta. Target-Statea ei lisätä tähän tiedostoon rinnakkaiseksi shape-versioksi.
