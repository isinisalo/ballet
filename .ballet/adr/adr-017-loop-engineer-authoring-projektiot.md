---
id: adr-017
title: Loop Engineerin authoring-projektiot ja tasokohtainen Edge-omistajuus
status: accepted
createdAt: '2026-08-16T00:00:00.000Z'
updatedAt: '2026-08-16T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - loop-engineer
  - projektiot
version: 1
---

# Loop Engineerin authoring-projektiot ja tasokohtainen Edge-omistajuus

## Konteksti

Nykyinen Configure/Automation UI näyttää All Loops -korttikokoelman erillään yhden Loopin editorista, mutta reititys käyttää erityistapausta `view=all`. Yhden Loopin composite-layout voi lisäksi projisoida linkitettyjä Loopeja compact-nodeina, jolloin project-global ja Loopin sisäinen rakenne sekoittuvat. Goal-011 edellyttää arc42:n black box / white box -periaatetta vastaavaa, yksiselitteistä kolmitasoista authoring-työtilaa muuttamatta ADR-015:n runtimea tai ADR-016:n package-rajaa.

## Vaihtoehdot

1. Lisätään Context- ja nested Loop -runtime-entiteetit. Hylätty: rinnakkainen domain rikkoisi strict-v10-totuuden ja immutable snapshot -rajan.
2. Laajennetaan nykyistä composite canvasia näyttämään kaikki tasot samassa graafissa. Hylätty: node- ja Edge-omistajuus jäisi epäselväksi ja synnyttäisi implisiittisen neljännen Work/Validation-tason.
3. Johdetaan samasta strict-v10-domainista kolme erillistä UI-projektiota ja tehdään URL:sta aktiivisen tason totuuslähde. Valittu.

## Päätös

### Tasot ovat authoring UI -projektioita

- Context eli Level 0 on read-only-projektio projektin nimestä ja kuvauksesta, Loop-topologiasta, installed module -metadatasta ja jo saatavilla olevasta Run-tilasta. Konseptuaaliset Context-yhteydet eivät tallennu configiin.
- Level 1 · Loops näyttää yhden black box -noden jokaista `ProjectLoop`ia kohti ja vain `ProjectLoopEdge`-yhteydet. `ProjectLoopEdge` luodaan, muokataan ja poistetaan vain tällä tasolla.
- Level 2 · Detail näyttää vain valitun `ProjectLoop`in `ProjectWorkLoopNode`-nodet, `ProjectNodeEdge`-yhteydet, start-noden ja eksplisiittiset terminal targetit. `ProjectNodeEdge` kuuluu vain tälle tasolle.

`ProjectLoop` ei sisällä toista Loopia. Uusia `ContextLoop`-, `Level1Loop`-, `Level2Loop`-, `NestedLoop`-, `LoopContainer`- tai runtime-resolved `ModuleLoop`-entiteettejä ei luoda.

### Runtime- ja package-rajat säilyvät

Project configuration pysyy strict v10:nä. ADR-015:n Root Run snapshot, Work/Validation-kompositio, revisioitu State, retry, repair, continuation ja Loop Orchestrator eivät muutu. Work ja Validation piirretään Level 2:ssa yhtenä composite Work Loop Nodena.

ADR-016:n `LoopModulePackageV1` pysyy yhden Loopin authoring/install-time artifactina. Installed Loop on edelleen materialisoitu project-local `ProjectLoop`, ja Loop Run käyttää vain nykyistä snapshotia. Package ei sisällä project-global Loop Edgeä tai Orchestratoria, eikä `recommendedConnections` luo yhteyttä automaattisesti.

### URL omistaa aktiivisen tason

Kanoniset Configure-reitit ovat `/automation/loops?level=context`, `/automation/loops?level=1`, valinnaisesti valitulla Level 1 ID:llä, sekä `/automation/loops?level=2&id=<loop-id>` ja `/automation/loops?level=2&new=1`. Paljas `/automation/loops` ratkaistaan Contextiksi. Typed parseri ja generaattorit käyttävät frontend-kohtaista `context | composition | detail` -mallia.

Legacy `view=all` poistetaan eikä sitä säilytetä rinnakkaisena alias-polku­na. Reitti, UI-valinta, inspectorin avaaminen tai tason vaihto ei mutatoi domainia.

### Projektiot ja renderöinti

Context-, composition- ja detail-projektiot ovat puhtaita, deterministisiä ja yksikkötestattavia. Tasot voivat jakaa canvasin surface-, grid-, viewport- ja edge-routing-primitivejä vain silloin, kun semantiikka on sama. Level 1:n suorakulmainen Loop Node ei käytä Level 2:n Work-owned artwork -nodea.

Onnistunut module install lataa workspace automationin ja module-statukset uudelleen backendin authoritative tilasta, valitsee asennetun Loopin Level 1:llä eikä luo `recommendedConnections`-yhteyksiä.

## Seuraukset

- Authoring-UI saa selkeän informaatioarkkitehtuurin ilman schema- tai runtime-migraatiota.
- Level 1 tarvitsee oman projection/layout/node/edge-polun ja saavutettavan inspectorin.
- Level 2 käyttää selected-Loop-only layoutia; vanha cross-Loop composite-layout ei ole Configure-detailin oletus.
- All Loops -korttiruudukko ja `view=all`-reititys poistuvat korvautuvana legacy-koodina.
- Deep linkit ja browser back/forward ovat testattavia ilman erillistä client state -totuutta.

## Evidenssi ja review trigger

Toteutusankkurit ovat frontendin routing, Loop Engineer shell, kolme projection-funktiota, Level 1 composition canvas, selected-Loop-only detail layout, Loop Library -refresh sekä `goal-011` / QS-010 / initiative `loop-engineer-three-level-canvas`. Päätös arvioidaan uudelleen ennen config-version muutosta, nested Loop -domainia tai package-runtime-riippuvuutta.
