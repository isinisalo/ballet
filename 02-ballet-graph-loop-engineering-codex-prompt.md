# Vaihe 2 - Domain, schema ja capability-sopimus

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

Toteuta hyväksytyn ADR-018:n mukainen Vaihe 2: strict Graph Engineering -domain, project config -schema ja capability-sopimus. Älä muuta frontendin authoring-näkymiä tai UI-reittejä tässä vaiheessa.

Lue ennen muutoksia:

- `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`
- `.ballet/goals/goal-012-graph-ja-loop-engineering.md`
- `.ballet/adr/adr-018-graph-ja-loop-engineering.md`
- `.ballet/adr/adr-015-work-loop-state-ja-loop-orchestrator.md`
- `.ballet/adr/adr-016-yhden-loopin-moduulipaketti-ja-project-local-materialisointi.md`
- relevantit `.ballet/arc42/**`-osiot ja graph-and-loop-engineering-initiative
- `shared/domain/automation.ts`
- `shared/domain/runtime.ts`
- `shared/domain/executionRuntime.ts`
- `shared/api/workspace-schemas.ts`
- `shared/api/workspace-contracts.ts`
- project configuration repository, validators, snapshot-rakenteet ja Loop Module install/export -koodi
- nykyiset schema-, domain-, snapshot- ja module-testit

Toteuta hard cut seuraavaan strict project-config-versioon, päätöksen mukaisesti v11. Älä jätä v10-parseria, compatibility-readeria, silent defaultteja, dual-writeä tai best-effort-migraatiota. Nykyinen v10-konfiguraatio saa jäädä fixtureihin tai työpuuhun vain siltä osin kuin olemassa olevat testit ja vaiheen 1 dokumentoitu migration boundary sitä edellyttävät, mutta aktiivinen v11-reader ei saa hyväksyä v10-dataa.

Lisää `ProjectLoop`ille first-class capability-sopimus vähintään seuraavalla semantiikalla:

```ts
export interface ProjectLoopCapabilities {
  accepts: string[];
  provides: string[];
}

export interface ProjectLoop {
  id: string;
  description: string;
  capabilities: ProjectLoopCapabilities;
  state: ProjectLoopState;
  startNodeId: string;
  nodes: ProjectWorkLoopNode[];
  edges: ProjectNodeEdge[];
}
```

`accepts` kuvaa request/task-envelope-tyyppejä, jotka Loop voi ottaa vastaan. `provides` kuvaa capability- tai outcome-tyyppejä, jotka onnistunut Loop tuottaa. Repair-target on yhteensopiva vain, jos requested capability täsmää targetin `provides`-arvoon. Normaali flow-target on yhteensopiva, kun completion/request sopii targetin `accepts`-arvoon. Lopullinen valinta vaatii lisäksi project-global edge-allowlistin.

Validoi capability-arvot koneellisesti:

- namespaced, vakaa string-muoto;
- trimmaus ja non-empty;
- duplikaatit hylätään;
- liian pitkät arvot hylätään;
- epäkelpo merkistö tai namespace hylätään;
- accepts/provides-listojen koko- ja sisältörajat ovat eksplisiittiset;
- unknown capability-rakenteet hylätään fail-closed.

Säilytä `ProjectLoop` nykyisenä runtime-definitiona ja `ProjectWorkLoopNode` sen sisäisenä Work/Validation-kompositiona. Älä luo uutta nested `LoopNode`-runtime-entiteettiä.

Päivitä tarvittavat:

- shared domain -tyypit;
- strict Zod- tai vastaavat skeemat;
- API-contractit ja DTO:t;
- project configuration repository ja validation;
- immutable Root Run snapshot niin, että route-valintaan tarvittava Loop-, capability- ja graph-allowlist-data snapshotataan;
- Loop Module package-, install- ja export-materialization niin, että yhden Loopin capability metadata säilyy häviöttä;
- conformance validation.

Loop Module sisältää edelleen täsmälleen yhden Loopin. Package ei saa sisältää project-global `loopEdges`-topologiaa, Orchestratorin valintaa, seuraavaa targetia tai repair-target ID:tä. `graph.loopEdges` on ainoa project-global peer-topologian source of truth.

Lisää conformance-sääntö, joka hylkää reusable Loop package-, task-, instruction-, skill- tai State-contract-resurssin, jos se sisältää project-global routea, peer Loop ID:tä, `targetLoopId`-reititysohjetta tai muuta kohteen valintaa. Älä kovakoodaa arc42-, UI-, implementation- tai deploy-workflow'n nimiä platform-koodiin.

Jos `accepts`/`provides` ei riitä deterministic runtime-valintaan, pysähdy ennen toteutusta ja päivitä ADR-018:aan pienin eksplisiittinen laajennus. Älä keksi project-local capability vocabularya platform-koodiin.

Lisää tai päivitä testit vähintään seuraaville tapauksille:

1. validi v11 config roundtrip säilyy häviöttömänä;
2. v10 config hylätään selkeällä hard-cut-virheellä;
3. tyhjä, duplikoitu, liian pitkä tai epäkelpo capability hylätään;
4. accepts/provides säilyvät domainissa, API:ssa, snapshotissa ja markdown/config-materializationissa;
5. custom ProjectLoop ja installed module käyttävät samaa capability-sopimusta;
6. module install/export roundtrip säilyttää capabilityt;
7. package ei voi tuoda project-global edgeä tai target Loop ID:tä;
8. snapshot sisältää immutable route-allowlistin ja capability-metadatan;
9. unknown schema fields, unknown config version ja invalid route ownership hylätään.

Aja ensin kapea muuttuneen domain/schema/module-säikeen testi. Sen jälkeen aja relevantit repository-testit, `npm run lint`, `npm run build` ja tarvittaessa `npm run validate:arc42`. Aja lopuksi `git diff --check`.

Älä tee UI-muutoksia. Älä toteuta vielä cross-Loop-dispatchia. Raportoi muutetut tiedostot, schema-version, capability-säännöt, testikomennot ja tulokset, mahdolliset blockerit sekä vahvistus siitä, ettei UI:tä muutettu.
````
