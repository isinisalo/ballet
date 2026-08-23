---
id: adr-029
title: Graph ja GraphNode authoroidaan capability-first-korttinäkymissä
status: accepted
createdAt: '2026-08-23T00:00:00.000Z'
updatedAt: '2026-08-23T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - ui
  - authoring
version: 2
---

# Graph ja GraphNode authoroidaan capability-first-korttinäkymissä

> `adr-031` supersedoi local Decision Model & Repair -osion. Capability-first-kortit, Graph-tason Decision Model ja protected Action Node flow säilyvät.

## Konteksti

ADR-023/024:n Graph- ja GraphNode-tason planet/multi-ring-projektiot korostavat routing-jäsenyyttä mutta eivät vastaa käyttäjän ensisijaiseen kysymykseen “mitä järjestelmä voi tehdä”. Outcome-aware hierarchical policy tarvitsee lisäksi selkeät scoped Decision Model -editorit. Planet-canvasin modaalieditori ei skaalaudu state-, guard-, transition-, cost- ja compile-evidenssin authorointiin.

ADR-025 ja ADR-027 omistavat erillisen Job Node industrial flow'n. Niitä ei supersedoida.

## Päätösajurit

- `goal-007`, `goal-018`, `REQ-007`, `REQ-018` ja `QS-024`.
- Capability-, intrinsic outcome-, permission- ja readiness-tiedon skannattavuus.
- URL-omistajuus, keyboard/focus, desktop/narrow ja pitkät ID:t.
- Sama Cyber-industrial design system kuin Execution Profiles- ja Skills-näkymissä.
- Ei UI:n control statea tai uutta runtime-semanttiikkaa.

## Ehdotettu päätös

### Graph Engineering

Upper-level canvas korvataan responsiivisella korttityötilalla, jonka URL-osio on:

- `?section=capabilities`: `Capability Graph`, GraphNode-kortit ja CRUD;
- `?section=decision-model`: global Capability/Decision Model, guards, outcome-aware transitionit, costit, terminalit, solver, Repair ja compile-readiness.

Kortti näyttää exact ID:n, kuvauksen, accepts/provides-sopimukset, intrinsic outcomet ja readinessin. Modal Decision Model -editoria tai upper-level appearance/artwork-dataa ei säilytetä.

### Graph Node

Graph Node käyttää kahta URL-omisteista osiota:

- `?section=jobs`: JobNode-kortit, intrinsic outcomet, capabilityt, readiness ja CRUD;
- `?section=local-decision-model`: local Decision Model & Repair JobNode-actioneille.

JobNode-ID:n rename päivittää local model -viitteet atomisesti. Poisto estetään, kun viitteitä jää, ja UI nimeää korjattavat kohdat.

### Job Node ja Run

Job Node säilyttää ADR-025/027:n deterministic industrial flow'n, Work/Validation-editorit, artworkin, size-semanticsin, retry-junctionit ja reduced-motion-tuen.

Run käyttää scope-yhteistä esitysmallia: `Current State`, `Current Decision`, `Policy Projection`, `Most Likely Rollout` ja factual `Execution Graph`. “Expected Path” ei ole formaali UI-termi.

### Supersession

Tämä ADR supersedoi:

- ADR-023:n Graph/GraphNode planet/multi-ring/appearance-projektion; ja
- ADR-024:n vastaavat Graph/GraphNode upper-level-projektio-osat.

ADR-025 ja ADR-027 jäävät Job-flow'n osalta voimaan. ADR-029 ei väitä ADR-025:n omistavan upper-level-planeettoja.

## Seuraukset

- Capability- ja policy-authorointi käyttää kortti-/panel-kieltä planeettageometrian sijaan.
- 1/5/40 GraphNode ja 1/17/64 JobNode skaalautuvat responsive gridin sekä scrollin kautta ilman radial layoutia.
- Upper-level appearance/artwork/multi-ring-data ja käyttämätön canvas-koodi poistuvat.
- Job-flow'n 24 px grid ja artwork-tokenit säilyvät, joten DESIGNin paletteen tai typographyyn ei tarvita uutta ad hoc -kieltä.

## Hylätyt vaihtoehdot

- **Planet-canvas + suurempi modal:** hylätty, koska capability- ja decision-model-totuus jäisi kahden eri vuorovaikutusmallin taakse.
- **Yksi pitkä Graph-form:** hylätty, koska capabilityt ja decision model tarvitsevat erillisen URL-omisteisen mental modelin.
- **Job-flow'n korvaaminen korteilla:** hylätty, koska Work→Validation→retry-rakenne hyötyy edelleen suojatusta flow-projektiosta.

## Evidenssi ja review trigger

Trace on `goal-018` / `REQ-018`, `QS-024`, `CON-005`, `BB-001`–`BB-002`, `RT-018`, `TEST-024`, `EVID-024` ja initiative `capability-first-authoring`.

ADR tarvitsee eksplisiittisen hyväksynnän sekä desktop/narrow-browser-QA:n. Uusi ADR vaaditaan, jos Job industrial flow, design tokenit tai UI:n control-truth-raja muuttuu.
