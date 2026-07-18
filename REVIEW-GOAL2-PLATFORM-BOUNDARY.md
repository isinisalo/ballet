# Goal 2: platform-rajan palautus

## Lopputulos

Goal 2:n ohjelmistokehitys-workflow on palautettu projektikonfiguraatioksi. Balletin platform-koodi ei enää parsii tai validoi tämän projektin blueprint-, milestone-, issue-, artifact- tai handoff-sopimuksia eikä rajoita manuaalista käynnistystä tiettyyn Loopiin. Projektin hyödyllinen source plane, agentit, skillit, artifact-polut, Loops, Stepit, human gatet ja projektipolitiikat jäivät projektin omiin tiedostoihin.

Uutta template-, plugin- tai validator-frameworkia ei rakennettu. Goal-, ADR- tai DESIGN-päätösten semanttista sisältöä ei muutettu. GitHubiin ei kirjoitettu eikä mitään pushattu, julkaistu tai deployattu.

## Recovery-lähtötilanne

- Tarkastus aloitettiin branchilla `goals` 2026-07-18.
- Branchin HEAD oli `050684504132d329b12ca53f0f68769f1706a57d`; `main` oli `5b226aa43a570cd670d151fa6206adbd2b8b3262`.
- Ennen ensimmäistä repositoriomuutosta ajettiin pyydetty `git diff --binary > /tmp/ballet-goal2-before-boundary-recovery.patch`.
- Alkuperäinen `git status --short` ei tulostanut rivejä, joten worktree-diff ja ensimmäinen patch olivat tyhjiä.
- Varsinainen 116 tiedoston Goal 2 -työ löytyi saman päivän `stash@{0}`:sta, jonka parent oli Goal 1:n HEAD. Ennen stash-työn palauttamista koko binary diff tallennettiin tiedostoihin:
  - `/tmp/ballet-goal2-stash-before-boundary-recovery.patch`
  - `/tmp/ballet-goal2-before-boundary-recovery.patch`
- Molemmat täydet recovery-patchit ovat 823 576 tavua. Alkuperäinen tyhjä worktree-lähtötila säilyy erikseen tiedostossa `/tmp/ballet-goal2-clean-worktree-start.patch`.
- `stash@{0}` sovellettiin `git stash apply` -komennolla. Stash jätettiin talteen eikä sitä popattu tai poistettu.
- Goal 1:n `main...goals`-diffi sisältää 76 tiedostoa. Se tarkastettiin kokonaan, mutta outcome-aware runtimea ei purettu tässä recoveryssä.

## Goal 2:n kaikkien 116 tiedoston luokittelu

### A. Geneerinen Ballet-platform-capability: 5 tiedostoa

Nämä tiedostot säilytettiin vain geneerisinä:

- `shared/domain/automation.ts`: yksi jaettu `MAX_ROOT_TRANSITIONS = 64` -turvaraja.
- `backend/runtime/RuntimeDbTypes.ts`: saman rajan re-export; backendissä ei ole erillistä numeroa.
- `shared/api/workspace-contracts.ts`: rajan julkinen workspace-export.
- `frontend/src/workspace/automation/loops/LoopRunView.tsx`: UI näyttää jaetun rajan eikä literaalia `20`. Lopputarkistuksen paljastama geneerinen `New run` -state-race korjattiin sitomalla lomakkeen näkyvyys terminal Runin ID:hen.
- `backend/tests/runtime.test.ts`: projektiketjun fixturet poistettiin, mutta turvarajan geneerinen testi säilytettiin.

Raja `64` ei määrää Loopien nimiä, lukumäärää tai järjestystä. Se on silti globaali fixed policy ja kirjataan jäljempänä jatkokehityskohteeksi.

### B. Projektikohtainen konfiguraatio: 47 tiedostoa

Kaikki seuraavat tiedostot tarkastettiin projektikohtaisina. Niistä 36 säilytettiin ja 11 jätettiin pois.

Säilytetyt 20 skill-tiedostoa:

