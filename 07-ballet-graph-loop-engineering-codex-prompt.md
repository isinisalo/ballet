# Vaihe 7 - Loppuauditointi ja legacy-siivoaminen

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

Olet `isinisalo/ballet`-repositoryn riippumaton arkkitehtuuri-, runtime-, UI- ja clean-code-auditoija sekä toteuttava repository-agentti.

Auditoi valmis Graph Engineering / Loop Engineering -muutos goal-012:n, ADR-018:n, AGENTS.md:n, ARCHITECTURE.md:n, DESIGN.md:n, strict scheman, runtime-testien, UI-testien, browser-evidenssin ja annetun referenssikuvan perusteella. Korjaa vain evidenssin osoittamat in-scope juurisyyt. Älä tee riippumattomia refaktorointeja, uusia ominaisuuksia tai ulkoisia kirjoituksia.

Lue ennen auditointia:

- `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`
- `.ballet/goals/goal-012-graph-ja-loop-engineering.md`
- `.ballet/adr/adr-018-graph-ja-loop-engineering.md`
- kaikki relevantit `.ballet/arc42/initiatives/graph-and-loop-engineering/**`
- updated `.ballet/arc42/TRACEABILITY.md`, `STATUS.md` ja `09-architecture-decisions.md`
- strict schema, domain, snapshot, runtime, API, module ja frontend-testit

Tee ensin read-only auditointi ja muodosta evidence matrix muodossa:

`Requirement | Evidence | Status | Risk | Smallest fix`

Merkitse `unverified`, jos claimia ei voi todistaa tiedostolla, testillä, ajolla tai screenshotilla. Älä merkitse vaatimusta vihreäksi pelkän dokumentaation perusteella.

Todista repository-haulla, ettei tuotantokoodiin tai aktiiviseen UI-copyyn jää:

- `LoopContextCanvas`;
- `LoopContextProjection`;
- `buildLoopContextProjection`;
- `automationContextPath`;
- `level=context`;
- numeric `level=1` tai `level=2` route- ja UI-compatibility-polkuina;
- Context-defaultia tai Context-navigationia;
- vanhaa `view=all`-reittiä;
- automaattista `followFlow`-ohitusta normaalissa cross-Loop-dispatchissa;
- fake Orchestrator-edge statea;
- project-workflow-ID:tä backend-, frontend- tai shared-platform-koodissa.

Historiallisissa supersession-dokumenteissa Context- ja Level-viittaukset voivat säilyä, jos ne ovat selvästi historiallisia päätös- tai evidenssiviitteitä. Erottele ne aktiivisesta tuotantokoodista ja UI-copysta.

Tarkista domain- ja runtime-invariantit:

- Graph LoopNode on `ProjectLoop`in projektio, ei uusi runtime-entiteetti;
- `ProjectWorkLoopNode` on Loop Engineeringin sisäinen node;
- Graph Engineering näyttää yhden Orchestrator-noden ja yhden LoopNoden per ProjectLoop;
- sisäiset Work/Validation-nodet eivät vuoda Graph Engineeringiin;
- Loop Engineering ei näytä project-global Graphia;
- capability metadata on first-class sekä custom että installed Loopilla;
- Orchestrator valitsee vain immutable Root Run snapshotin allowlistatun targetin;
- capability-match ja edge-kind validoidaan ennen dispatchia;
- Validation tai LoopNode ei voi nimetä target Loop ID:tä;
- repair palaa samaan caller Validationiin;
- flow ei luo repair-framea;
- zero outgoing flow candidate päättää Root Runin;
- yksi tai useampi flow candidate kulkee Orchestratorin kautta;
- ambiguity tuottaa `needs_input`-tilan;
- permission gate ei myönnä oikeuksia automaattisesti;
- restart recovery ei luo duplicate target runia;
- retry/depth/attempt/cancellation-rajat säilyvät.

Tarkista UI:

- vain `Graph Engineering` ja `Loop Engineering` näkyvät käyttäjälle;
- Graph Engineering on default ja URL source of truth;
- `view=graph` ja `view=loop&id=...` toimivat deep linkkeinä;
- browser back/forward toimii;
- Orchestrator on canvasilla ja avautuu inspectorissa;
- LoopNode:n keyboard/Enter/double-click avaa oikean Loop Engineeringin;
- active Run -lukitus, dirty/save-validointi ja selected-Loop-only canvas säilyvät;
- keyboard, focus, ARIA ja narrow viewport toimivat;
- desktop- ja narrow screenshotit ovat olemassa ja luettavia;
- Graph UI:n edget ovat canonical persisted policy/runtime-evidenssin projektioita, eivät fake client statea;
- DESIGN.md-tokenit ja tracked LoopTheme säilyvät.

Tarkista module boundary:

- package sisältää yhden Loopin;
- install/export/provenance/hash roundtrip toimii;
- package, task, instruction, skill tai State-contract ei nimeä peer-targetia;
- project-global graph topology on vain project configissa;
- project-workflow-nimet eivät ole platform-koodissa.

Korjaa vain löydetyt in-scope juurisyyt. Jokaisen korjauksen jälkeen aja ensin sitä vastaava kapea testi ja vasta sitten laajenna validointia. Älä poista käyttäjän muutoksia tai muuta accepted Goal/ADR-päätöksiä hiljaa.

Aja lopuksi täsmälleen:

```bash
npm run validate:arc42
npm run test
npm run lint
npm run build
git diff --check

grep -R -n -E \
  'LoopContextCanvas|LoopContextProjection|buildLoopContextProjection|automationContextPath|level=context|Level 0|Level 1|Level 2' \
  frontend shared backend .ballet || true

grep -R -n -E \
  'blueprint-design|milestone-planning|milestone-delivery|release-validation|arc42-clarify-requirements|arc42-design-structures|arc42-design-concepts|arc42-communicate-document|arc42-accompany-implementation|arc42-analyze-evaluate|arc42-continuous-learning|\\.ballet/arc42/|ROADMAP\\.md|IMPLEMENTATION-PLAN\\.md|ACCEPTANCE\\.md' \
  backend frontend shared || true
```

Ensimmäisen grepin dokumentaatio-osumat voivat olla tarkoituksellisia supersession-viitteitä, mutta aktiivisessa tuotantokoodissa ja UI-copyssa niitä ei saa olla. Toisen grepin project-workflow-osumat pitää luokitella: project-local data `.ballet/`-hakemistossa voi olla tarkoituksellista, platform-koodissa ei.

Päivitä initiative EVIDENCE/REVIEW, TRACEABILITY ja STATUS vain uuden konkreettisen evidenssin tai findingin perusteella. Älä muuta `verified`-tilaa ilman artifact referenceä. Älä väitä kaikkia vaatimuksia täytetyiksi, jos screenshot, testituloste tai runtime-evidenssi puuttuu.

Raportoi:

- evidence matrix kokonaisuudessaan;
- löydetyt bugit ja riskit severity-järjestyksessä;
- tehdyt pienet korjaukset;
- muutetut tiedostot;
- jokaisen komennon tulos;
- screenshot-polut;
- dokumentaatioon jääneet tarkoitukselliset supersession-viitteet;
- jäljelle jäävät unverified-vaatimukset ja niiden vaikutus;
- vahvistus, ettei tehty commitia, pushia, mergeä, releasea, deployta tai muuta ulkoista kirjoitusta.
````
