# Work Loop v10 — migraatio- ja toteutussuunnitelma

Tila: vaihe 1 (v10-domain, strict config ja graph-invariantit) on toteutettu. Vaiheet 2–8 ovat vielä toteutussuunnitelmaa; v10-runtime on siihen asti tarkoituksella fail-closed.

Päätöslähde: [ADR-015 — Work Loop, revisioitu State ja Loop Orchestrator](../../adr/adr-015-work-loop-state-ja-loop-orchestrator.md).

## Tavoite ja rajaus

Toteutus korvaa strict-v9:n Loop/Step/Approved/Rejected/terminal-node-mallin strict-v10 Work Loop -mallilla. Lopputilassa platformissa ovat vain geneeriset Loop-, WorkLoopNode-, WorkNode-, ValidationNode-, State-, Edge-, LoopEdge-, RepairRequest- ja LoopOrchestrator-primitivit sekä niiden tarvitsemat provider-neutraalit execution-, Root Run-, schedule- ja persistence-rajat.

Toteutus ei:

- kovakoodaa roadmap-, milestone-, issue-, acceptance-, release-, deploy- tai muuta project-workflow'ta;
- lisää suoraa OpenAI API -riippuvuutta tai lukitse runtimea GPT-5.6-sol-malliin;
- säilytä v9-readeria, v9/v10-dual-writea, terminal-node compatibility -projektiota tai Step-pohjaista rinnakkaisruntimea lopputuloksessa;
- migroi `.ballet/project.json`-tiedostoa tai local SQLite -historiaa automaattisesti; eikä
- tallenna tai näytä providerin piilotettua chain-of-thoughtia.

Vaiheet 1–8 ovat yhden hard-cut-kokonaisuuden toteutusjärjestys. V10:ä ei julkaista ennen vaiheen 8 täyttä porttia. Jos uuden mallin tyyppejä tai tauluja joudutaan lisäämään ennen cutoveria, ne pidetään rajattuina toteutushaaran välivaiheina ja v9-polku poistetaan samassa kokonaisuudessa; rinnakkaista mallia ei hyväksytä lopputulokseksi.

## Nykytilan toteutuskartta

### Domain ja strict-v9-schema

| Vastuu | Nykyinen lähde |
| --- | --- |
| `ProjectLoop`, executable Stepit, terminal nodet, siirtymähelperit ja schedule-tyypit | `shared/domain/automation.ts` |
| Strict project config v9 ja ExecutionProfile | `shared/domain/projectConfig.ts` |
| `RootExecutionSnapshot`, `LoopRun`, `StepRun`, `StepOutcome`, ExecutionTask | `shared/domain/runtime.ts` |
| Root Run API/read model | `shared/domain/runs.ts` |
| Strict Zod-skeemat ja viitevalidointi | `shared/api/workspace-schemas.ts`, `shared/api/runtime-schemas.ts` |
| Frontend/backend barrel | `shared/api/workspace-contracts.ts` |
| Semanttinen Loop/Transition/resource-validointi | `backend/automation/validateAutomationConfig.ts` |
| Atomic project.json reader/writer ja v9 version cut | `backend/project-config/ProjectConfigurationRepository.ts` |

### Snapshot, runtime ja provider-sopimukset

| Vastuu | Nykyinen lähde |
| --- | --- |
| Saavutettavien Loopien ja execution-Steppien traversal | `backend/runs/LoopExecutionSnapshot.ts` |
| Immutable snapshotin, resurssien ja runtime-bindingien suunnittelu | `backend/runs/LoopExecutionPlanner.ts` |
| Root Run lifecycle, enqueue, terminal task reconciliation ja recovery | `backend/runs/RootRunExecutionCoordinator.ts`, `backend/runs/LocalRunService.ts` |
| Step/Transition-tilakone | `backend/runtime/LoopRunEngine.ts` |
| LoopRun/StepRun persistence | `backend/runtime/LoopRunStore.ts` |
| Result-integrity ja non-completed outcome -polut | `backend/runtime/LoopRunTransitionPolicy.ts`, `backend/runtime/LoopRunOutcomePersistence.ts` |
| Snapshotin runtime-luku | `backend/runtime/RootExecutionSnapshotStore.ts` |
| Provider-tehtävän durable spec/outcome/events | `backend/execution/ExecutionStore.ts`, `backend/execution/ExecutionTaskStateStore.ts` |
| Prompt composition ja System contract | `backend/execution/ExecutionComposition.ts`, `backend/execution/SystemExecutionContract.ts` |
| Exact task envelope ja recent Step history | `backend/integration/TaskEnvelopeV1.ts`, `backend/integration/LoopStepPrompt.ts` |
| Structured JSON parse ja JSON-schema-validointi | `backend/execution/providers/structuredOutput.ts` |

### Persistenssi

SQLite schema v3 on tiedostossa `backend/storage/LocalDatabase.ts`. Nykyiset taulut ovat `root_runs`, `loop_runs`, `step_runs`, `execution_tasks`, `execution_events`, `loop_schedule_state` ja `metadata`. `idx_loop_runs_one_active` estää saman Loop-ID:n sisäkkäiset invocationit. Root snapshot ja ExecutionTask spec on suojattu immutable-triggerillä.

### API ja käyttöliittymä

| Vastuu | Nykyinen lähde |
| --- | --- |
| `/api/automation`, `/api/runs` ja Step response -reitit | `backend/http/apiRouter.ts` |
| Frontend API-clientit | `frontend/src/api.ts`, `frontend/src/workspace/runs/runApi.ts` |
| Configure-draft ja Loop editor | `frontend/src/workspace/automation/useAutomationDraft.ts`, `frontend/src/workspace/automation/AutomationView.tsx`, `frontend/src/workspace/automation/loops/LoopEditor.tsx` |
| Step/node editor ja Transition-kontrollit | `frontend/src/workspace/automation/loops/LoopStepSheetEditor.tsx`, `LoopStepFields.tsx`, `LoopTransitionsEditor.tsx`, `StepCompositionFields.tsx` |
| Configure/Run graph projection | `frontend/src/workspace/automation/loops/loopVisualProjection.ts`, `loopGraph.ts`, `loopLayout*.ts`, `LoopCanvas.tsx` |
| Run snapshot, sheet ja human/needs-input response | `frontend/src/workspace/automation/loops/LoopRunView.tsx`, `LoopRunStepSheet.tsx`, `StepResponsePanel.tsx` |
| Run overview/read projection | `frontend/src/workspace/runs/*`, `backend/runs/RunReadProjection.ts` |

