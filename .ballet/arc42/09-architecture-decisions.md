---
id: arc42-section-09
title: Arkkitehtuuripäätökset
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-22'
version: 15
tags:
  - arc42
  - decisions
arc42Section: 9
---

# 9. Arkkitehtuuripäätökset

## Tarkoitus

Tämä osio indeksoi kanoniset ADR-tiedostot kopioimatta niiden kontekstia, päätöstä tai seurauksia. Linkitetty ADR on aina päätöstekstin source of truth. Tämä indeksi näyttää vain navigoinnin, tilan, arkkitehtuurialueen ja eksplisiittiset supersession-suhteet.

## Tila

Indeksi vastaa repositoryn päätöstilaa 2026-08-22. ADR-023:n strict-v14 Graph/GraphNode/JobNode-domain, scoped agent routing, bounded Repair Node ja kolmitasoinen avaruuscanvas ovat accepted käyttäjän eksplisiittisen toteutusvaltuutuksen perusteella. ADR-023 supersedoi ADR-016/018/020/021/022:n Loop-, kaksinäkymä-, Edge-, schedule- ja deterministic RunBook -osuudet mutta säilyttää State-, snapshot-, worktree-, ihmisvaltuutus-, tracker/outbox- ja repair call/return -invariantit.

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
| adr-015 | accepted; composite model partly superseded by adr-020 | Historical strict-v10 runtime and surviving State/repair invariants | [Work Loop, State ja Loop Orchestrator](../adr/adr-015-work-loop-state-ja-loop-orchestrator.md) |
| adr-016 | accepted | Loop module boundary | [Yhden Loopin moduulipaketti ja project-local-materialisointi](../adr/adr-016-yhden-loopin-moduulipaketti-ja-project-local-materialisointi.md) |
| adr-017 | accepted | Authoring projections | [Loop Engineer authoring-projektiot](../adr/adr-017-loop-engineer-authoring-projektiot.md) |
| adr-018 | accepted; flow dispatch partly superseded by adr-022; selected-Loop name/route partly superseded by adr-020 | Historical Graph projection/orchestration and surviving repair boundary | [Graph Engineering, Loop Engineering ja Orchestrator-ohjattu v11-graafi](../adr/adr-018-graph-ja-loop-engineering.md) |
| adr-019 | accepted; repository default arc42 granularity partly superseded by adr-022 | Project-local Loop responsibility and package/platform boundary | [Project-local Loopin yhden vastuun ja yhden onnistumisrajan sopimus](../adr/adr-019-project-local-loop-vastuuraja.md) |
| adr-020 | accepted; version/Graph continuation partly superseded by adr-022; canvas projection partly superseded by adr-021 | Workflow domain, runtime and persistence invariants | [Workflow Engineering ja erilliset Job- ja Validation-nodet](../adr/adr-020-workflow-engineering.md) |
| adr-021 | accepted | Workflow Engineering canvas projection | [Workflow-canvas projisoi Validationin JobNoden sisään](../adr/adr-021-workflow-canvas-job-projektio.md) |
| adr-022 | accepted | Strict-v13 named Graph RunBook, tracker reconciliation and five-Loop project default | [Deterministinen Graph Engineering RunBook ja kaksistoreinen tk-sovitus](../adr/adr-022-deterministinen-graph-engineering-runbook.md) |
| adr-023 | accepted | Strict-v14 three-level Graph Node domain, scoped agent routing and bounded repair | [Kolmitasoinen Graph Node -domain ja agenttiohjattu reititys](../adr/adr-023-three-level-graph-node-orchestration.md) |

## Supersession-suhteet

