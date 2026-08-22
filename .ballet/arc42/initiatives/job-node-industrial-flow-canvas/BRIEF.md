---
id: arc42-initiative-job-node-industrial-flow-canvas-brief
title: Job Node industrial flow canvas BRIEF
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 1
tags:
  - arc42
  - initiative
  - job-node
  - ui
---

# Job Node industrial flow canvas BRIEF

## Intentio

- **Fakta JNIFC-F-001:** nykyinen Job Node -authoring näyttää Work/Validation-planeetat ja validate/retryn, mutta ei entry/result/continuation/escalation-rakennetta yhtenä flow'na.
- **Päätös JNIFC-D-001:** projektin omistaja valtuutti 2026-08-22 ADR-025:n industrial flow -hard cutin vain Job Node -canvasille.
- **Päätös JNIFC-D-002:** Next job jää disabled ghost -placeholderiksi; runtime-, candidate-, config-, API-, persistence- ja module-sopimukset eivät muutu.
- Owner: project owner and primary repository architect.
- Stakeholders: Job author, operator, keyboard/mobile user ja architecture reviewer.

## Rajaus

Pure wide/narrow Job flow -projektio, alle 150-rivinen renderer, Work/Validation ghost/selection, inspector/Sheet-kytkentä, token-driven CSS, ADR/DESIGN/arc42-jäljitettävyys, automatisoidut testit ja desktop/narrow-browser-QA.

## Ei kuulu muutokseen

Next job -targetin authorointi, Done/Escalate-runtime-painikkeet, candidate routing -muutos, Human gate, config/module/schema-version muutos, freeform topology, Graph/Graph Node -canvasmuutos, release, deploy, merge tai push.

## Rajat ja rajapinnat

`goal-015`, `adr-023`, `adr-025`, `CON-005`, `CON-011` ja strict-v14 contractit pätevät. Frontend lukee nykyisen `ProjectJobNode`-rakenteen, käyttää Work/Validation-skeemoja vain ghost-projektioon ja tallentaa edelleen koko nykyisen `ProjectAutomationConfig`-muodon.

## Laatutavoite ja hyväksyntä

QS-020 prioriteetti 1 säilyy. 1440×900/390×844-ympäristössä exact flow-rakenne, kaksi inspector-painiketta, disabled Next job, nolla Human gatea, `maxRetries=0` ilman retry-returnia, keyboard/Sheet/active-lock, node-overlap 0, page overflow 0, clipped core action 0 ja console error 0 muodostavat hyväksymisrajan. Graph/Graph Node -regressiot eivät saa muuttua.

## Oletukset ja avoimet kysymykset

- **Oletus JNIFC-A-001:** nykyiset appearance-kentät säilyvät merkityksellisinä emblem/card-size-projektion kautta.
- **Avoin kysymys:** ihmisen visual verdict annetaan vasta uuden desktop/narrow-evidenssin jälkeen; se ei estä teknisen conformance-evidenssin keräämistä.

## Seuraava katselmointiperuste

Ready for implementation against ADR-025 and PLAN.md. Tämä draft ei valtuuta releasea, deployta, mergeä tai pushia.
