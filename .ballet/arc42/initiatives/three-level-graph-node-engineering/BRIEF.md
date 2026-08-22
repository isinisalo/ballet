---
id: three-level-graph-node-engineering-brief
title: Kolmitasoisen Graph Node Engineeringin BRIEF
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 1
tags:
  - arc42
  - initiative
  - graph-node
  - orchestrator
---

# Kolmitasoisen Graph Node Engineeringin BRIEF

## Status

Initiative `three-level-graph-node-engineering` on draft. Omistaja on Ballet-projektin omistaja. Hyväksytty intentio on `goal-015` / `REQ-015` ja hyväksytty ratkaisu `adr-023`.

## Faktat ja päätös

- **Fakta F-015-001:** strict-v13-baseline jakoi authoroinnin Graph- ja Workflow-näkymiin, käytti `ProjectLoop`-domainia, named transitioneja ja schedule-rakennetta.
- **Päätös D-015-001:** käyttäjä valtuutti 2026-08-22 strict hard cutin kolmeen URL-ohjattuun `Graph → GraphNode → JobNode` -canvasiin ilman hybridiä.
- **Päätös D-015-002:** Graph- ja Graph Node -orchestratorit tekevät kaikki tasojen väliset päätökset snapshotatusta strict candidate-enumista. Work→Validation ja bounded retry jäävät Job Noden sisäisiksi runtime-invarianteiksi.
- **Päätös D-015-003:** Balletin oletusdatassa orchestratorit ovat Luna/medium/network-off ja valinnaiset Repair Nodet Sol/medium/network-off. Platform pysyy provider- ja mallineutraalina.

## Sidosryhmät ja odotukset

| Sidosryhmä | Odotus |
| --- | --- |
| Operaattori | Ymmärtää kolmen tason rakenteen, navigoi suoraan ja löytää orchestrator-, repair-, Work- ja Validation-asetukset kompaktisti. |
| Project owner | Voi authoroida routing candidate -joukot ja malliprofiilit project-datana ilman platform-muutosta. |
| Runtime maintainer | Saa yhden strict domainin, yhden snapshot-semanticsin ja fail-closed-persistenssin ilman legacy-readeria. |
| Validation/reviewer | Voi traceata jokaisen dispatchin, repair-framen, State patchin ja terminaalin canonical evidenssiin. |

## Scope

- Project config v14 ja `ProjectGraphNode` / aggregate `ProjectJobNode` -domain.
- Root Snapshot v7, Task Envelope/outcome v7, composition v8 ja ExecutionSpec v9.
- Graph- ja GraphNode-Run, scoped orchestrator/repair sekä SQLite v10.
- Graph Node Module v4 ja 14 project-local-paketin roundtrip.
- Kolme canonical authoring-routea, kaksi Run-routea ja kolmen tason avaruuscanvas.
- Viiden oletus-GraphNoden, 17 JobNoden ja niiden Work/Validation-lasten muunnos.
- `goal-015`, `adr-023`, CON/RT/QS/TEST/EVID-ketju sekä DESIGN/AGENTS-sopimus.

## Non-goals

- Standalone JobNode Run, schedule tai automaattinen legacy-migraatio.
- Provider/model-fallback tai platformiin hardkoodattu Luna/Sol.
- Active snapshotin candidate-, resource- tai permission-joukon laajennus repairissa.
- Release, deploy, merge, push tai muu ulkoinen kirjoitus.
- Historiallisten Goalien, ADR:ien tai initiative-evidenssin uudelleenkirjoitus.

## Rajoitteet ja rajapinnat

- Source of truth on repositoryn strict-v14 project data; `.git/ballet` omistaa machine-local runtime-faktat.
- Work/Validation/Repair-instruction ei nimeä vertaisnodeja. Routing truth on saman tason orchestratorissa ja candidate-säännöissä.
- V9-runtime-kantaa ei muuteta; startup antaa archive/remediation-ohjeen.
- Canvas käyttää vain `DESIGN.md`-tokeneita ja suojattua avaruusteemaa.
- Human external-write -valtuutus, worktree-eristys, immutable snapshot, tracker/outbox ja repair call/return säilyvät.

## Laatutavoitteet

- `QS-019` prioriteetti 1: strict-v14 domain, agenttireititys, repair, persistence, composition ja module roundtrip ovat suljettuja, toistettavia ja legacyttömiä.
- `QS-020` prioriteetti 1: kolme scopettua canvasia ovat saavutettavia, kompakteja ja overlapittomia 1440×900- ja 390×844-viewporteissa.

## Oletukset, hypoteesit ja avoimet kysymykset

- **Oletus A-015-001:** Luna/medium riittää strict-enum-reititykseen, koska target-joukko on snapshotattu ja pieni. Preflight ja invalidi-target-matriisi todentavat teknisen rajan; tuotantokaltainen laatu vaatii myöhemmän pilotin.
- **Hypoteesi H-015-001:** erillinen Sol Repair Node vähentää ihmiseskalaatioita ilman oikeuksien tai target-joukon laajentamista. Ensimmäinen end-to-end-pilotti mittaa tämän.
- **Avoin kysymys OQ-015-001:** projektin omistajan desktop/narrow-visual verdict puuttuu, kunnes selainevidenssi on esitetty.

## Acceptance intent ja seuraava raja

Toteutus voidaan arvioida, kun TEST-019 ja TEST-020 ovat ajettu, initiative-EVIDENCE nimeää todelliset tulokset ja conformance-review löytää nolla hyväksymistä estävää drift-findingiä. Tämä BRIEF ei valtuuta ulkoista kirjoitusta.