- `.agents/skills/_shared/artifact-catalog.md`
- `.agents/skills/_shared/blueprint-governance.md`
- Seuraavien yhdeksän skillin sekä `SKILL.md` että `agents/openai.yaml`:
  - `architecture-blueprint`
  - `decision-request`
  - `independent-blueprint-review`
  - `issue-slicing`
  - `source-contract-audit`
  - `threat-model`
  - `traceability`
  - `ui-flow-design`
  - `vertical-slice-roadmap`

Säilytetyt kuusi `.ballet`-tiedostoa:

- `.ballet/AGENTS.md`
- `.ballet/goals/goal-001 - Projektin-tavoite.md`
- `.ballet/goals/index.yaml`
- `.ballet/instructions/loop-engineer-minimal.md`
- `.ballet/project.json`
- `.ballet/source-plane.yaml`

Säilytetyt kymmenen agenttia:

- `.codex/agents/acceptance-test-agent.toml`
- `.codex/agents/architecture-agent.toml`
- `.codex/agents/blueprint-verifier-agent.toml`
- `.codex/agents/implementation-agent.toml`
- `.codex/agents/implementation-plan-agent.toml`
- `.codex/agents/milestone-issues-agent.toml`
- `.codex/agents/release-agent.toml`
- `.codex/agents/roadmap-agent.toml`
- `.codex/agents/test-plan-agent.toml`
- `.codex/agents/ui-design-agent.toml`

Pois jätetyt 11 projektitiedostoa:

- Kolme `.ballet/contracts/schemas/*.schema.json`-bundlea:
  - `generated-artifact.schema.json`
  - `human-source.schema.json`
  - `source-plane.schema.json`
- Seitsemän käyttöönototonta `.ballet/templates/sources/*.yaml`-placeholderia:
  - `autonomy-approvals-policy.yaml`
  - `behavior-capability-spec.yaml`
  - `data-privacy-policy.yaml`
  - `decision-request.yaml`
  - `environment-contract.yaml`
  - `quality-attribute-policy.yaml`
  - `release-contract.yaml`
- `.ballet/reports/source-contract-hardening.md`

Skeemat olivat suoraan poistettavan platform-validatorin generoimaa, noin 311 KiB:n orphaned outputia. Placeholderit muodostivat uuden template-frameworkin ilman hyväksyttyä käyttöönottoa. Vanha hardening-raportti kuvasi poistettua toteutusta ja korvattiin tällä recovery-raportilla.

### C. Workflow-kohtainen platform-hardcode: 64 tiedostoa

Kaikki 49 `backend/source-contract/**`-tiedostoa poistettiin:

```text
SourceContractValidator.test.ts
SourceContractValidator.ts
SourceInventoryReader.ts
artifactPathValidation.ts
blueprintArtifactSchemas.ts
blueprintGateTestFixture.ts
blueprintGateValidation.ts
blueprintGateValidator.test.ts
blueprintSnapshotBindingValidation.ts
contractFileReader.ts
contractSchemaPrimitives.ts
contractSchemas.test.ts
decisionWorkflowValidation.ts
deliveryArtifactSchemas.ts
deliveryChainTestFixture.ts
deliveryChainValidation.ts
deliveryChainValidator.test.ts
deliveryValidationPrimitives.ts
documentContractValidation.ts
duplicateIdValidation.ts
externalActionValidation.ts
gateArtifactSchemas.ts
gateCoverageValidation.ts
generatedArtifactSchemas.ts
generatedArtifactTestFixture.ts
generatedGenerationQuarantine.test.ts
generatedGenerationQuarantine.ts
generatedGraphValidation.test.ts
humanSourceSchemas.ts
main.ts
milestoneChainValidation.ts
quarantineMain.ts
referenceAuthorityValidation.ts
referenceRegistry.ts
referenceValidation.ts
relationshipValidation.ts
releaseContractValidation.ts
releaseReadinessValidation.ts
repositorySkills.test.ts
reviewVerdictValidation.ts
schemaCatalog.ts
snapshotValidation.ts
sourceArtifactSchemas.ts
sourceAuthorityValidation.test.ts
sourceContractTestFixture.ts
sourceContractTypes.ts
sourcePlaneSchema.ts
traceabilityValidation.ts
writeSchemas.ts
```