### Testit ja fixturet

Nykyisen v9-käyttäytymisen tärkeimmät testiryhmät ovat:

- schema/repository: `backend/tests/projectConfigSchema.test.ts`, `projectConfigurationRepository.test.ts`, `automation.test.ts`, `automationSchedule*.test.ts`;
- snapshot/planner: `backend/runs/LoopExecutionSnapshot.test.ts`, `LoopExecutionPlanner.test.ts`;
- runtime/transaktiot: `backend/tests/runtime.test.ts`, `runtimeScheduled.test.ts`, `backend/runs/*persistence.test.ts`;
- prompt/output: `backend/integration/LoopStepPrompt.test.ts`, `backend/execution/tests/structuredOutput.test.ts`, `ExecutionComposition*.test.ts`;
- SQLite: `backend/storage/LocalDatabase.test.ts`;
- Configure/Run UI: `frontend/tests/loopEditor*.test.tsx`, `loopVisualCanvas.test.ts`, `loopRun*.test.tsx`, `automation-ui.test.tsx`;
- tracked data conversion: `backend/tests/repositoryV9Conversion.test.ts`; ja
- release fixture: `.fixture-ballet-project/.ballet/project.json` sekä `scripts/build-release.sh`-polun smoke test.

## Toteutusperiaatteet kaikille vaiheille

1. Root Run snapshot on immutable ja sisältää kaikki Edgellä tai LoopEdgellä saavutettavat v10-Loopit, ExecutionProfilet, resurssit, runtime-bindingit ja theme-snapshotin.
2. Root Run on Staten ainoa omistaja. State ei jakaudu Loop- tai Node-kohtaisiin mutableihin kopioihin.
3. Canonical NodeOutcome, mahdollinen State patch ja control-flow-event committoidaan yhdessä transaktiossa.
4. Provider-taskin raw/normalized terminal payload on evidenssiä. Se ei ole toinen control-flow-lähde.
5. Root Runin sisällä on yksi aktiivinen cursor. Eri Root Runit voivat käyttää nykyisiä provider-kohtaisia FIFO-kaistoja.
6. Kaikki output-, State-, patch-, route- ja ID-rajat validoidaan shared-skeemoilla ja backendin semanttisella validoinnilla fail-closed.
7. V10-projektidata on project-local. Platform-testit käyttävät geneerisiä tunnisteita eivätkä Ballet-repositoryn toimitusworkflow'n nimiä.
8. Jokainen poistettu v9-käsite poistetaan myös DTO:ista, API-reiteistä, fixtureistä, testeistä, UI-copyista ja dokumentaatiosta.

## Vaihe 1 — v10-domain, strict config ja graph-invariantit

Tavoite: määritellä yksi kanoninen Work Loop -authoring-malli ja strict-v10-reader ilman runtime-semantiikan kopioita.

Tila: toteutettu tässä vaiheessa. Runtime-persistenssiä tai Work Loop -tilakonetta ei ole toteutettu.

| Alue | Vaikutus |
| --- | --- |
| Domain | Korvaa `shared/domain/automation.ts`-tiedoston Step/terminal-node-tyypit `ProjectLoop`, `ProjectWorkLoopNode`, `ProjectWorkNode`, `ProjectValidationNode`, `ProjectNodeEdge`, `ProjectLoopEdge`, `ProjectLoopOrchestrator` ja Work Node -schedule-tyypeillä. Lisää authoring Staten `JsonValue`-tyyppi; StatePatch-, WorkOutcome-, ValidationOutcome- ja RepairRequest-runtime-sopimukset lisätään vaiheissa 2–3. `ExecutionProfile` säilyy. |
| Backend | Kirjoita `validateAutomationConfig` uudelleen tarkistamaan `startNodeId`, node/edge-referenssit, reachable-nodet ja terminal target, `flow | repair` -endpointit, self-routing, outgoing cardinality, scheduled-rajoitus ja execution-resource-viitteet. Repositoryn `load` hyväksyy vain version 10 ja antaa versiosta 9 täsmällisen `invalid_schema`-virheen. |
| Persistence | Ei vielä muuta runtime-tauluja. Määritä persistence-DTO:t ja schema version 4 -taulujen sarakkeet vaihetta 2 varten. |
| API | `automationConfigSchema` ja `/api/automation` käyttävät v10-shapea. Unknown/v9-kentät hylätään. API:n error payload säilyttää `invalid_schema`, pathin ja tarkan viestin. |
| Frontend | Päivitä contract-barrel ja draft-validointi kääntymään v10-tyypeillä. Täysi editori tehdään vaiheessa 6; väliaikainen pinta saa vain näyttää validin v10-datan read-onlyna tai explicit unsupported-editor-statea, ei luoda v9-dataa. |
| Fixturet | Muunna `.fixture-ballet-project/.ballet/project.json` strict-v10:een. Lisää pienet geneeriset v10-schema-fixturet: normaali chain, local self-cycle, flow-self-edge, repair-self-edge ja invalidit endpointit. Älä vielä muuta repositoryn tracked `.ballet/project.json`-workflow'ta ilman hyväksyttyä mappingia. |
| Testit | Uudet schema/unit-testit kaikille strict-kentille, ID:ille, description-rajoille, executor-unioneille, duplicate/reachable/cardinality-invarianteille ja v9 hard-cut -virheelle. Poista testeistä oletus, että terminaleja on aina kolme. |
| Dokumentaatio | Lisää v10 data model -dokumentti tarvittaessa tämän ADR:n pohjalta. README ja DESIGN päivitetään vasta cutoverissa, jotta ne eivät väitä puolivalmista runtimea valmiiksi. |

Toteutusjärjestys:

1. Erota JSON-arvot ja myöhemmin toteutettavat patch-tyypit automaatiograafista.
2. Määritä Work ja Validation strict discriminated unioneina; human-tyyppi kieltää profile/resource-kentät ja scheduled kuuluu vain Work-unioniin.
3. Määritä Work ja Validation erillisiksi tyypeiksi, vaikka niiden executor-rakenne on yhteinen.
4. Määritä `ProjectLoopEdge` vakaalla ID:llä, source/target Loop -ID:illä, non-empty descriptionilla ja `flow | repair` -kindillä. Repair-edget muodostavat source-Loop-kohtaisen Orchestrator-allowlistin.
5. Toteuta rakenteellinen Zod-validointi ennen semanttista graph-validointia.
6. Normalisoi vain set-semanttiset `skillIds` ja ExecutionProfile-järjestys; älä muuta käyttäjän Loop/node/edge-järjestystä hiljaisesti.
7. Testaa, että `version: 9`, Loop `start`, sekalaiset Step/terminal-nodet, Step `on` sekä v10:n unknown kentät hylätään. Edgen eksplisiittinen `{ terminal }`-target on v10-dataa eikä terminal node.

