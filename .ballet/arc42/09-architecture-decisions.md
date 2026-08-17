---
id: arc42-section-09
title: Arkkitehtuuripäätökset
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-17'
version: 4
tags:
  - arc42
  - decisions
arc42Section: 9
---

# 9. Arkkitehtuuripäätökset

## Tarkoitus

Tämä osio indeksoi kanoniset ADR-tiedostot kopioimatta niiden kontekstia, päätöstä tai seurauksia. Linkitetty ADR on aina päätöstekstin source of truth. Tämä indeksi näyttää vain navigoinnin, tilan, arkkitehtuurialueen ja eksplisiittiset supersession-suhteet.

## Tila

Indeksi vastaa repositoryn tilaa 2026-08-17. Dokumentaatioinitiative ei muuta ADR-päätösten semantiikkaa eikä hyväksyntätilaa.

## Päätösindeksi

| ID | Tila | Alue | Kanoninen ADR |
| --- | --- | --- | --- |
| adr-001 | accepted | Checkout-local system boundary | [Checkout-kohtainen paikallinen palvelu](../adr/adr-001-checkout-kohtainen-paikallinen-palvelu.md) |
| adr-002 | accepted | Project truth vs runtime state | [Kannettava projektimääritys ja paikallinen tila](../adr/adr-002-kannettava-projektimaaritys-ja-paikallinen-tila.md) |
| adr-003 | accepted | Application decomposition | [Yhteinen TypeScript-sovellusarkkitehtuuri](../adr/adr-003-yhteinen-typescript-sovellusarkkitehtuuri.md) |
| adr-004 | superseded by adr-015 | Legacy Loop domain | [Legacy Loop/Step/Transition-domainmalli](../adr/adr-004-loop-step-transition-run-domain-malli.md) |
| adr-005 | accepted | Provider boundary | [Provider-neutraali agenttisuoritus](../adr/adr-005-provider-neutraali-agenttisuoritus.md) |
| adr-006 | accepted | Run isolation | [Root Run Git worktree -eristys](../adr/adr-006-root-run-git-worktree-eristys.md) |
| adr-007 | accepted | Runtime persistence | [SQLite suoritus- ja ajastustilana](../adr/adr-007-sqlite-suoritus-ja-ajastustila.md) |
| adr-008 | accepted | API/permission boundary | [Loopback API ja suljettu oikeusmalli](../adr/adr-008-loopback-api-ja-suljettu-oikeusmalli.md) |
| adr-009 | accepted | Distribution | [Varmennettu macOS-jakelu](../adr/adr-009-varmennettu-macos-jakelu.md) |
| adr-010 | superseded by adr-015 | Legacy result/runtime split | [Legacy StepResult erotetaan runtime-statesta](../adr/adr-010-step-result-erotetaan-runtime-statesta.md) |
| adr-011 | accepted | Architecture method/source of truth | [arc42 Template ja jatkuva Ballet Method](../adr/adr-011-arc42-template-ja-jatkuva-ballet-method.md) |
| adr-012 | accepted | Execution profile | [ExecutionProfile erotetaan instruction- ja skill-valinnoista](../adr/adr-012-execution-profile-erotetaan-stepin-instructions-ja-skills-valinnoista.md) |
| adr-013 | accepted | Workflow ownership | [Workflow-yksityiskohdat kuuluvat skilleihin](../adr/adr-013-workflow-yksityiskohdat-kuuluvat-skillsiin.md) |
| adr-014 | accepted; V1-raja osittain superseded by adr-016 | Project-local workflow templates | [Workflow-templatet ovat project-local-dataa](../adr/adr-014-workflow-templatet-ovat-project-local-dataa.md) |
| adr-015 | accepted | Strict-v10 runtime domain | [Work Loop, State ja Loop Orchestrator](../adr/adr-015-work-loop-state-ja-loop-orchestrator.md) |
| adr-016 | accepted | Loop module boundary | [Yhden Loopin moduulipaketti ja project-local-materialisointi](../adr/adr-016-yhden-loopin-moduulipaketti-ja-project-local-materialisointi.md) |
| adr-017 | accepted | Authoring projections | [Loop Engineer authoring-projektiot](../adr/adr-017-loop-engineer-authoring-projektiot.md) |

## Supersession-suhteet

```text
adr-004 ── kokonaan superseded by ──▶ adr-015 ◀── kokonaan superseded by ── adr-010

adr-014:n “ei pakettimuotoa V1:ssä” -raja
        └── osittain superseded by ──▶ adr-016
            muu project-local-omistajuus säilyy hyväksyttynä
```

| Vanhempi päätös | Korvaava päätös | Suhteen tarkka vaikutus |
| --- | --- | --- |
| adr-004 | adr-015 | Koko legacy Loop/Step/Transition-runtime-domain korvautuu strict-v10 `Loop` / `WorkLoopNode` / `WorkNode` / `ValidationNode` / `State` / `Edge` / `LoopEdge` -mallilla. Historiallista ADR:ää ei kirjoiteta uudelleen. |
| adr-010 | adr-015 | Legacy `StepResult`-rajauksen tilalle tulee roolikohtainen strict outcome, revisionoitu State ja runtime-owned control flow. |
| adr-014, vain V1:n no-package-raja | adr-016 | Yhden Loopin authoring package hyväksytään inspect/plan/commit-materialisointiin. ADR-014:n project-local-data- ja no-live-dependency-periaate jää voimaan. |

## Päätösten käyttö

- Uusi, kallis, vaikeasti peruttava, riskialtis tai kiistanalainen valinta ehdotetaan uutena ADR:nä.
- Hyväksyttyä ADR:ää ei korjata muuttamalla arc42-yhteenvetoa; ristiriita korjataan linkitetyssä päätösketjussa.
- `superseded` ei poista historiallista tiedostoa. Uusi ADR nimeää korvatun laajuuden ja tämä indeksi näyttää suhteen.
- Initiative-BRIEF/PLAN voi linkittää vain tarvitut ADR:t; se ei kopioi päätöstekstiä.
- Jos toteutus poikkeaa hyväksytystä ADR:stä, poikkeama kirjataan findingiksi eikä dokumentaatiota muokata “vastaamaan toteutusta” ilman päätöstä.

## Kanoniset lähteet

Vain `.ballet/adr/*.md` omistaa arkkitehtuuripäätökset. Tämä indeksi on navigoinnin ja validoinnin apurakenne.

## Relevantit päätökset

Kaikki yllä indeksoidut ADR:t; `adr-011` määrittää indeksointi- ja source-of-truth-säännön.

## Evidenssi

`npm run validate:arc42` ratkaisee jokaisen ADR-linkin ja tarkistaa viitatun frontmatter-ID:n. Dokumentaation conformance review tarkistaa, ettei diffi muuta `.ballet/adr/**`-tiedostoja.

## Avoimet kysymykset

- Ei päätöskohtaista avointa kysymystä. Uusi merkittävä valinta pysyy proposal-tilassa, kunnes ihminen hyväksyy sen.

## Seuraava katselmointiperuste

Päivitä indeksi, kun ADR lisätään, hyväksytään, hylätään tai supersedoidaan.
