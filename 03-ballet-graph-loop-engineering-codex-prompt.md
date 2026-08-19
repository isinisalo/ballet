# Vaihe 3 - LoopOrchestratorin cross-Loop-dispatch

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

Toteuta hyväksytyn ADR-018:n mukainen Vaihe 3: yleistä LoopOrchestrator repair-routerista project-global cross-Loop-dispatcheriksi. Älä muuta frontendin UI:ta.

Lue ennen muutoksia:

- `AGENTS.md`, `ARCHITECTURE.md`
- `.ballet/goals/goal-012-graph-ja-loop-engineering.md`
- `.ballet/adr/adr-015-work-loop-state-ja-loop-orchestrator.md`
- `.ballet/adr/adr-018-graph-ja-loop-engineering.md`
- `.ballet/project.json` ja v11 strict schema
- `backend/runtime/LoopOrchestrator.ts`
- `backend/runtime/LoopCompletionEngine.ts`
- runtime-, persistence-, snapshot-, execution- ja recovery-moduulit
- `backend/automation/validateAutomationConfig.ts`
- `.ballet/instructions/loop-orchestrator.md`
- nykyiset LoopOrchestrator-, completion-, persistence-, recovery- ja integration-testit

Säilytä nykyinen `RepairRequest`, call frame, State revision, continuation ja paluu samaan caller Validationiin. Repair-escalationissa Validation ilmaisee vain requested capabilityn tai requested outcomen. Se ei nimeä target Loopia, edgeä, continuationia tai oikeuksia.

Lisää normaalia flow'ta varten persisted orchestration request/control-flow -polku, joka syntyy onnistuneen top-level Loop invocationin jälkeen, kun snapshotissa on outgoing flow candidateja. Poista automaattinen `LoopCompletionEngine.followFlow` -ohituspolku vasta, kun uusi persisted Orchestrator-polku on toteutettu ja testattu.

Semantiikka:

- 0 sallittua outgoing flow candidatea -> Root Run completed;
- 1 sallittu candidate -> persisted Orchestrator request, Orchestrator valitsee targetin ja runtime käynnistää sen;
- useampi sallittu candidate -> Orchestrator valitsee täsmälleen yhden;
- ambiguity -> `needs_input`, eikä yksikään target käynnisty eikä first-match-fallbackia käytetä;
- flow ei luo repair-framea eikä palaa caller Validationiin;
- repair luo yhden call framen ja targetin completion sulkee framen sekä ajaa callerin saman Validationin uudelleen;
- targetin mahdollinen oma flow ei käynnisty repair-callen aikana;
- Root Run käyttää alkuperäisen snapshotin immutablea graph-allowlistaa;
- runtime ratkaisee canonical edge ID:n eikä executor tai provider saa kirjoittaa sitä vapaasti.

Orchestrator-task envelope sisältää vain bounded, provider-neutraalin päätökseen tarvittavan datan:

- request kind: normal flow tai repair;
- source Loop ja source invocation;
- current State revision;
- bounded completion evidence/outcome;
- snapshotin sallitut candidate Loopit capability-metadatalla;
- tarvittava request capability tai expected outcome.

Executor saa ehdottaa vain target Loop ID:tä, route reasonia, bounded dispatch inputia ja expected outcomea. Runtime ratkaisee canonical edgen ja validoi source/target/kind/capabilityn sekä snapshot-allowlistin. Unknown target, target allowlistin ulkopuolelta, väärä edge-kind, source mismatch tai capability mismatch hylätään fail-closed.

Poista `.ballet/instructions/loop-orchestrator.md`-tiedostosta project-local hardcoded capability map ja tee instructionista generic, data-driven ja candidate-envelopeen perustuva. Orchestrator ei saa myöntää oikeuksia. Permission request ilman authorized human-gated targetia päätyy `needs_input`- tai `blocked`-tilaan eikä muuta permission statea.

Persistoi route-evidenssi ja canonical orchestration state niin, että restart/recovery ei luo duplicate target runia. Säilytä depth-, attempt-, transition- ja cancellation-rajat. Älä lisää project-workflow-tunnisteita backend-, frontend- tai shared-platform-koodiin.

Lisää tai päivitä runtime- ja negative-testit vähintään:

1. completed Loop + 0 outgoing flow candidatea -> Root Run completed;
2. completed Loop + 1 candidate -> Orchestrator Node Run -> target Loop Run;
3. completed Loop + useita allowed candidateja -> Orchestrator valitsee yhden;
4. ambiguous model outcome -> `needs_input`, ei target runia;
5. selected target flow-allowlistin ulkopuolella -> rejected;
6. selected target ilman required capabilityä -> rejected;
7. `ORCHESTRATOR_REPAIR` ei sisällä `targetLoopId`-kenttää Validation-outcomessa;
8. repair target completes -> callerin sama Validation suoritetaan uudelleen;
9. permission request ilman authorized targetia -> `needs_input`/`blocked`, ei permission mutationia;
10. persisted/restarted run jatkaa canonical orchestration state -kohdasta ilman duplicate target runia.

Aja ensin kapea LoopOrchestrator/completion-testi. Jos se epäonnistuu, korjaa samaa runtime-säiettä ja aja sama testi uudelleen ennen laajentamista. Aja sen jälkeen relevantit runtime-, persistence-, recovery- ja integration-testit, `npm run test`, `npm run lint`, `npm run build` ja `git diff --check`.

Älä tee UI-muutoksia. Raportoi normal flow- ja repair-semanttien erot, muutetut persistence/runtime-tiedostot, testit, tulokset, mahdolliset blockerit ja vahvistus siitä, että Validation/LoopNode ei nimeä targetia.
````
