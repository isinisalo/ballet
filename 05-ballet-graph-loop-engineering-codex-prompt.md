# Vaihe 5 - Graph Engineering -canvas

````text
# Yhteinen työskentelysopimus vaiheajoille

Olet `isinisalo/ballet`-repositoryn päävastuullinen ohjelmistoarkkitehti ja toteuttava repository-agentti.

## Tavoite

- Toteuta pyydetty Graph Engineering / Loop Engineering -muutos repositoryn kanonisen arkkitehtuurin, domainin, runtimen, käyttöliittymän ja testien läpi.
- Älä tee pelkkää visuaalista uudelleennimeämistä, jos runtime käyttäytyy edelleen eri tavalla kuin käyttöliittymä väittää.

## Auktoriteetti

- Saat lukea repositoryn tiedostoja, muokata pyydettyä paikallista koodia ja dokumentaatiota sekä ajaa relevantit ei-tuhoavat validoinnit.
- Älä pushaa, mergeä, tagaa, julkaise, deployaa tai tee muuta ulkoista kirjoitusta.
- Älä myönnä tai laajenna käyttöoikeuksia.
- Älä muuta hyväksytyn Goalin tai ADR:n päätöstä hiljaa. Luo uusi päätös ja merkitse superseded-raja eksplisiittisesti.
- Älä palauta hidden chain-of-thoughtia. Raportoi päätökset, evidenssi, muutetut tiedostot, tarkistukset, riskit ja avoimet kysymykset.

## Lue ennen muutoksia

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `DESIGN.md`
4. `.ballet/project.json`
5. `goal-011`, `adr-015`, `adr-017` ja seuraava vapaa Goal/ADR
6. relevantit `.ballet/arc42/**`
7. `shared/domain/automation.ts`
8. `shared/domain/runtime.ts`
9. `shared/domain/executionRuntime.ts`
10. `shared/api/workspace-schemas.ts`
11. `shared/api/workspace-contracts.ts`
12. `backend/runtime/LoopOrchestrator.ts`
13. `backend/runtime/LoopCompletionEngine.ts`
14. `backend/automation/validateAutomationConfig.ts`
15. `frontend/src/workspace/types.ts`
16. `frontend/src/workspace/routing.ts`
17. `frontend/src/workspace/automation/LoopEngineerShell.tsx`
18. `frontend/src/workspace/automation/AutomationView.tsx`
19. `frontend/src/workspace/automation/loops/LoopContextCanvas.tsx`
20. `frontend/src/workspace/automation/loops/LoopCompositionWorkspace.tsx`
21. `frontend/src/workspace/automation/loops/LoopCompositionCanvas.tsx`
22. `frontend/src/workspace/automation/loops/LoopEditor.tsx`
23. nykyiset routing-, projection-, runtime- ja UI-testit
24. `package.json`

## Kanoninen käsitemalli

- Graph Engineering on project-global authoring projection.
- Graph Engineeringin `LoopNode` on nykyisen `ProjectLoop`in UI-projektio.
- Loop Engineering on nykyinen selected-Loop-only Level 2.
- `ProjectWorkLoopNode` säilyy Loop Engineeringin sisäisenä Work/Validation-kompositiona.
- `LoopOrchestrator` on graphin control-node ja runtime-palvelu, ei `ProjectLoop`.
- Graph omistaa kaikki peer-suhteet ja sallitut route-candidate-yhteydet.
- LoopNode ei nimeä peer Loopia, seuraavaa Loopia tai repair-targetia.
- Platform toteuttaa vain geneeriset graph-, capability-, orchestration-, snapshot-, state- ja continuation-primitiveet.
- Arc42-, UI-, implementation- ja deploy-Loopien nimet, tehtävät ja capabilityt ovat project-local dataa.

## UI-raja

- Poista Context kokonaan.
- Käyttäjälle näkyvät nimet ovat täsmälleen `Graph Engineering` ja `Loop Engineering`.
- Säilytä Loop Engineeringin nykyinen Level 2 -canvas mahdollisimman muuttumattomana.
- Käytä vain `DESIGN.md`-tokenien mukaista cyber-industrial-tyyliä.
- Älä käytä error-väriä Orchestratorin normaalina brändivärinä.
- Älä sekoita Graph Engineeringin LoopNodeja ja Loop Engineeringin sisäisiä WorkLoopNodeja samalle canvasille.
- Canvasin pitää kuvata oikeaa runtime-semanttiikkaa; älä piirrä fake-orchestrationia.

## Valmis työ

- Domain, strict schema, snapshot, runtime, API, UI, dokumentaatio ja testit ovat keskenään yhdenmukaiset.
- Legacy Context -koodia tai numeric level -reittejä ei jää.
- Raportoi jokainen ajettu komento ja sen tulos.
- Jos tarkistusta ei voi ajaa, ilmoita täsmällinen komento, este ja vaikutus.

Toteuta hyväksytyn ADR-018:n mukainen Vaihe 5: Graph Engineering -canvas. Context on jo poistettu ja kaksi typed authoring-näkymää ovat käytössä. Loop Engineeringin selected-Loop-only canvasia ei saa rikkoa.

Lue ennen muutoksia:

- `AGENTS.md`, `frontend/AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`
- `.ballet/goals/goal-012-graph-ja-loop-engineering.md`
- `.ballet/adr/adr-018-graph-ja-loop-engineering.md`
- relevantit `.ballet/arc42/**`-dokumentit ja initiative evidence
- `frontend/src/workspace/automation/LoopEngineerShell.tsx`
- `frontend/src/workspace/automation/AutomationView.tsx`
- Graph Engineeringin projection-, layout-, canvas- ja inspector-moduulit
- Loop Engineeringin nykyinen canvas, theme- ja smart-edge-primitive
- runtime/API DTO:t, joiden perusteella canonical config ja live Run -evidenssi projisoidaan
- nykyiset projection-, layout-, keyboard-, accessibility- ja browser-testit

