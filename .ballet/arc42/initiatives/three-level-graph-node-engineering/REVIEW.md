---
id: three-level-graph-node-engineering-review
title: Kolmitasoisen Graph Node Engineeringin REVIEW
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 1
tags:
  - arc42
  - initiative
  - review
---

# Kolmitasoisen Graph Node Engineeringin REVIEW

## Yhteenveto

Review arvioi strict-v14 `Graph → GraphNode → JobNode` -hard cutin, agenttiohjatun routing/repair-semanticsin, Graph Node Module v4 -rajan, SQLite v10:n ja kolme avaruuscanvasia `goal-015`:n sekä `adr-023`:n perusteella.

## Nykyinen verdict

| QS | Kriteeri | Evidenssi | Tila |
| --- | --- | --- | --- |
| QS-019 | Strict schema/runtime/composition/persistence/module-raja, scoped targetit, bounded repair ja nolla aktiivista legacy-polkuvaikutusta. | TGNE-EVID-001–003, TGNE-EVID-005 | technical/conformance passed; live provider pilot open |
| QS-020 | Kolme canonical canvasia, nolla foreign-scope-nodea, nolla overlapia/vaakaylivuotoa/leikattua ydintoimintoa ja saavutettava navigointi. | TGNE-EVID-004–005 | technical/browser passed; human visual verdict pending |

## Faktat, löydökset ja päätökset

- **Fakta F-015-002:** source-, project-data-, module- ja dokumenttimuutokset ovat samassa työpuussa strict cutin arviointia varten.
- **Fakta F-015-003:** 40 testitiedoston 156 testiä, build, arc42, DESIGN, module, boundary, active-legacy ja diff-portit läpäisevät; lintissä on 0 virhettä ja 8 ei-estävää kompleksisuus-/kokovaroitusta.
- **Fakta F-015-004:** in-app Browser mittasi 1/5/40 GraphNode- ja 1/17/64 JobNode-fixturet 1440×900/390×844-koossa: 0 näkyvien node-osien overlapia, 0 page overflow'ta ja 0 konsolivaroitusta/-virhettä. 19 kuvaa säilyttää tuloksen.
- **Korjattu löydös FIND-015-001:** selain-QA:ssa havaittu 1440 px sivutason vaakaylivuoto korjattiin canvasin sisäiseksi pan/scrolliksi; uudessa mittauksessa page overflow on 0 kaikilla kolmella tasolla.
- **Korjattu löydös FIND-015-002:** Graph/GraphNode/Job-canvasit keskitetään mountissa ja viewportin muutoksessa, joten narrow-aloitus näyttää hubin tai Work/Validation-ydinparin.
- **Avoin löydös FIND-015-003:** projektin omistajan visual verdict ja ensimmäinen tuotantokaltainen Luna/Sol-provider-pilotti puuttuvat; teknisiä priority-1 conformance-findingejä on 0.
- **Päätös:** ei acceptance-, release-, deploy-, merge- tai push-valtuutusta ennen evidenssin ja ihmisverdictin täydentämistä.

## Arkkitehtuurin conformance-kohteet

- Candidate-target ei voi poistua oikeasta scope-unionista tai immutable snapshotista.
- Repair ei laajenna oikeuksia, targetteja tai resource closurea ja palaa samaan Validationiin retryn säilyttäen.
- Luna/Sol ovat project-local profile mappingeja, eivät platform-vakioita tai fallback-ketju.
- UI näyttää kullakin tasolla vain nimetyn scoped domainin ja canonical asetukset.
- V9-kanta jää koskemattomaksi; v10 startup on fail-closed.
- Platform-koodi ei hardkoodaa project-workflow'n tunnisteita.

## Avoimet kysymykset ja handoff

- Omistaja: projektin omistaja. Kysymys: hyväksyykö hän desktop- ja narrow-selainevidenssin avaruusteeman, kompaktiuden ja ymmärrettävyyden?
- Nykyinen handoff: projektin omistaja arvioi tallennetut desktop/narrow-kuvat; erillinen tuotantokaltainen provider-pilotti suunnitellaan ilman release- tai external-write-valtuutuksen laajennusta.
- Stop condition: puuttuva priority-1-evidenssi, arkkitehtuuridrift tai ulkoisen kirjoituksen tarve pysäyttää työn `needs_input`-tilaan.