Vaiheen portti:

- focused domain/schema/repository-testit;
- `npm run lint`;
- `npx tsc -b --force` tai `npm run build`, jos cutover-tyypit ovat jo kaikissa kuluttajissa; ja
- `git diff --check`.

## Vaihe 2 — SQLite schema v4 ja atominen State

Tavoite: toteuttaa Root-owned revisioned State ja durable orchestration-rivit ilman v9-tauluja.

| Alue | Vaikutus |
| --- | --- |
| Domain | Lisää runtime-tyypit `StateRevision`, `LoopInvocation`, `NodeRun`, `ControlFlowEvent`, `CallFrame`, `OrchestratorRoute` ja niiden status-unionit. Runtime käyttää Work/Validation-node-osoitetta, ei Step ID:tä tai resultia. |
| Backend | Korvaa `LoopRunStore` State/Invocation/Node/Frame/Route-storeilla. Toteuta yksi transaction boundary, joka lukee current revisionin, validoi base revisionin, soveltaa patchin kopioon, tarkistaa rajat ja kirjoittaa revision/outcomen/eventin/cursorin. |
| Persistence | Nosta schema versioon 4. Poista `loop_runs`, `step_runs` ja niiden indeksit. Rakenna `state_revisions`, `loop_invocations`, `node_runs`, `repair_requests`, `call_frames`, `orchestrator_routes`, `control_flow_events`; rakenna `root_runs`, `execution_tasks` ja `loop_schedule_state` v10-sarakkeilla. Säilytä FK:t, WAL, FULL sync, busy timeout ja immutable-triggerit. |
| API | Ei vielä uusia mutation-reittejä. Root detail DTO voi saada read-only State/current revision -kentät testattavaa store-projektiota varten. |
| Frontend | Ei visuaalista muutosta; vain shared DTO:n compile-adaptaatio. |
| Fixturet | SQLite-testit luovat revision 0:n, yhden validin patch-revision, invalidin patchin, exact size boundaries ja nested frame -rivit geneerisillä ID:illä. |
| Testit | Testaa 256 KiB State, 64 KiB patch, 128 operaatiota, depth 64, base revision conflict, prototype-pathit, root-object invariantti, hash integrity, rollback jokaisessa forced-failure-kohdassa ja restart viimeisestä commitista. |
| Dokumentaatio | Dokumentoi schema v4:n taulu-/FK-/index-kartta ja local state schema 3 -remediation. Älä lupaa schema 3 Run-history migrationia. |

Taulujen vähimmäisavaimet:

| Taulu | Olennaiset avaimet/invariantit |
| --- | --- |
| `root_runs` | `root_run_id`, immutable snapshot, `current_state_revision`, root status, transition count, active invocation/node, worktree/finalization fields |
| `state_revisions` | `(root_run_id, revision)` PK, parent revision, full `state_json`, `state_sha256`, `patch_json`, source node outcome/control event |
| `loop_invocations` | invocation ID, Root, Loop ID, kind `ROOT \| FLOW \| REPAIR`, status, entry/completion revision |
| `node_runs` | node run ID, invocation, Work Loop Node ID, role `WORK \| VALIDATION`, executor kind, task ID, status, attempt, outcome JSON, base/result revision |
| `repair_requests` | request ID, source node run, revision, mode, payload, selected LoopEdge nullable vain local-modessa |
| `call_frames` | frame ID, parent frame, caller/callee, request/route, return node, depth, status |
| `orchestrator_routes` | route ID, request, snapshot LoopEdge ID, source/target invocation, created/returned timestamps |
| `control_flow_events` | monotonic ID/root sequence, event kind, from/to cursor, state revision, related outcome/request/frame/edge |

Schema-version käytäntö:

- ei-tyhjä schema 3 jätetään koskematta ja startup epäonnistuu tarkalla `Unsupported Ballet state schema 3; expected 4.` -virheellä;
- tyhjä, tunnettu pre-release schema 3 voidaan resetöidä schema 4:ään vain explicit testatulla existing-empty-poikkeuksella;
- tuntematon tai versioimaton tietokanta jätetään muuttamatta; ja
- schema 4 ei sisällä v9-nimisiä compatibility-view'eja.

Vaiheen portti:

- `backend/storage/LocalDatabase.test.ts` ja uudet State/persistence-integration-testit;
- forced rollback- ja reopen-testit;
- `npm run test` persistenceen vaikuttavan muutoksen vuoksi;
- `npm run lint`;
- `npm run build`; ja
- `git diff --check`.

## Vaihe 3 — Task Envelope v2 ja Work/Validation structured output

Tavoite: erottaa Work- ja Validation-provider-sopimukset ja sitoa ne State revisioniin ilman provider-riippuvuutta.

| Alue | Vaikutus |
| --- | --- |
| Domain | `ExecutionTaskKind` erottaa `work_node`- ja `validation_node`-tehtävät tai käyttää yhtä `node_execution`-kindiä exact node role -kentällä. `ExecutionPromptEvidence` tallentaa node rolen ja outcome schema version/hash -arvon. |
| Backend | Korvaa `TaskEnvelopeV1`/`LoopStepPrompt` Envelope v2 -serialisoinnilla. `ExecutionComposition` valitsee WorkOutcome- tai ValidationOutcome-skeeman. `SystemExecutionContract` puhuu Ballet Nodesta, ei Stepistä, ja pitää workflow/CoT-rajat ennallaan. |
| Persistence | `execution_tasks.spec_json` käyttää uutta immutable spec-versiota; vanhaa spec version 2:ta ei lueta schema 4:ssä. Raw terminal output säilyy evidenssinä ennen orchestration-commitia. |
| API | Execution event/console -reitit säilyvät provider-neutraaleina. Julkiset task DTO:t näyttävät node rolen ja schema evidenssin, eivät hidden reasoningia. |
| Frontend | Run composition preview nimeää Work/Validation-roolin ja näyttää exact snapshot resources/prompt hashin; varsinainen Run sheet uudistetaan vaiheessa 7. |
| Fixturet | Lisää exact-byte Envelope v2 fixturet Workille, Validationille, local retrylle, external repairille, human resumelle ja Unicode/size-boundarylle. Provider-adapter-fixturet palauttavat kumpaakin outcomea. |
| Testit | Exact serialization, schema hashit, unknown-field rejection, OK/FAIL union, mode/loopEdgeId-invariantit, Work patch union, prompt size, State/Repair Request context, adapter equality Codex/Copilot. |
| Dokumentaatio | Päivitä prompt-composition- ja output-contract-dokumentit v2:een. Kirjaa näkyvästi, ettei Orchestrator ole provider eikä reasoning payloadia tallenneta. |