Muut 15 Goal 2:n C-tiedostoa palautettiin tai niiden workflow-hunkit poistettiin:

- `AGENTS.md`
- `README.md`
- `package.json`
- `frontend/AGENTS.md`
- `backend/runs/LocalRunService.ts`
- `backend/runtime-db.ts`
- `backend/runtime/LoopRunEngine.ts`
- `backend/runtime/PersistedLoopHandoffRuntime.test.ts`
- `backend/runtime/PersistedLoopHandoffValidator.test.ts`
- `backend/runtime/PersistedLoopHandoffValidator.ts`
- `backend/server/createBalletServer.ts`
- `backend/tests/engineeringChainConfig.ts`
- `backend/tests/loopHandoff.test.ts`
- `backend/tests/projectConfiguration.test.ts`
- `shared/domain/loopHandoff.ts`

Root- ja frontend-`AGENTS.md`-tiedostoihin, README:hen tai package-scripteihin ei jätetty projektin source-contract-ohjeita tai komentoja. Root-`AGENTS.md`:n ainoa jäljellä oleva diff on puuttuneen EOF-rivinvaihdon normalisointi.

## Säilytetyt muutokset ja perustelut

- `.ballet/project.json` säilyttää projektin neljä Loopia, agentit, Stepit, transitionit, human gatet, wait/resume-reitit, artifact-polut ja projektikohtaisen retry-konfiguraation. Ne ovat konfiguraatiota, eivät Balletin sisäänrakennettu workflow.
- Uusi riippumaton blueprint-verifier säilytettiin, ja milestone-issues-agentin verkko-oikeus pysyy pois päältä.
- `invalidate-derived-blueprint` poistettiin, koska sen ainoa toteutus oli poistettu `contracts:quarantine`-framework. Start, source-päätöksen approval, verifier-repair ja blueprint-rejection palaavat nyt `source-inventory`-Stepiin.
- Downstream-agenttien `needs_input: { wait: true }` säilytettiin. Se estää lisäsyötteen virheellisen ohjautumisen final approval gateen.
- Kaikki kymmenen agentti-TOMLia säilytettiin. Niihin palautettiin yhtenäinen transient/permanent-luokittelu: vain sama turvallisesti kerran uudelleen ajettava Step saa `failure.classification = transient`; muut `failed`-tulokset ovat `permanent`.
- Skillit säilyttävät source authorityn, scope-eristyksen, canonical artifact-polut, one-writer-säännöt, hyväksyntärajat ja agentin tekemän persisted YAML/hash/viite-evidenssin tarkastuksen.
- `.ballet/source-plane.yaml` säilyttää eksplisiittisen `managed-product`-scopen, source setit ja authority-precedencen.
- Goal-001:n ja goal-indexin muutokset korjaavat vain vanhat `specs/goals/**`-polut olemassa oleviksi `.ballet/goals/**`-poluiksi. WHAT/WHY-sisältö ei muuttunut.
- Geneerinen root-transition-turvaraja keskitettiin yhteen shared-vakioon. Laaja projektikonfiguraatio voi nyt edetä ilman, että core tuntee sen askelmäärää.

## Palautetut ja poistetut muutokset

- Poistettiin koko projektin artifact/source/blueprint/delivery/release-validator `backend/source-contract/**`.
- Poistettiin persisted handoff -validator ja sen runtime/server-injektiot.
- Poistettiin exact Loop-ID:t, milestone-ID, GitHub issue -formaatti ja blueprint-paketin polku `shared/domain/loopHandoff.ts`:stä ja runtime-kutsusta.
- Poistettiin package-komennot `contracts:schemas`, `contracts:quarantine` ja `validate:sources`.
- Poistettiin exact workflow -fixturet, agenttimäärät, Step-järjestykset, gate-määrät ja transition-countit platform-testihakemistosta.
- Palautettiin README ja frontendin paikallisohjeet geneerisiksi.
- Poistettiin generoitu skeemapaketti, placeholder-templatepaketti ja vanhentunut hardening-raportti.

## Projektikonfiguraatioon jätetyt tai siirretyt säännöt

