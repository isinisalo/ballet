# Vaihe 6 - Yhden vastuun LoopNode-kirjasto

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

Toteuta hyväksytyn ADR-018:n mukainen Vaihe 6: project-local Loopien ja starter libraryn refaktorointi yhden selkeän vastuun LoopNodeiksi. Tämä vaihe käsittelee dataa, paketteja ja project-local-resursseja; älä kovakoodaa project-workflow'ta platform-koodiin.

Lue ennen muutoksia:

- `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`
- `.ballet/goals/goal-012-graph-ja-loop-engineering.md`
- `.ballet/adr/adr-016-yhden-loopin-moduulipaketti-ja-project-local-materialisointi.md`
- `.ballet/adr/adr-018-graph-ja-loop-engineering.md`
- `.ballet/project.json`
- `.ballet/loop-library/**`
- `.ballet/instructions/**`
- `.agents/skills/**`
- relevantit `.ballet/arc42/**`-starterit, traceability ja initiative-dokumentit
- Loop Module package/install/export/provenance-koodi ja smoke-testit

Auditoi ensin nykyinen `.ballet/project.json` ja `.ballet/loop-library/**`. Tunnista Loopit, jotka yhdistävät useita erillisiä software-engineering-tehtäviä tai joiden done-condition, evidenssi ja capability-raja ovat epäselviä. Älä muuta dataa ennen kuin auditointi on kirjattu initiative evidenceen tai suunnitelmaan.

Pilko vähintään rakennesuunnittelun usean vastuun kokonaisuus erillisiksi project-local Loopeiksi, kun nykyinen data sitä edellyttää. Erota esimerkiksi:

- Solution Strategy;
- Building Block View;
- architecture-significant Runtime/Deployment.

Käytä project-local startereina omistajan esimerkkialueita tarpeen mukaan:

- Clarify specification;
- Architecture Decision;
- Solution Strategy;
- UI Mock;
- UI Design;
- Implementation;
- Deploy to dev environment.

Suositeltu alkuvaiheen pilotti:

```text
clarify-specification
	provides: specification.clarified

solution-strategy
	accepts: architecture.strategy.request
	provides: architecture.solution-strategy

architecture-decision
	accepts: architecture.decision.request
	provides: architecture.decision.recorded

ui-mock
	accepts: ui.mock.request
	provides: ui.mock.ready

implementation
	accepts: implementation.request
	provides: implementation.ready

deploy-dev
	accepts: deployment.dev.request
	provides: deployment.dev.completed
```

Nimet ovat project-local esimerkkejä, eivät platformin pakollista capability vocabularya. Älä lisää niitä backend-, frontend- tai shared-platform-koodiin.

Jokaisella Loopilla pitää olla:

- yksi selkeästi nimetty vastuu;
- yksi rajattu onnistumisraja ja measurable done-condition;
- `capabilities.accepts` ja `capabilities.provides`;
- oma Work/Validation-kompositio;
- vain tehtävän kannalta tarvittavat instructionit ja skillit;
- state-contract, joka on yhteensopiva nykyisen sopimuksen kanssa tai eksplisiittisesti versionoitu;
- tarvittava provenance ja package identity.

Yksi Loop Module package sisältää täsmälleen yhden Loopin. Package-, task-, instruction-, skill- tai State-resurssi ei saa:

- nimetä upstream-, downstream- tai repair-target Loopia;
- sisältää peer Loop ID:tä reititysohjeena;
- sisältää project-global `loopEdges`-topologiaa;
- sisältää Orchestratorin valintaa tai permission grantia;
- kirjoittaa project-global graph-topologiaa.

Kaikki flow- ja repair-yhteydet jäävät `.ballet/project.json`-graph-dataan. LoopOrchestrator valitsee targetin runtime-envelopeen perustuvasta candidate-joukosta. `recommendedConnections` ovat vain suosituksia, eivät automaattisia persisted edges.

Säilytä capability contractin normalisointi ja strict validation Vaiheesta 2. Varmista, että custom Loop ja installed module käyttävät samaa capability metadataa. Varmista myös, että yhden Loopin voi vaihtaa toiseen samaa capabilityä tarjoavaan Loopyyn muuttamatta source Loopin resursseja tai peer Loopin packagea.

Päivitä tarvittaessa:

- `.ballet/project.json` project-local data;
- `.ballet/loop-library/**` package definitions;
- instructionit ja skillsit;
- state contract -kuvaukset;
- installed provenance, package hashes ja traceability;
- arc42 starterit ja initiative references;
- package/install/export fixtures ja testidata.

Älä tee riippumattomia platform-refaktorointeja. Älä lisää project-local workflow-ID:itä backend-, frontend- tai shared-platform-koodiin.

Lisää tai päivitä testit vähintään:

1. jokainen pilotti-Loop vastaa yhtä vastuuta ja yhtä done-conditionia;
2. capability accepts/provides on yksikäsitteinen ja strict-valid;
3. package sisältää täsmälleen yhden Loopin;
4. install/export roundtrip säilyttää capabilityt, state-contractin, provenance-tiedot ja hashit;
5. package ei tuo peer-targetia tai project-global routea;
6. graph edge-data on ainoa project-global topology source;
7. Loopin vaihtaminen capability-yhteensopivaan vaihtoehtoon ei vaadi source-resurssin muutosta;
8. module smoke, API, package, install/export ja UI-materialization toimivat;
9. conformance-audit löytää target Loop ID:n resurssista virheenä.

Aja ensin kapea package/install/export- tai project-data-testi. Korjaa samaa data/package-slicea ja aja testi uudelleen ennen laajentamista. Aja sen jälkeen relevantit module-smoke-testit, `npm run validate:arc42`, `npm run test`, `npm run lint`, `npm run build` ja `git diff --check`.

Raportoi ensin auditoinnin löydökset, sitten muutetut project-local-tiedostot, Loop-vastuut, capabilityt, package roundtrip -evidenssi, testikomennot ja tulokset sekä jäljelle jäävät riskit. Vahvista erikseen, ettei platform-koodiin lisätty project-workflow-nimiä tai target-reititystä.
````