Envelope v2:n kanoninen järjestys on versioitava exact-byte-sopimus. Sen tulee sisältää:

1. Root Run ja node identity;
2. Loop ja Work Loop Node description;
3. node role ja task;
4. State `{ revision, value, sha256 }`;
5. Validationille viimeisin WorkOutcome;
6. mahdollinen Repair Request ja local retry count/call depth;
7. human/provider resume-konteksti; ja
8. Validationille sallitut REPAIR-LoopEdge-ID:t deterministisesti ID-järjestyksessä.

Statea, Repair Requestia tai provider-outputia ei typistetä hiljaisesti. Jos koko Ballet-owned prompt ylittää versionoidun prompt-rajan, Node Run epäonnistuu näkyvällä `prompt_too_large`-preflight/runtime-virheellä ennen provider-kutsua.

Vaiheen portti:

- prompt/output/provider contract -testit;
- `npm run test`;
- `npm run lint`;
- `npm run build`; ja
- `git diff --check`.

## Vaihe 4 — LoopOrchestrator ja täydellinen control-flow-cutover

Tavoite: korvata `LoopRunEngine` yhdellä durablella Work Loop -tilakoneella.

| Alue | Vaikutus |
| --- | --- |
| Domain | Viimeistele Root/Invocation/Node/Frame-statusyhdistelmät ja event kindit. Poista `StepRunResult`, `approved/rejected` ja Step-pohjaiset transition-tyypit runtime-sopimuksista. |
| Backend | Toteuta `LoopOrchestrator`, snapshot resolver ja transaction commandit jokaiselle ADR:n control-flow-taulukon riville. Päivitä `RootRunExecutionCoordinator` enqueue-, terminal-, reconciliation-, cancellation- ja finalization-polut Node Runeille. Poista `LoopRunEngine` ja sen v9-helperit. |
| Persistence | Käytä vaiheen 2 storeja. Pakota yksi aktiivinen Root-cursor, LIFO-framet, idempotent terminal-task integration, revision/transition counters ja 3/8/256 safety limitit. |
| API | Root Run start käyttää valitun Root Loopin snapshotoitua `state.initial`-JSON-arvoa revision 0:aan. Human Work/Validation response validoidaan roolikohtaisella skeemalla. |
| Frontend | Vain compile/read-model-adaptaatio; täysi control UI vaiheessa 7. Start-form voi tarjota validoidun JSON State -editorin ilman visuaalista graph-refaktorointia. |
| Fixturet | Runtime graph fixturet kattavat chainin, local retryn, repair call/returnin, nested/self repairin, FLOW-self-cyclen, target failuret ja root cancellationin. |
| Testit | Jokainen control-flow-taulukon tapahtuma unit- ja persistence-testinä; forced transaction failure; local retry/depth/transition exact boundary; task/cancel race; queued/running restart; child return Validationiin; finalization kerran. |
| Dokumentaatio | Lisää runtime-state-machine- ja recovery-dokumentaatio. README päivitetään vasta koko UI/API-cutoverissa. |

Toteutuksen command-rajat:

- `startRootRun(rootLoopId)` luo Rootin, Loopin `state.initial`-arvoon perustuvan revision 0:n, root invocationin ja start Work Node Runin yhdessä transaktiossa.
- `commitWorkOutcome(nodeRunId, taskId, outcome)` validoi/persistoi patchin ja siirtää Validationiin.
- `commitValidationOutcome(nodeRunId, taskId, outcome)` seuraa OK-edgeä tai luo local/external Repair Requestin.
- `completeLoopInvocation(invocationId)` valitsee järjestyksessä repair returnin, FLOW-LoopEdgen tai Root completionin.
- `cancelRootRun(rootRunId)` on ainoa public cancellation command.
- `reconcileRootRun(rootRunId)` on idempotentti eikä päättele Statea provider-tekstistä uudelleen.

Repair completion -testin pakollinen assert on, että seuraavan Node Runin role on `VALIDATION`, sen Work Loop Node ID on täsmälleen callerin source-node ja sen base State revision on target repair Loopin viimeisin commitoitu revisio. Work Node Runia ei luoda tässä paluussa.

Vaiheen portti:

- kaikki runtime-, persistence-, cancellation-, recovery- ja finalization-testit;
- platform-workflow-hardcode-haku AGENTS.md:n komennolla;
- `npm run test`;
- `npm run lint`;
- `npm run build`; ja
- `git diff --check`.

## Vaihe 5 — API, read projection ja SSE-invalidation

Tavoite: julkaista yksi v10 DTO-malli Configurelle ja Runille ilman Step compatibility -reittejä.

| Alue | Vaikutus |
| --- | --- |
| Domain | `RootRunCurrentPosition` käyttää invocation-, Work Loop Node-, node role-, Node Run-, task-, revision-, request- ja frame-ID:tä. Root detail sisältää Staten/revisiot, invocationit, node-ajot, framet, route-eventit ja taskit. |
| Backend | Korvaa `RunReadProjection` v10-projektiolla. WorkspaceData palauttaa Work Loop -configin ja Scheduled Work Node -kohtaisen schedule-tilan. SSE-invalidation pysyy refresh-signaalina; console SSE pysyy task-kohtaisena. |
| Persistence | Read queryt käyttävät root-owned orderingia ja control-flow sequenceä; N+1-kyselyt rajataan prepared queryillä. State-revision-listaus voi palauttaa metadatan ja valitun revision Staten erikseen, jos payload-koko sitä vaatii. |
| API | Säilytä `POST/GET /api/runs`, `GET /api/runs/:rootRunId` ja root cancel. Korvaa `/steps/:stepRunId/respond` reitillä `/nodes/:nodeRunId/respond`; älä jätä aliasia. Lisää tarvittaessa revision/detail-read-reitti, mutta älä tarjoa State-mutaatiota orchestration-transaktion ohi. |
| Frontend | Päivitä `runApi.ts`, query keyt, invalidationit ja Root association v10-ID:ille. Älä päättele aktiivista nodea taulukon viimeisestä rivistä, vaan käytä serverin current-position-projektiota. |
| Fixturet | HTTP-fixturet kaikille roolikohtaisille responseille, invalidille v9 requestille, stale Node Runille, frame/revision readille ja cancellationille. |
| Testit | Zod boundaryt, 400/404/409-statuskoodit, root ownership, stale response, unknown fields, no direct State write, read projection restartin yli, SSE refresh. |
| Dokumentaatio | Päivitä API-taulukko ja request/response-esimerkit v10-termeihin. |