- Handoffin `milestone_id`, packet-polku ja hashit ovat vain `.ballet/instructions/**`-, `.ballet/project.json`-, agentti- ja skill-ohjeissa.
- Ballet core käsittelee cross-Loop-inputin opaque-datana. Vastaanottava projektin agentti parsii ja todentaa tämän projektin packet-sopimuksen.
- Source authority, Goal/ADR-scope, artifact-katalogi, review/gate-menettelyt, retry/repair-ohjeet sekä external-write-rajat ovat vain projektitiedostoissa.
- `managed-product.code_paths` on tarkoituksella tyhjä. Agentti- ja Ballet-ohjeet määräävät implementation- ja release-Stepit `blocked`-tilaan, kunnes konfiguraatiota ajetaan oikeassa tuoterepossa tai todelliset code pathit ja hyväksytyt contractit määritetään. Balletin omaa TypeScript-repoa ei käytetä hallitun tuotteen Python/AWS-päätösten korvikkeena.
- Stale outputia ei enää arkistoida, poisteta tai siirretä automaattisesti. Agentti raportoi täsmällisen ristiriidan ja pysähtyy ilman eksplisiittistä, polkukohtaista lupaa.

## Recoveryssä poistetut aiemmat platform-hardcodet

Goal 2 -stash-audit paljasti myös ennen Goal 2:ta olemassa olleita saman boundaryn rikkovia kohtia. Ne poistettiin, koska muuten lopputulos olisi edelleen projektisidonnainen:

- `backend/services/LoopRunStartPolicy.ts`: vain `blueprint-design` manuaaliseksi rootiksi.
- `backend/runs/LocalRunTargetService.ts`: kaikki muut Loopit unavailable-tilaan.
- `shared/domain/loopHandoff.ts`: exact Loopit ja GitHub/milestone-handoff.
- `backend/tests/loopRunStartPolicy.test.ts` ja `backend/tests/loopHandoff.test.ts`: exact politiikan testit.
- `backend/integration/LoopStepPrompt.ts`: artifact-havainto muutettiin geneeriseksi `*_file(s)`/`*_path(s)`-avainten tunnistukseksi.
- `backend/runs/LoopExecutionSnapshot.test.ts` ja `frontend/tests/loopVisualCanvas.test.ts`: workflow-nimet korvattiin neutraaleilla fixtureillä.

## Goal 1: jäljelle jääneet policy-hardcodet

Näitä ei korjattu tässä goalissa, koska tavoite käski säilyttää outcome-aware runtimen ja raportoida velan seuraavaa erillistä goalia varten:

- `backend/runtime/LoopTransitionPolicy.ts` mapittaa outcome-nimen suoraan actioniin: `ready/approved → transition`, `blocked → blocked termination`, `failed → retry/failed`, `needs_input → human/wait`, `changes-requested → repair/blocked`.
- Sama tiedosto käyttää globaalia kolmen repairin rajaa ja katkaisee toistuvaan samaan evidence-fingerprintiin. Retry lineage sallii vain yhden retryn.
- `shared/domain/automation.ts`, `shared/api/workspace-schemas.ts` ja migration defaulttaavat/rajaavat retryn täsmälleen yhteen transient-yritykseen.
- `backend/runtime/LoopRunEngine.ts` johtaa StepRun-statuksen outcome-nimestä ja muuttaa human `rejected` → agent target -reitin automaattisesti repairiksi.
- Sama engine sallii cross-Loop-targetin vain human Stepiltä ja merkitsee cross-Loop-lähteen aina `human`:ksi.
- `backend/runs/LocalRunService.ts` mapittaa standalone-agentin `ready/approved` completediksi, `failed` failediksi ja muut outcomet blockediksi.
- `backend/automation/validateAutomationConfig.ts` valitsee semanttiseksi success pathiksi vain human `approved`- tai agent `ready`-reitin.
- Frontendin transition editor, editor state, edge-slotit ja default-fixturet toistavat outcome-nimiin sidotun success/rework/error-semantiiikan sekä ensimmäisen human noden order-oletuksen.
- `MAX_ROOT_TRANSITIONS = 64` on geneerinen runaway-suoja, mutta edelleen yksi globaali fixed policy. Validator soveltaa pituustarkistusta vain itse valitsemaansa success pathiin.

