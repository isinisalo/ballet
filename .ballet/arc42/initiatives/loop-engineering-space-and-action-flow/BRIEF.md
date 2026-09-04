---
id: lesaf-brief-001
title: Loop Engineering space and Action flow brief
status: superseded
createdAt: '2026-08-29'
updatedAt: '2026-09-04'
version: 4
tags: [arc42, initiative, loop-engineering, ui]
---

# Loop Engineering space and Action flow BRIEF

> Superseded by [Loop Engineering three-level Dagre](../loop-engineering-three-level-dagre/BRIEF.md) and ADR-044. This document preserves the historical planet/Action-flow evidence only.

## Agreement

Initiative `loop-engineering-space-and-action-flow` toteuttaa `goal-023` / `REQ-023` / QS-033:n alla projektin omistajan 2026-08-29 pyytämän Loop Engineering -palautuksen. Omistaja hyväksyi toteutussuunnitelman eksplisiittisellä “Implement the proposed plan” -pyynnöllä.

**FACT-LESAF-001:** aktiivinen domain on Environment -> State -> Action ja canonical authoring-reitit ovat jo käytössä, mutta ennen muutosta route-kohtaiset korttipinnat eivät säilyttäneet yhtä spatiaalista kontekstia.

**DEC-LESAF-001:** Statet näytetään ylhäältä alas ja valitun Staten Actionit samassa canvasissa planeettoina; sama canvas säilyy editorin vieressä route-siirtymissä. Actionin controller/work-flow palautetaan tummaan token-pohjaiseen industrial-kaavioon.

**DEC-LESAF-003:** Projektin omistajan 2026-08-30 pyyntö ja toteutusvaltuutus supersedoivat DEC-LESAF-001:n canvas-orientaation: Statet näytetään vasemmalta oikealle, ja vain valitun Staten Actionit näytetään ylhäältä alas sen alla. Action-flow ja runtime-rajat säilyvät.

## Scope ja laatumitta

- Pure, deterministinen State/Action-projektio ja yhteinen canvas/editor-shell.
- Canonical URL-owned State/Action-valinta, keyboard/focus ja invalid-route recovery ennallaan.
- Action-flow, joka näyttää START-, Validation-, Work-, done-, retry-, blocked/Feedback- ja retry budget -semantiikan.
- Component/projection/regression-testit, 1440x900- ja 390x844-browser-QA sekä kaikki repository-gatet.
- QS-033 hyväksytään vain, kun sivutason horizontal overflow on 0, State/Action route control on vähintään 44 px, Actionit ovat priority-järjestyksessä, canonical 5 State / 12 Action -canvas ei vieritä 1440×900:ssa eikä UI luo runtime-faktoja.

## Non-goals ja rajat

Ei config/API/persistence/runtime-versiomuutosta, historical readeria, route-aliasta, pan/zoom-editoria, artwork-konfiguraatiota, client-owned completionia eikä ulkoista kirjoitusta. Merge, push, release ja deploy eivät kuulu valtuutukseen.

## Riskit ja oletukset

**ASM-LESAF-001:** sisäinen canvas-vieritys on hyväksyttävä narrow-viewportin State-riville sekä canonical määrät ylittävälle State- tai Action-joukolle, kun sivutason overflow pysyy nollassa ja 44 px route-kontrollit säilyvät.

**RISK-LESAF-001:** koristeellinen artwork voi näyttää runtime-statukselta. Mitigaatio on order/priority-label, valinnan erillinen blue focus/ring sekä eksplisiittinen “authoring projection, not runtime control” -teksti.

## Acceptance

Hyväksyntäketju on adr-043, TEST-033, EVID-033 ja tämän initiativen `LESAF-evid-001`–`009`. Seuraava sallittu askel on paikallinen implementation, verification ja conformance review; ulkoinen julkaisu vaatii uuden valtuutuksen.