Suositeltu response-union:

- human Work Node: `{ kind: "work", outcome: WorkOutcome }` tai erillinen needs-input resume;
- human Validation Node: `{ kind: "validation", outcome: ValidationOutcome }`;
- provider Work `needs_input`: `{ kind: "resume", input: string }`; ja
- kaikki response-pyynnöt sidotaan URL:n Root Run ID:hen ja Node Run ID:hen sekä serverin current-cursoriin.

Vaiheen portti:

- HTTP- ja read-projection-testit;
- `npm run test`;
- `npm run lint`;
- `npm run build`; ja
- `git diff --check`.

## Vaihe 6 — Configure UI:n Work Loop -graafi

Tavoite: authoroida v10 Work Loop Node-, Edge- ja LoopEdge-rakenne yhden design-järjestelmän sisällä.

| Alue | Vaikutus |
| --- | --- |
| Domain | Ei uutta UI-only domain-mallia. Draft käyttää shared-v10-tyyppejä; lomakekohtaiset string draftit pidetään frontendissä. |
| Backend | `/api/automation` säilyy atomic project.json -kirjoituksena ja palauttaa semanttiset issue-pathit node/edge/loopEdge-kentille. |
| Persistence | Ei runtime-persistence-muutosta. Aktiivisen Root Runin immutable snapshot sallii live config -editin vaikuttamatta ajoon; nykyinen lukituspolitiikka päätetään eksplisiittisesti UI-testissä. |
| API | Ei uusia graph-spesifejä mutation-reittejä. Yksi strict config save estää osittaiset edge/node-kirjoitukset. |
| Frontend | Kirjoita `loopVisualProjection` Work/Validation-komposiitille. Loop editor näyttää Loop descriptionin, entry Work Loop Noden, nested Work/Validation-editorit, saman Loopin Edget ja cross-Loop FLOW/REPAIR-edget. Poista terminal-, Approved/Rejected- ja Step type -kontrollit. |
| Fixturet | UI-fixturet normaaliin chainiin, local retry -invarianttiin, repair edgeen, self-edgeen, cycleen, human executor -unioniin ja invalidiin profile/resource-viitteeseen. |
| Testit | Draft create/rename/delete/reorder, edge endpoint rewrite, entry update, repair source validation, accessible labels/errors, keyboard selection, exact save JSON, graph geometry ja reduced motion. |
| Dokumentaatio | Lue ja päivitä `DESIGN.md`, koska graphin semantiikka, node-komposiitti, termit ja Run/Configure-käytännöt muuttuvat. Älä muuta värejä, typografiaa tai shape-kieltä ilman tarkoituksellista token-päätöstä. |

Configure-projektion säännöt:

1. Work Loop Node on valittava komposiitti, jonka Work- ja Validation-osat ovat erikseen tunnistettavia.
2. Kiinteät invarianttiedget renderöidään mutta niitä ei voi poistaa tai retargetoida.
3. Käyttäjän `Edge` on muokattava saman Loopin yhteys.
4. FLOW- ja REPAIR-LoopEdget erotetaan semanttisesti nykyisen Loop theme -järjestelmän sisällä, ei ad hoc -väreillä.
5. Repair-edge näyttää source Loopin allowlist-yhteyden target Loopiin; aktiivisen Repair Requestin source Validation Node näytetään vasta Run-projektiossa.
6. Terminal target voidaan projisoida selitteeksi tai Loop boundaryksi, mutta sitä ei authoroida Work Loop Noden kaltaisena terminal nodena.
7. Loop description on editorin required-kenttä ja näkyy All Loops -yhteenvedossa.

Vaiheen portti:

- `npm run lint`;
- `npm run build`;
- relevantit frontend component/layout-testit ja `npm run test`;
- `npx @google/design.md lint DESIGN.md`, jos `DESIGN.md` muuttuu ja komento on käytettävissä ilman autentikointia; ja
- `git diff --check`.

## Vaihe 7 — Run UI:n State, repair call stack ja Validation-paluu

Tavoite: tehdä immutable v10-snapshot, current cursor, State revision ja repair-polku operaattorille ymmärrettäväksi.

| Alue | Vaikutus |
| --- | --- |
| Domain | Ei frontend-only rinnakkaistiloja; presentaatiofunktiot mapittavat shared Node/Invocation/Frame/status-unioneja. |
| Backend | Root detail/read projection tarjoaa current-cursorin ja event sequencingin niin, ettei UI rekonstruoi call stackia heuristiikalla. |
| Persistence | State revision/detail queryjen payloadit rajataan eksplisiittisesti. Console retention säilyy 1 MiB/task; State käyttää omia ADR-rajojaan. |
| API | Run detail ja mahdollinen revision detail -read. Human Validation submit käyttää strict OK/FAIL+repair-sopimusta. |
| Frontend | Run canvas käyttää Root snapshotia. Aktiivinen Work/Validation, local retry, suspended caller, active repair target, call/return-edge ja viimeisin State revision näkyvät. Sheet näyttää node compositionin, canonical outcomen, Repair Requestin, frame-metadatan, State/patch-diffin ja CLI-konsolin. |
| Fixturet | UI-tilat: queued/running Work, needs input, Validation waiting, OK, FAIL/local, FAIL/orchestrator, nested repair, returned validation, target failed, cancelled ja interrupted recovery. |
| Testit | Snapshot ennen live configia, selection current cursorista, human Work/Validation forms, stale submit, repair return Validationiin, revision diff, cancellation drain, console truncation ja hidden reasoning -kielto. |
| Dokumentaatio | Päivitä `DESIGN.md` Run Timeline-, Run Sheet-, canvas- ja terminology-kohdista. README kuvaa v10 Run/Configure-käytön. |

Run-pinnan tulee näyttää vähintään:

- Root Run ID, status ja current State revision;
- Loop invocation ja Work Loop Node;
- node role `Work` tai `Validation`, attempt ja executor;
- local retry count, repair depth ja transition count;
- aktiivinen Repair Request, route/LoopEdge ja call frame;
- jokaisen accepted patchin base/result revision ja turvallinen diff;
- canonical WorkOutcome tai ValidationOutcome; sekä
- providerin julkaistu konsoli ilman raakaa chain-of-thoughtia.

