# Vaihe 4 - Contextin poisto ja kaksinäkymäinen UI

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

Toteuta hyväksytyn ADR-018:n mukainen Vaihe 4: frontendin informaatioarkkitehtuuri kahteen authoring-näkymään. Runtime- ja schema-semanttiikan pitää olla jo Vaiheen 2 ja 3 mukainen. Säilytä Loop Engineeringin nykyinen selected-Loop-only editori mahdollisimman muuttumattomana.

Lue ennen muutoksia:

- `AGENTS.md`, `frontend/AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`
- `.ballet/goals/goal-012-graph-ja-loop-engineering.md`
- `.ballet/adr/adr-017-loop-engineer-authoring-projektiot.md`
- `.ballet/adr/adr-018-graph-ja-loop-engineering.md`
- frontendin routing-, projection- ja UI-testit
- `frontend/src/workspace/types.ts`
- `frontend/src/workspace/routing.ts`
- `frontend/src/workspace/automation/LoopEngineerShell.tsx`
- `frontend/src/workspace/automation/AutomationView.tsx`
- `frontend/src/workspace/automation/loops/LoopContextCanvas.tsx`
- `frontend/src/workspace/automation/loops/LoopCompositionWorkspace.tsx`
- `frontend/src/workspace/automation/loops/LoopCompositionCanvas.tsx`
- `frontend/src/workspace/automation/loops/LoopEditor.tsx`

Korvaa `LoopEngineerLevel = context | composition | detail` semanttisella typed-mallilla `graph | loop`. Kanoniset reitit ovat:

- `/automation/loops?view=graph`
- `/automation/loops?view=loop&id=<loop-id>`
- uuden Loopin authoring-polku `view=loop`-mallin alla.

Paljas `/automation/loops` ratkaistaan Graph Engineeringiksi.

Poista frontendin tuotantokoodista kokonaan:

- Context-canvas;
- Context-projection ja sen builderit;
- `automationContextPath`;
- `level=context`;
- numeric `level=1` ja `level=2` route/state/copy-polut;
- `context | composition | detail` compatibility-aliakset;
- Context-default;
- Context-navigation item ja Context-copy;
- Context-fixtures ja Context-branchit;
- vanhat `view=all`- tai vastaavat legacy-reitit, jos niitä vielä on.

Poista `LoopContextCanvas.tsx` ja vastaavat Context-legacy-tiedostot vain, kun kaikki importit, testit ja route-polut on korvattu tai poistettu. Älä jätä compatibility-polkuja.

Käyttäjälle näkyvät nimet ovat täsmälleen `Graph Engineering` ja `Loop Engineering`. Poista käyttäjärajapinnasta Level 0/1/2 -terminologia. Historiallisissa päätös- ja auditointidokumenteissa supersession-viittaukset voivat säilyä.

Graph Engineeringin projection saa tässä vaiheessa käyttää project-global graph projectionia, mutta älä vielä viimeistele Vaiheen 5 visuaalista Orchestrator-nodea. Loop Engineeringin pitää säilyttää:

- selected-Loop-only Work/Validation-kompositio;
- nykyinen LoopEditor/canvas-käyttäytyminen;
- tracked theme;
- panning ja smart edge routing;
- inspector ja sheet-malli;
- dirty/save-validointi;
- active Run -lukitus;
- keyboard, focus ja aria-semantics.

URL on aktiivisen näkymän source of truth. Toteuta browser back/forward, deep link, keyboard/focus, aria ja narrow viewport ilman rinnakkaista client-state-reititystä.

Renameaa vanhoja `composition`-nimisiä moduuleja vain, jos terminologia ylläpitää väärää käsitemallia tai näkyy tuotantorajapinnassa.

Suositeltavat rename-ankkurit:

```text
LoopCompositionWorkspace -> GraphEngineeringWorkspace
LoopCompositionCanvas    -> GraphEngineeringCanvas
LoopCompositionProjection -> GraphEngineeringProjection
LoopDetailProjection     -> LoopEngineeringProjection
```

Rename ei ole itseisarvo. Tee se, jos vanha `composition`/`level`-terminologia muuten jää näkyväksi tai ylläpitää rinnakkaista käsitemallia.

Lisää tai päivitä routing-, projection- ja UI-testit vähintään:

1. vain `graph | loop`-reitit hyväksytään;
2. paljas route avaa Graph Engineeringin;
3. Graph -> Loop deep link käyttää valitun Loopin ID:tä;
4. browser back/forward palauttaa oikean näkymän;
5. LoopNode avaa inspectorin ja Enter/double-click avaa Loop Engineeringin;
6. Context- ja numeric-level-tuotantokoodia ei löydy;
7. Loop Engineering ei näytä project-global graphia;
8. aktiivisen Runin dirty/save-lock säilyy;
9. narrow viewport ja keyboard/ARIA-käyttäytyminen toimivat.

Aja ensin kapea routing/projection-testi. Korjaa samaa slicea ja aja sama testi uudelleen ennen laajentamista. Aja sitten relevantit UI-testit, `npm run lint`, `npm run build`, `npm run test` ja `git diff --check`.

Älä vielä viimeistele Graph Engineeringin Orchestrator-nodea, layoutia tai visuaalista edge-presentationia. Raportoi poistetut Context-legacy-tiedostot ja route-polut, säilytetyt Loop Engineering -invariantit, testikomennot ja tulokset.
````
