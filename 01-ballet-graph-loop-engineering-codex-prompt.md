# Vaihe 1 - Päätökset ja muutosraja

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

Toteuta vain Vaihe 1: Graph Engineering / Loop Engineering -muutoksen päätökset ja muutosraja. Älä muuta tuotantokoodia, runtimea, schemaa, API-sopimuksia, `.ballet/project.json`-tiedostoa tai frontendin toteutusta.

Aja ensin `git status --short`. Työpuussa on käyttäjän tekemä `.ballet/goals/goal-012-graph-ja-loop-engineering.md`; lue ja säilytä se. Älä poista, palauta tai ylikirjoita käyttäjän muutoksia. Jos goal-012 on jo vaatimusten mukainen, jätä se ennalleen.

Lue ennen muokkauksia:
- `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`
- `.ballet/project.json`
- `.ballet/goals/goal-011-loop-engineer-kolmitasoinen-canvas.md`
- `.ballet/goals/goal-012-graph-ja-loop-engineering.md`
- `.ballet/goals/summary.md`
- `.ballet/adr/adr-015-work-loop-state-ja-loop-orchestrator.md`
- `.ballet/adr/adr-017-loop-engineer-authoring-projektiot.md`
- `.ballet/arc42/README.md`, `STATUS.md`, `TRACEABILITY.md` ja `09-architecture-decisions.md`
- `.ballet/arc42/initiatives/TEMPLATE/BRIEF.md`, `PLAN.md`, `EVIDENCE.md` ja `REVIEW.md`
- nykyinen `loop-engineer-three-level-canvas`-initiative

Käsittele käyttäjän hyväksyminä päätöksinä:

- authoring-näkymiä on täsmälleen kaksi: `Graph Engineering` ja `Loop Engineering`;
- Graph Engineering on oletusnäkymä;
- Loop Engineering säilyttää nykyisen selected-Loop-only Work/Validation-editorin;
- Context poistetaan myöhemmässä toteutusvaiheessa;
- yksi `ProjectLoop` projisoidaan yhdeksi Graph Engineeringin `LoopNode`-näkymänodoksi;
- `LoopNode` ei ole uusi runtime-entiteetti;
- `ProjectWorkLoopNode` säilyy Loop Engineeringin sisäisenä kompositiona;
- `LoopOrchestrator` näkyy Graph Engineeringissä omana control-nodena;
- graph on `ProjectAutomationConfig`-aggregaatin project-global projektio;
- Graph Engineering ei näytä sisäisiä Work/Validation-nodeja;
- Loop Engineering näyttää vain valitun Loopin sisäisen rakenteen;
- graph omistaa flow- ja repair-allowlistat;
- LoopOrchestrator omistaa kaikki cross-Loop-valinnat;
- LoopNode, Validation, task, instruction, skill, State-contract tai module package ei saa nimetä peer-Loopia tai targetia;
- reitit validoidaan immutable Root Run snapshotin allowlistaa ja capabilityä vasten;
- ambiguity ja ihmisvaltuutusta vaativa reitti pysähtyy `needs_input`-tilaan;
- permission escalation ei myönnä oikeuksia automaattisesti;
- platform-koodiin ei kovakoodata project-workflow'ta;
- release, deploy, merge ja push vaativat täsmällisen ihmisvaltuutuksen.

Luo seuraava vapaa ADR:

`.ballet/adr/adr-018-graph-ja-loop-engineering.md`

ADR-018:n pitää olla hyväksytty päätöspaketti ja erottaa WHAT/WHY-päätökset HOW-päätöksistä. Päätä vähintään:

- typed projections/routes ovat `graph | loop`;
- default on Graph Engineering;
- LoopNode on `ProjectLoop`in UI-projektio;
- Orchestrator on config/runtime-primitiveen control-projektio;
- uusi strict project-config-versio on v11;
- v10-parseria, compatibility-lukupolkua, silent defaultteja tai dual-writeä ei jätetä;
- ProjectLoopilla on first-class capability metadata;
- graph sisältää project-global flow- ja repair-allowlistat;
- Root Run voi V1:ssä alkaa eksplisiittisesti valitusta entry Loopista;
- repair palaa samaan caller Validationiin ja käyttää call frame -jatkumoa;
- flow ei luo repair-framea;
- nolla outgoing flow candidatea päättää Root Runin;
- yksi tai useampi flow candidate kulkee Orchestratorin kautta;
- ambiguity tuottaa `needs_input`-tilan;
- Graph UI:n control-edget ovat persisted route-policyn ja runtime-evidenssin projektio, eivät clientin uusi topology state;
- myöhemmät kanoniset UI-reitit ovat `/automation/loops?view=graph` ja `/automation/loops?view=loop&id=<loop-id>`.

ADR-018:n pitää kuvata osittainen supersession:

- goal-011:n ja adr-017:n Context/Level 0, numeric-level-reitit ja vanha `context | composition | detail` -malli korvautuvat;
- vanha Level 1 composition -näkymä korvautuu Graph Engineeringillä;
- selected-Loop-only Level 2 -käyttäytyminen ja sisäisten edgejen omistajuus säilyvät Loop Engineeringissä;
- adr-015:n automaattinen yhden flow-edgen `followFlow`-semantiikka korvautuu myöhemmin Orchestrator-dispatchilla;
- adr-015:n repair-, State revision-, retry-, depth- ja continuation-periaatteet säilyvät;
- historiallisia Goal- tai ADR-tiedostoja ei kirjoiteta uudelleen eikä poisteta.

Luo initiative kopioimalla `.ballet/arc42/initiatives/TEMPLATE/` polkuun `.ballet/arc42/initiatives/graph-and-loop-engineering/`. Luo `BRIEF.md`, `PLAN.md`, `EVIDENCE.md` ja `REVIEW.md`, jokaiselle oma vakaa ID, status `draft`.

BRIEF kuvaa Fact/Decision, ownerin, stakeholderit, scope/non-goals, rajoitteet, acceptance intentin ja avoimet kysymykset. PLAN jakaa myöhemmän työn domain/schema/capability-, snapshot/persistence/module-, runtime-orchestration-, Context-poisto-, Graph UI-, Loop UI-, project-local Loop library- ja verification-vaiheisiin. EVIDENCE ei saa väittää tulevaa toteutusta verified-tilaan. REVIEW jää draftiksi.

Päivitä tarvittaessa kanoniset `ARCHITECTURE.md`, `.ballet/arc42/**`-osiot, `09-architecture-decisions.md`, `TRACEABILITY.md`, `STATUS.md`, `DESIGN.md` ja `.ballet/goals/summary.md`. Kuvaa uusi kaksinäkymäinen tavoite, mutta erottele nykyinen toteutettu strict-v10-baseline tulevasta v11-targetista. Älä väitä runtimea tai UI:ta toteutetuksi.

Älä muuta tässä vaiheessa backend-, frontend- tai shared-tuotantokoodia, validaattoreita, `.ballet/project.json`-tiedostoa, module materializationia tai runtime-testejä. Älä vielä poista Context-koodia.

Aja lopuksi:

```bash
npm run validate:arc42
git diff --check
```

Aja lisäksi `npx @google/design.md lint DESIGN.md`, jos se on saatavilla ilman tunnistautumista. Korjaa vain tämän vaiheen dokumentaatio- tai stable-ID-virheet. Jos validatori vaatii myöhemmän toteutusvaiheen muutoksia, raportoi blocker äläkä kierrä sääntöä.

Raportoi luodut ja päivitetyt tiedostot, säilytetty goal-012, Goal/ADR-numerot, supersede-rajat, päätökset, komennot ja tulokset, blockerit, riskit sekä vahvistus siitä, ettei tuotantokoodia, runtimea, schemaa, API-sopimuksia, `.ballet/project.json`-tiedostoa tai frontendin toteutusta muutettu.
````