Vaiheen portti:

- `npm run test`;
- `npm run lint`;
- `npm run build`;
- `npx @google/design.md lint DESIGN.md`, jos DESIGN muuttuu; ja
- `git diff --check`.

## Vaihe 8 — tracked-data cutover, legacy-poisto ja release acceptance

Tavoite: tehdä repositoryn v10 hard cut valmiiksi, poistaa kaikki v9-paino ja todentaa paketoitu kokonaisuus.

| Alue | Vaikutus |
| --- | --- |
| Domain | Poista kaikki alla inventoidut v9-exportit, alias-tyypit ja version 9 literalit. Varmista, ettei `Step` esiinny uuden mallin geneerisenä käsitteenä. |
| Backend | Poista v9 engine/store/helperit, migration- ja compatibility-haarat sekä kuolleet errorit. Päivitä scheduler, workspace data, project resource resolution, Root finalization ja release smoke v10:een. |
| Persistence | Varmista, ettei schema 4 luo `loop_runs`/`step_runs`-tauluja tai v9-indeksejä/view'eja. Testaa exact table inventory ja unsupported schema 3. |
| API | Poista Step response -reitti ja DTO-kentät. OpenAPIa ei ole, joten shared Zod + HTTP tests ovat sopimuslähde. |
| Frontend | Poista Step/Transition/terminal-copy, komponentit, editor-state-helperit ja testit. Säilytä nykyinen design-järjestelmä, routes ja theme vain v10-merkityksellä. |
| Fixturet | Muunna `.fixture-ballet-project/.ballet/project.json` ja repositoryn `.ballet/project.json` eksplisiittisesti v10:een. Lisää reviewer-hyväksytty mapping nykyisten project-local workflow-solmujen Work/Validation/repair-rooleista. Päivitä hash-baselinet vasta lopullisesta tiedostosta. |
| Testit | Korvaa `repositoryV9Conversion.test.ts` v10 tracked-config -acceptancella ja erillisellä v9 rejection -testillä. Aja koko suite, lint, build ja packaged release smoke. Lisää forbidden legacy symbol/table/API search. |
| Dokumentaatio | Päivitä README, DESIGN, ADR-002/004/005/006/007/008/010/012/013/014:n toteutustilaa selittävä uusi päätösviittaus tarpeen mukaan sekä execution-composition-dokumentit. Älä muokkaa vanhojen ADR:ien historiallista päätöstekstiä v10:ksi ilman eksplisiittistä superseded-merkintää. |

Tracked-data-konversio on reviewattava repository-edit, ei runtime-migraatio. Ennen `.ballet/project.json`-muutosta tuotetaan mapping-taulukko jokaisesta v9-Loopista ja Stepistä:

| V9-lähde | V10-kohde | Pakollinen päätös |
| --- | --- | --- |
| Loop `id` | WorkLoop `id` | Säilytä identity, ellei explicit rename ole hyväksytty. |
| Puuttuva Loop description | WorkLoop `description` | Kirjoita project-local tarkoitus; sitä ei johdeta platform-oletuksesta. |
| Agent/Human/Scheduled Step | WorkLoopNode ja sen Work/Validation executorit | Päätä kumpi tekee työn ja kumpi validoi; tätä ei voi päätellä turvallisesti automaattisesti. |
| Scheduled Step schedule | Scheduled Work Node `schedule` | Varmista, että scheduled Work Node on `startNodeId`-nodessa ja säilytä occurrence-semanttiikka. |
| `approved` paikalliseen nodeen | `ProjectNodeEdge.target.nodeId` | Varmista normaali OK-flow. |
| `rejected` takaisin sourceen | `LOCAL_RETRY`-semantiikka | Kirjaa Validation-taskiin repair-kriteeri; edgeä ei authoroida. |
| `rejected` toiseen korjauspolkuun/Loopiin | `repair`-LoopEdge | Nimeä source- ja target-Loop; ValidationOutcome valitsee exact edge-ID:n. |
| Cross-Loop approved | `flow`-LoopEdge | Varmista tail-flow eikä call/return. |
| `completed`/`blocked`/`failed` terminal | `ProjectNodeEdge.target.terminal` | Terminal on strict edge-target-arvo, ei authoroitava node. |
| Step appearance | Work/Validation appearance | Valitse kumpaan tai molempiin nykyinen artwork kuuluu; ei silent duplicatea. |
| Step composition | Work/Validation execution composition | Säilytä ExecutionProfile/resource-viitteet vain providerilla suoritettavassa sisäisessä nodessa. |

Vaiheen portti:

```bash
npm run test
npm run lint
npm run build
npx @google/design.md lint DESIGN.md
git diff --check
grep -R -n -E \
  'blueprint-design|milestone-planning|milestone-delivery|release-validation|ROADMAP\.md|IMPLEMENTATION-PLAN\.md|ACCEPTANCE\.md' \
  backend frontend shared || true
```

Lisäksi ajetaan packaged release smoke (`npm run release:build` tai sen repositoryssä tuolloin käytetty ei-julkaiseva vastine) ilman commitia, pushia, releasea tai ulkoisia kirjoituksia.

## V9-poistoinventaario

Tämä lista on cutoverin definition of done. Nimi saa jäädä vain historiallisissa ADR:issä tai eksplisiittisessä v9-rejection-testissä.

### Poistettavat domain-tyypit ja vakio-oletukset

`shared/domain/automation.ts`:

- `OutputId`;
- `ProjectStepTransitionId`;
- `StepEndStatus`;
- `StepTransitionTarget`;
- `ProjectStepTransitions`;
- `ProjectStepBase`;
- `ProjectStepExecutionComposition`;
- `ProjectAgentStep`;
- `ProjectHumanStep`;
- `ProjectScheduledStep`;
- `ProjectExecutionStep`;
- `ProjectExecutableStep`;
- `ProjectStep`;
- `ProjectTerminalNode`;
- `ProjectLoopNode`; ja
- Step transition entry/mapper -tyypit.

`shared/domain/runtime.ts` ja `shared/domain/runs.ts`:

- `StepOutcome` nykyisessä approved/rejected-muodossa;
- `StepRunResult`;
- `StepRunStatus`;
- `LoopRunSource` nykyisessä child-transition-merkityksessä;
- `LoopRun`, `StepRun` ja `LoopRunDetails`;
- `RespondToStepRunRequest`;
- Root current-positionin `loopRunId`, `stepRunId`, `stepId` ja Step-result-kentät; sekä
- `ExecutionTaskKind = "loop_step"` ja ExecutionSpec version 2.

