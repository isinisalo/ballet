---
id: arc42-state-contract-v1
title: Arc42MethodStateV1-sopimus
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-17'
version: 2
tags:
  - arc42
  - state
  - runtime-contract
---

# Arc42MethodStateV1-sopimus

## Tarkoitus

Tämä tiedosto määrittää kaikkien arc42 Loopsien käyttämän rajatun jaetun runtime Staten. State koordinoi nykyistä työtä vakailla viitteillä; Markdown säilyy pitkäikäisenä project truthina.

## Tila

Versio 1 on accepted päätöksillä `adr-011` ja `adr-015`. Sama rakenteellinen initial value on materialisoitu kaikkiin arc42 Loopseihin. Tämän dokumentaatiomuutoksen proosan suomennos ei muuta `Arc42MethodStateV1`-JSONia, kenttiä, arvoja tai runtime-sopimusta.

## Alkuarvo

<!-- arc42-state-initial:start -->
```json
{
  "contractVersion": "Arc42MethodStateV1",
  "initiative": {
    "id": null,
    "status": "unselected",
    "briefPath": null,
    "goalIds": [],
    "openQuestionIds": []
  },
  "architecture": {
    "status": "baseline",
    "qualityScenarioIds": [],
    "adrIds": [],
    "buildingBlockIds": [],
    "riskIds": []
  },
  "delivery": {
    "status": "not_started",
    "planPath": null,
    "changedArtifactPaths": [],
    "checkIds": [],
    "conformanceFindingIds": []
  },
  "release": {
    "status": "not_requested",
    "authorization": null,
    "evidenceIds": []
  },
  "evaluation": {
    "status": "not_started",
    "evidenceIds": [],
    "findingIds": [],
    "methodHealthUpdatedAt": null
  },
  "handoff": {
    "status": "pending",
    "summary": null,
    "nextLoopId": null,
    "nextAction": null,
    "changedArtifactPaths": [],
    "stableIds": [],
    "checks": []
  }
}
```
<!-- arc42-state-initial:end -->

## Kenttien omistajuus

| Alue | Sallittu sisältö | Kielletty sisältö |
| --- | --- | --- |
| `initiative` | Valittu initiative, BRIEF-polku, Goal ID:t ja open question ID:t. | Koko BRIEF-teksti tai keksitty WHAT/WHY. |
| `architecture` | Status sekä vakaat QS/ADR/BB/RISK-viitteet. | Kopioidut arc42-osiot tai hidden reasoning. |
| `delivery` | PLAN-polku, muuttuneet polut, check- ja conformance-ID:t. | Source-diffit, testilogit tai salaisuudet. |
| `release` | Request-status, exact human authorization -viite ja evidence ID:t. | Credentialit tai implisiittinen lupa. |
| `evaluation` | Evidence/finding-ID:t ja health update -aika. | Viitteettömät model opinionit. |
| `handoff` | Tiivis summary, seuraava Loop/action ja patch-evidenssi. | Continuation- tai return-target-valinta. |

## Patch-velvoitteet

- Valmistunut Work ja Validation OK voivat ehdottaa vain ADR-015:n sallimia `add`, `remove` ja `replace` -operaatioita.
- Patch rajataan nykyisen Noden tehtävän omistamiin kenttiin. Se ei korvaa koko Statea eikä kopioi dokumenttirunkoja.
- Patch-evidenssi päivittää `handoff.changedArtifactPaths`, `handoff.stableIds` ja `handoff.checks`. Check-entry sisältää stable check ID:n, komennon tai havainnon, statuksen ja evidence-viitteen.
- Validation FAIL ei patchaa Statea. Local retry -feedback tai Orchestrator Repair Request kuljettaa korjaustarpeen.
- Model ei kirjoita continuationia, return targetia, repair edgeä, permissionia tai network policya Stateen control instructionina.
- Runtime soveltaa patchin vain current revisioniin ja committoi uuden revisionin atomisesti outcome/control-flow-evidenssin kanssa.

## Miksi State on rajattu

Rajattu State vähentää stale copy -riskiä ja estää runtime-kenttiä muuttumasta rinnakkaiseksi arkkitehtuuridokumentiksi. Pitkä teksti säilyy Markdownissa, tarkka runtime-historia SQLitessä ja State pitää vain nykyisen rajatun coordination contextin sekä stable references. Continuation, repair routing ja permission kuuluvat runtime-engineen, eivät agentin muokattavaan JSONiin.

## Kanoniset lähteet

`adr-015` omistaa atomic State revision -semantiikan. `adr-011` omistaa tämän project-local-shapen. `TaskEnvelopeV3` ja role output schema V3 säilyvät runtime-transport-sopimuksina.

## Relevantit päätökset

`adr-006`, `adr-010` (superseded-historia), `adr-011` ja `adr-015`.

## Evidenssi

`npm run validate:arc42` vertaa jokaisen arc42 Loopin initial valuea rakenteellisesti tähän sopimukseen ja kaikkiin muihin arc42 Loopseihin. JSON-markerit säilytetään koneellista validointia varten.

## Avoimet kysymykset

- Tuleva version 2 -kenttä vaatii toistuvan, mitatun coordination gapin. Kenttää ei lisätä model-preferenssistä tai dokumentaatiotyön sivuvaikutuksena.

## Seuraava katselmointiperuste

Katselmoi vain, jos pilotti osoittaa toistuvan evidenssipohjaisen koordinointivajeen, jota ei voi ilmaista nykyisillä stable references -kentillä.