```text
adr-004 ── kokonaan superseded by ──▶ adr-015 ◀── kokonaan superseded by ── adr-010

adr-014:n “ei pakettimuotoa V1:ssä” -raja
        └── osittain superseded by ──▶ adr-016
            muu project-local-omistajuus säilyy hyväksyttynä

adr-017:n Context / numeric level / composition -malli
        └── osittain superseded by ──▶ adr-018
            selected-Loop-only sisäinen projektio ja Edge-omistajuus säilyvät

adr-015:n automaattinen followFlow
        └── osittain superseded by ──▶ adr-018
            State, retry, repair-frame, continuation ja recovery säilyvät

adr-011:n kiinteä kuuden nimetyn arc42-Loopin topologia
        └── osittain superseded by ──▶ adr-019
            kanoniset polut, State, ihmisrajat, source-of-truth ja continuous learning säilyvät

adr-015:n composite WorkLoopNode / WorkNode -malli
        └── osittain superseded by ──▶ adr-020
            State, revisionit, repair-frame, continuation, rajat, cancellation ja recovery säilyvät

adr-018:n Loop Engineering -nimi ja view=loop-reitti
        └── osittain superseded by ──▶ adr-020
            Graph Engineering, LoopNode, LoopEdge, capability-allowlist ja Orchestrator-dispatch säilyvät

adr-020:n erilliset Job/Validation-canvas-artworkit, validate/retry-polut ja endpoint-nodet
        └── osittain superseded by ──▶ adr-021
            erillinen Job/Validation-domain, runtime, authorointi ja editorit säilyvät

adr-018:n tavallisen flow-targetin agentti-/candidate-dispatch
        └── osittain superseded by ──▶ adr-022
            Graph/Workflow-erottelu ja repair allowlist/call-return säilyvät

adr-019:n repositoryn yksi arc42-output per Loop -oletusgranulariteetti
        └── osittain superseded by ──▶ adr-022
            project-local vastuu, package- ja platform/project-raja säilyvät

adr-016/018/020/021/022:n aktiivinen Loop/Workflow/Edge/RunBook-raja
        └── osittain superseded by ──▶ adr-023
            State, immutable snapshot, worktree, ihmisvaltuutus, tracker/outbox ja repair call/return säilyvät
```