`ProjectAutomationConfig.version: 9`, `ProjectConfiguration.version: 9`, `RootExecutionSnapshot.version: 1` ja task envelope/outcome schema version 1 korvataan uusilla versioilla; niitä ei aliasoida v10:ksi.

### Poistettavat helperit ja backend-moduulit

Domain/helperit:

- `getProjectStepTransitionEntries`;
- `getProjectStepTransitionTargets`;
- `mapProjectStepTransitions`;
- `defaultTransitionFor`;
- `isProjectExecutionStep`;
- `isProjectTerminalNode`;
- `defaultTerminalNodes`;
- `resolveEffectiveStartStep`;
- v9 `reachableExecutionSteps`; ja
- Step transition target -tarkistimet.

Runtime/helperit:

- `backend/runtime/LoopRunEngine.ts`;
- `backend/runtime/LoopRunStore.ts`;
- `backend/runtime/LoopRunTransitionPolicy.ts`;
- `backend/runtime/LoopRunOutcomePersistence.ts`;
- v9-riveihin sidottu `backend/runtime/RuntimeRowMappers.ts`;
- `persistedTransitionResult`, `isLoopTarget`, `forwardedStepInput` nykyisessä Step-muodossa;
- v9 `RootExecutionSnapshotStore.step`;
- `backend/integration/TaskEnvelopeV1.ts`;
- `backend/integration/LoopStepPrompt.ts`; ja
- `LoopExecutionSnapshot`-traversal, joka lukee `on.approved/on.rejected`-kohteita.

Frontend/helperit ja komponentit joko poistetaan tai nimetään sekä kirjoitetaan sisällöllisesti uudelleen:

- `LoopStepFields.tsx`;
- `LoopStepSheetEditor.tsx`;
- `LoopTransitionsEditor.tsx`;
- `StepCompositionFields.tsx` ja `StepCompositionPreview.tsx` Step-termeineen;
- `LoopRunStepPanel.tsx`, `LoopRunStepSheet.tsx`, `RunStepCompositionPreview.tsx`;
- `StepResponsePanel.tsx`;
- `loopEditorState.ts`-tiedoston Step type/transition/terminal -helperit;
- `loopVisualProjection.ts`-tiedoston terminal/approved/rejected-projektio; ja
- `activeRunEdgeId`-logiikka, joka etsii viimeisimmän `StepRun.result`-arvon.

### Poistettavat SQLite-rakenteet

- `loop_runs`;
- `step_runs`;
- `idx_loop_runs_one_active`;
- `idx_loop_runs_schedule_occurrence` nykyisessä Step-schedule-muodossa;
- `idx_loop_runs_root`;
- `idx_step_runs_run`;
- `parent_run_id`, `parent_step_run_id`, `transition_count` v9-LoopRun-semanttiikalla;
- `step_type`, `result`, `response_input` ja muut StepRun-sarakkeet; sekä
- `execution_tasks.kind CHECK(kind = 'loop_step')` ja vanhan specin hyväksyntä.

`root_runs`, `execution_tasks`, `execution_events` ja `loop_schedule_state` eivät ole poistettavia käsitteitä, mutta niiden schema rakennetaan v10-vastuilla. Vanhoja sarakkeita tai CHECK-rajoja ei jätetä unused legacyksi.

### Poistettavat API- ja UI-sopimukset

- `POST /api/runs/:rootRunId/steps/:stepRunId/respond`;
- request `{ kind: "human", result: "approved" | "rejected", input }`;
- Step-target/terminal-editorit ja Approved/Rejected-edge-labelit;
- Run DTO:n `stepRuns`, `result`, Step composition -nimet ja transition animaatio resultista;
- Scheduled Step node type; schedule säilyy vain start Work Noden `scheduled`-variantissa; ja
- README/DESIGN-copy, joka väittää v9:n olevan current strict config.

### Poistettavat tai korvattavat testit/fixture-oletukset

- `repositoryV9Conversion.test.ts` hash-baselineineen;
- `defaultTerminalNodes()`-fixturet;
- oletus kolmesta terminal nodesta jokaisessa Loopissa;
- testit, joissa technical failure ei seuraa rejected-transitionia — korvaa outcome/control separation -testeillä;
- yksi aktiivinen Run per Loop -indeksiin sidotut testit;
- cross-Loop Step Transition -testit ilman continuationia;
- TaskEnvelopeV1 exact-byte -goldenit;
- Scheduled Step -schema/UI/runtime-testit; ja
- frontend-testit, jotka valitsevat Approved/Rejected-kohteen tai terminal-noden.

## Testimatriisi lopputilalle

### Config ja graph

- validi minimi-WorkLoop yhdellä WorkLoopNodella ja yhdellä terminal-target Edgellä;
- required Loop/WorkLoopNode description;
- invalidi entry, unknown node/Loop/ExecutionProfile/resource;
- duplicate ID:t kaikilla scopeilla;
- internal Edge same-Loop-only ja täsmälleen yksi outgoing per WorkLoopNode;
- `flow | repair` LoopEdge source/target -validointi ja enintään yksi flow outgoing;
- self-edge, same-Loop FLOW ja same-Loop REPAIR;
- cyclic reachability ilman parser/traversal-loopia;
- v9 exact invalid schema -virhe ja lähdetiedoston muuttumattomuus.

### State ja patch

- revision 0 valitun Root Loopin `state.initial`-JSON-arvosta;
- add/remove/replace ja sequential operation semantics;
- exact 256 KiB State, exact 64 KiB patch, 128 operations ja depth 64;
- jokaiseen rajaan yksi yli;
- stale base revision, invalid pointer, prototype segment, root replacement ja non-object result;
- forced failure ennen/jälkeen revision insertin, outcome update ja control event;
- SHA-256 tamper detection ja reopen;
- empty/no patch ei luo revisionia.

### Work ja Validation

- Work completed patchilla/ilman patchia;
- Work needs_input useita kierroksia samalla nodella;
- Work blocked/failed ilman flow-edgeä;
- Validation OK ilman repairia;
- FAIL vaatii repairin;
- LOCAL_RETRY kieltää loopEdgeId:n;
- ORCHESTRATOR_REPAIR vaatii exact allowed loopEdgeId:n;
- human ja execution_profile -executorit kummassakin node-rolessa;
- invalid provider output jää evidenssiksi mutta ei ohjaa cursoria.