Graph Engineeringin pitää näyttää:

- täsmälleen yksi `LoopOrchestrator` control-node;
- täsmälleen yksi Graph Engineeringin `LoopNode` jokaista `ProjectLoop`ia kohti;
- project-global flow- ja repair-policyt niiden canonical persisted lähteestä;
- live Run -tilat vain authoritative snapshot/runtime-evidenssistä.

Graph Engineering ei saa näyttää Loop Engineeringin sisäisiä `ProjectWorkLoopNode`-, Work- tai Validation-nodeja. Älä luo uutta runtime-entiteettiä tai clientin rinnakkaista topology statea.

LoopNode näyttää korkeintaan:

- nimen;
- yhden rivin vastuun;
- capability-yhteenvedon;
- sisäisten WorkLoopNodejen määrän;
- module/provenance-statuksen;
- live Run -tilan.

LoopNode:n valinta avaa Loop inspectorin. Enter tai double-click avaa Loop Engineeringin. Orchestrator-noden valinta avaa nykyisen Orchestrator-editorin inspectorissa. Orchestrator ei saa olla vain inspector-tabissa.

Käytä nykyisen Loop Engineeringin cyber-industrial-tyyliä ja `DESIGN.md`-tokeneita:

- tracked LoopTheme;
- 24px-gridi;
- deterministic layout;
- smart routed 1.5px path -viivat;
- explicit edge-labelit;
- nykyiset typography-, spacing- ja radius-tokenit;
- Orchestrator-node käyttää primary/secondary/tertiary-tokeneita;
- error-väriä käytetään vain aidossa failed/blocked/invalid-tilassa;
- ei ad hoc -värejä, gradientteja tai uutta shape-kieltä.

Graphin edge-visualisoinnin pitää olla totuudenmukainen projektio:

- `ProjectLoopEdge(kind=flow)` näkyy normal dispatch policy -semantiikkana;
- `ProjectLoopEdge(kind=repair)` näkyy escalation/repair policy -semantiikkana;
- live ControlFlowEvent/Route voi korostaa toteutunutta canonical routea;
- visualisointi ei kirjoita uutta edgeä tai muuta topology statea;
- inspector ja accessible description näyttävät lähde-, kohde-, kind- ja capability-semanttiikan täsmällisesti;
- fake route-edgejä ei piirretä.

Graph-canvasin suositeltu semanttinen projektiomalli:

```text
ProjectLoop                  -> GraphLoopNode
ProjectLoopOrchestrator      -> GraphOrchestratorNode
ProjectLoopEdge(kind=flow)   -> allowed normal dispatch policy
ProjectLoopEdge(kind=repair) -> allowed escalation/repair policy
live ControlFlowEvent/Route  -> highlighted actual route
```

Visuaalisen hubin ei tarvitse tallentaa uusia edgejä. Se voi johtaa Orchestratorin kautta control-segmentit canonical source->target-route-policysta, kun inspector ja accessible description säilyttävät täsmällisen lähde-kohde-semanttiikan.

Näytä selkeästi dispatch, completion ja escalation ilman edge-spagettia. Valitun LoopNoden inspectorissa näytetään täsmälliset allowed flow- ja repair-candidates sekä niiden capability-/allowlist-evidenssi. Aktiivisessa Runissa korosta canonical route ja nykyinen Orchestrator/LoopNode ilman jatkuvaa dekoratiivista animaatiota.

Narrow viewportilla käytä saavutettavaa Sheet-inspectoria ja vähintään 40px kosketuskontrolleja. Kaikilla nodeilla ja edge-labelilla pitää olla keyboard/focus/ARIA-semantics. Tekstit eivät saa mennä päällekkäin tai ulos parentista.

Säilytä Loop Engineering:

- selected-Loop-only Work/Validation-canvas;
- nykyinen editori, inspector, panning, edge-routing ja theme;
- dirty/save-lockit;
- active Run -lukitus;
- narrow viewport -sheet;
- nykyiset layout- ja visual-regressiot.

Lisää tai päivitä pure projection/layout-testit sekä UI/browser-testit vähintään:

1. yksi Orchestrator-node näkyy;
2. yksi LoopNode näkyy jokaista ProjectLoopia kohti;
3. sisäiset Work/Validation-nodet eivät vuoda graphiin;
4. Orchestratorin valinta avaa inspectorin;
5. LoopNode:n Enter/double-click avaa oikean Loop Engineering -näkymän;
6. control-edget johdetaan canonical persisted policyistä;
7. fake client topology statea ei synny;
8. capability mismatch tai allowlistin ulkopuolinen route näkyy rejected/blocked-evidenssinä eikä hyväksyttynä reittinä;
9. active Run korostaa vain canonical runtime-routea;
10. keyboard, ARIA, narrow viewport ja Sheet toimivat;
11. Loop Engineeringin nykyiset regressiotestit säilyvät vihreinä.

Aja ensin kapea projection/layout/UI-testi. Korjaa samaa slicea ja aja testi uudelleen ennen laajentamista. Aja sen jälkeen `npm run test`, `npm run lint`, `npm run build` ja `git diff --check`. Ota desktop- ja narrow viewport -kuvat olemassa olevan browser-verification-käytännön mukaisesti ja raportoi niiden polut.

Älä lisää fake orchestrationia, uusia ad hoc -värejä, uusia runtime-entiteettejä tai project-workflow-tunnisteita platform-koodiin. Raportoi muutetut tiedostot, projection-lähteet, UI-testit, screenshot-polut, tulokset ja jäljelle jäävät riskit.
````