| Vanhempi päätös | Korvaava päätös | Suhteen tarkka vaikutus |
| --- | --- | --- |
| adr-004 | adr-015 | Koko legacy Loop/Step/Transition-runtime-domain korvautuu strict-v10 `Loop` / `WorkLoopNode` / `WorkNode` / `ValidationNode` / `State` / `Edge` / `LoopEdge` -mallilla. Historiallista ADR:ää ei kirjoiteta uudelleen. |
| adr-010 | adr-015 | Legacy `StepResult`-rajauksen tilalle tulee roolikohtainen strict outcome, revisionoitu State ja runtime-owned control flow. |
| adr-014, vain V1:n no-package-raja | adr-016 | Yhden Loopin authoring package hyväksytään inspect/plan/commit-materialisointiin. ADR-014:n project-local-data- ja no-live-dependency-periaate jää voimaan. |
| adr-017, Context/numeric level/Level 1 composition | adr-018 | Toteutettu v11 hard cut korvaa kolme authoring-tasoa Graph Engineering / Loop Engineering -unionilla ja poistaa Contextin sekä numeric route -mallin. Selected-Loop-only sisäinen projektio säilyy. Historiallista ADR:ää ei kirjoiteta uudelleen. |
| adr-015, automaattinen yhden flow-edgen `followFlow` | adr-018 | Toteutettu v11 ohjaa nolla/yksi/usea flow candidatea Orchestrator-dispatchin, snapshot-allowlistin, capabilityn ja `needs_input`-rajan kautta. Repairin call/return-, State- ja recovery-periaatteet säilyvät. |
| adr-011, kiinteä kuuden nimetyn arc42-aktiviteetti-Loopin lista ja koarse structures/concepts-flow | adr-019 | Project-local vastuut erotetaan itsenäisiksi capability-Loopeiksi ja yhden Loopin paketeiksi. ADR-011:n dokumenttiomistajuus, State-, repair-, ihmis- ja jatkuvan oppimisen rajat säilyvät. |
| adr-015, composite `WorkLoopNode` / `WorkNode` ja Validation `OK` / mode | adr-020 | Strict-v12 `ProjectWorkflow` käyttää erillisiä Job/Validation-nodeja sekä Pass/Fail Edgejä. State-, repair-frame-, continuation-, raja-, cancellation- ja recovery-periaatteet säilyvät. |
| adr-018, **Loop Engineering** ja `view=loop` | adr-020 | Selected-Loop-projektio on **Workflow Engineering** reitillä `view=workflow`. Graph Engineering, `ProjectLoop` / `LoopNode`, project-global `LoopEdge` ja Orchestrator-ohjattu cross-Loop-flow säilyvät. |
| adr-020, erilliset Job/Validation-canvas-artworkit, validate/retry-polut ja PASS/FAIL-endpoint-nodet | adr-021 | Workflow-canvas näyttää yhden Job-artworkin per pari, projisoi Validationin sen sisään ja piirtää vain persisted Pass/Fail Edget `straight | smoothstep` -geometrialla. Domain-, runtime- ja editorirajat säilyvät. |
| adr-018, tavallisen flow'n capability/agentti-dispatch ja zero-flow completion | adr-022 | Strict-v13 ratkaisee exact named transitionin immutable snapshotista ja päättää Graph Runin vain eksplisiittiseen DONE-targetiin. Repair allowlist/call-return säilyy. |
| adr-019, repositoryn oletus-arc42-granulariteetti | adr-022 | Oletusprojekti käyttää viittä toimitus-Loopia ja DESIGNin 12 osiokohtaista JobNodea. Project-local/package/platform-vastuurajat säilyvät. |
| adr-016, yhden Loopin Module v3 | adr-023 | Yksi Graph Node Module v4 sisältää Graph Noden, sen aggregate JobNodet, scoped orchestrator/repairin ja resource closuren. Inspect/plan/config-last/provenance/no-live-dependency säilyvät. |
| adr-018, `ProjectLoop` ja Graph/Loop-kaksinäkymä | adr-023 | Kolme canonical Graph/GraphNode/JobNode-canvasia ja scoped candidate-säännöt korvaavat kaksinäkymän sekä cross-Loop Edge -rajan. Immutable snapshot, State, continuation ja ihmisvaltuutus säilyvät. |
| adr-020, `ProjectWorkflow`, Pass/Fail Edget ja schedule | adr-023 | Aggregate JobNode omistaa Work/Validation-lapset ja bounded retryn; tasojen välinen dispatch kuuluu orchestratorille. Erilliset roolit, State patch, technical failure ja same-Validation-return säilyvät. |
| adr-021, Validationin sisäinen Job-only canvas-projektio | adr-023 | Job Node -taso näyttää erilliset Work/Validation-planeetat ja fixed validate/retry-yhteydet. Avaruusteeman tokenit, artworkit, glow, amber-ID:t ja mint-yhteydet säilyvät. |
| adr-022, exact named RunBook ja strict-v13/v3/v9 | adr-023 | Scoped agent routing strict candidate-enumista, Graph/GraphNode Runeista ja v14/v4/v10-versioista korvaa start/transitions/repairEdges/scheduled-run-rajan. Bounded State, snapshot, tracker/outbox, worktree, ihmisvaltuutus ja repair call/return säilyvät. |

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

`npm run validate:arc42` ratkaisee jokaisen ADR-linkin ja tarkistaa viitatun frontmatter-ID:n. Dokumentaation conformance review tarkistaa, ettei hyväksyttyjen päätösten historiaa muuteta hiljaisesti; uusi `adr-023` on käyttäjän eksplisiittisesti valtuuttama päätös.

## Avoimet kysymykset

- Ei päätöskohtaista avointa kysymystä. Uusi merkittävä valinta pysyy proposal-tilassa, kunnes ihminen hyväksyy sen.

## Seuraava katselmointiperuste

Päivitä indeksi, kun ADR lisätään, hyväksytään, hylätään tai supersedoidaan.