## Todetut aidot geneeriset platform-capability-gapit

Näitä ei toteutettu, koska recovery-goal kielsi uuden tuotetoiminnallisuuden ja validator/plugin-frameworkin:

- Automation-konfiguraation transition-muoto muuttui, mutta tiedostoversiona on edelleen `version: 8`. `z.preprocess` migratoi vanhan binaarimuodon hiljaa ja seuraava tallennus kirjoittaa uuden muodon ilman eksplisiittistä versiokynnystä.
- Migration tunnistaa legacy-`on`-objektin avainten, ei target-tyyppien perusteella. Esimerkiksi `{ approved: "completed", rejected: 123 }` muuttuu kanoniseksi ja voi tulla hyväksytyksi sen sijaan, että alkuperäinen malformed target hylättäisiin.
- Persisted Loop snapshotilla ei ole omaa schema-versiota. `RuntimeRowMappers` migratoi snapshotin readillä nykysemantiikkaan, joten vanhan Runin projektio voi muuttua sovellusversion mukana.
- Balletilla ei ole geneeristä, opt-in project-local validation hook -rajapintaa. Tässä recoveryssä sopimus jätettiin tarkoituksella agenttien projektikohtaiseksi tarkastukseksi eikä uutta hook/frameworkia rakennettu.
- Jos structured cross-Loop-input halutaan myöhemmin core-tasolle, sen pitää olla konfiguraatiossa ilmoitettu geneerinen schema/hook, ei tietty milestone- tai GitHub-handoff.
- Goal 1:n vanhan agenttivastauksen API-muodon compatibility ja snapshot/config migration -politiikka tarvitsevat eksplisiittisen versionointipäätöksen.

## Validointi

| Tarkistus | Tulos |
| --- | --- |
| `projectConfigSchema` + `validateProjectAutomationConfig` nykyiselle `.ballet/project.json`:lle | PASS, 4 Loopia ja 10 agenttia |
| 10 agentti-TOMLin parse | PASS |
| `.ballet/source-plane.yaml` parse | PASS |
| `frontend/tests/loopVisualCanvas.test.ts` | PASS, 13/13 |
| `frontend/tests/automation-ui.test.tsx`, flake-varmistus | PASS, 25/25 peräkkäistä ajoa × 9/9 testiä |
| `npm run test` | PASS, 68 testitiedostoa passed + 1 skipped; 340 testiä passed + 2 skipped |
| `npm run lint` | PASS, 0 virhettä; 15 ennestään olevaa complexity/line-count-varoitusta |
| `npm run build` | PASS, TypeScript build + Vite production build |
| `git diff --check` | PASS |
| `git diff --cached --check` | PASS |
| Pyydetty workflow-tunnisteiden grep | PASS, ei tulostetta |
| Laajempi validator/handoff/source-contract-hardcodejen scan platformista | PASS, ei tulostetta |

Skill-frontmatterit tarkistettiin onnistuneesti YAML-parserilla. Bundlattu Python-`quick_validate.py` ei ollut tässä ympäristössä ajettavissa, koska Pythonilta puuttui PyYAML; riippuvuutta ei asennettu. Tämä ei korvaa eikä estä yllä lueteltuja pakollisia repository-checkejä.

Ensimmäinen täysi testiajo läpäisi. Myöhempi lopullinen uusinta paljasti yhden goalista riippumattoman, aiemmin olemassa olleen `automation-ui`-testiflaken: asynkroninen testin EventSource-yhteys käynnisti refreshin, joka saattoi vaihtaa `New run` -painikkeen DOM-instanssin tai resetoida boolean-tilan kesken klikkauksen. Testi odottaa nyt `stream: connected`-tilaa, hakee enabled-painikkeen tuoreella queryllä ja klikkaa tuoretta elementtiä; lomakkeen näkyvyys sidotaan terminal Runin ID:hen myöhässä resetoivan boolean-effectin sijaan.