### Orchestrator ja nesting

- OK internal Edgeen ja Loop completioniin;
- tavallinen FLOW-LoopEdge tail-transfer ilman framea;
- local retry palaa Work Nodeen;
- external repair call luo request/route/framen/target invocationin atomisesti;
- target completed palaa samaan Validation Nodeen;
- target blocked/failed/cancelled propagoi oikein;
- nested repair LIFO;
- same-Loop repair toimii ilman active-loop unique -konfliktia;
- local retry 3 sallittu, neljäs retry blocked;
- repair depth 8 sallittu, yhdeksäs blocked;
- transition 256 sallittu, 257. blocked;
- invalid/stale route fail-closed.

### Cancellation ja recovery

- queued ja running provider-task cancellation;
- cancellation ennen/jälkeen outcome transaction commitin;
- waiting human Work/Validation cancellation;
- process kill queued taskin, running taskin, terminal-unreconciled taskin, open framen ja juuri commitoidun returnin kohdalla;
- idempotent startup reconciliation;
- viimeinen kokonaan commitoitu State revision palautuu;
- finalization tapahtuu täsmälleen kerran drainin jälkeen.

### UI ja saavutettavuus

- Work/Validation-komposiitin keyboard/mouse selection;
- fixed vs editable edgejen erottuminen;
- Loop description ja adjacent validation errors;
- executor-unionin kentät ilman silent defaultia;
- FLOW/REPAIR source/target editorit ja self-route;
- immutable Run snapshot live config -muutoksen jälkeen;
- current cursor, State revision, patch diff, request, frame, route ja return;
- human Work/Validation submitin exact intent;
- reduced-motion, focus order, labels, `aria-invalid`/`aria-describedby`;
- ei terminal-, Approved/Rejected-, raw CoT- tai provider-spesifiä orchestration-copya.

## Dokumentaation cutover-lista

- `README.md`: strict v10, Root-owned State, Work/Validation, LoopEdges, repair call/return, API-reitit, local schema remediation ja release smoke.
- `DESIGN.md`: poista Step/Transition/terminal-node-authoring; määritä Work Loop Node -komposiitti, fixed/user edges, State revision ja repair frame -esitykset nykyisillä tokeneilla.
- ADR-015: pidä päätöslähteenä; muuta vain uusi päätösversio, jos sopimus muuttuu.
- `.ballet/outputs/execution-composition/*`: merkitse v9-dokumentit supersedediksi tai korvaa v10-versioilla ilman, että v9-ohje näyttää currentilta.
- `packaging/README.md` ja release scripts: päivitä fixture/smoke-kuvaus v10:een.
- `AGENTS.md`: päivitä platform primitive -lista v10-termeihin vain, jos implementation-vaiheessä tarvitaan; pidä project-workflow-raja ennallaan.

## Riskit ja riippuvuudet

| Riski/riippuvuus | Hallinta |
| --- | --- |
| V9-Step ei kerro, mikä on Work ja mikä Validation. | Ei automaattista konversiota. Tracked `.ballet/project.json` saa reviewer-hyväksytyn mapping-taulukon ennen cutoveria. |
| State + resurssit voivat ylittää promptin kokonaisrajan. | Exact byte preflight, ei truncationia; testaa initial ja runtime-revision rajat. Prompt-rajan mahdollista versiopäätöstä ei piiloteta toteutukseen. |
| JSON Patch voi avata prototype/path-hyökkäyksiä. | Strict add/remove/replace-subset, JSON Pointer -parseri, kielletyt segmentit, pure JSON clone ja boundary-testit. |
| Outcome/task commit ja orchestration commit ovat eri hetkiä. | Raw task payload on evidenssi; NodeOutcome/patch/control-event yhdistetään idempotentisti yhdessä orchestration-transaktiossa. |
| Same-Loop repair rikkoo nykyisen active-loop unique -oletuksen. | Poista ID-kohtainen unique-indeksi; enforcea yksi Root-cursor ja invocation/frame-omistus. |
| Repair targetin tavallinen FLOW-edge voisi ohittaa returnin. | Call frame -completion käsitellään ennen FLOW-edgeä ja testataan exact precedence. |
| Cancellation ja provider terminal race. | SQLite commit order, root status check jokaisessa outcome-transactionissa ja drain barrier ennen finalizationia. |
| Local state schema 3 sisältää hyödyllistä pre-release-historiaa. | Fail-closed ja exact remediation; ei hiljaista wipeä. Tarvittaessa käyttäjä arkistoi tiedoston ennen explicit resettiä. |
| UI-graafin muutos laajenee visuaaliseksi redesigniksi. | Noudata `DESIGN.md`:tä, nykyisiä XYFlow/layout/theme-primitivejä ja rajaa muutos v10-semanttiikkaan. |
| Project-workflow-tunnisteet vuotavat geneeriseen runtimeen testidatan kautta. | Geneeriset platform-fixturet ja pakollinen forbidden-term-haku backend/frontend/shared-poluille. |
| Provider reasoning päätyy Repair Requestiin tai Stateen. | Structured skeemat sallivat vain summary/checks/request-kentät; UI näyttää vain providerin julkaistut summaryt. |

## Definition of done

Work Loop v10 on valmis vasta, kun:

1. `.ballet/project.json` ja release fixture ovat strict v10 ja v9 antaa exact invalid schema -virheen;
2. Root Run revision 0 sekä kaikki patch-revisiot ovat atomisia ja restart-turvallisia;
3. Validation-sopimus on vain `OK` tai `FAIL + LOCAL_RETRY | ORCHESTRATOR_REPAIR`;
4. external repair palaa aina callerin samaan Validation Nodeen;
5. Edge/LoopEdge/self-cycle/depth/transition-säännöt on testattu boundaryillä;
6. runtime ei sisällä `ProjectStep`, terminal node-, approved/rejected- tai `LoopRunEngine`-polkua;
7. SQLite schema ei sisällä `loop_runs`- tai `step_runs`-taulua;
8. Configure ja Run käyttävät samaa v10 snapshot/read modelia;
9. provider-adapterit säilyvät Codex/Copilot-neutraaleina eikä uutta suoraa API-riippuvuutta ole;
10. hidden chain-of-thoughtia ei tallenneta tai näytetä;
11. README, DESIGN ja execution-dokumentaatio kuvaavat samaa toteutettua mallia; ja
12. kaikki vaaditut testit, lint, build, DESIGN-lint, packaged smoke ja `git diff --check` on oikeasti ajettu ja raportoitu.
