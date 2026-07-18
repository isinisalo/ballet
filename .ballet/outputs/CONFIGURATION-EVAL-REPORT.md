# Configuration eval report

## Tulos

**PASS — 26/26 project-local eval-tapausta läpäisi, 0 epäonnistui.**

- Git HEAD: `0ea66255bfb0c9687f0d91013db9b487cc29401c`
- Eval-komento: `npx tsx .ballet/evals/run-evals.ts --write-results`
- Runtime-evidenssi: 130/130 transition-haaraa (20 agent-Stepiä × 6 outcomea + 5 human Stepiä × 2 päätöstä)
- Skill-evidenssi: 9/9 skillin deterministiset validatorit, architecture-skillin kaikki neljä Step-kind-moodia
- Ulkoiset vaikutukset: 0 GitHub-kirjoitusta, 0 tagia, 0 releasea, 0 deployta, 0 cloud-muutosta
- Runtime-state: vain tilapäinen SQLite `/tmp`-hakemiston alla; fixture-workspacet poistettiin ajon lopuksi

Eval käyttää nykyisiä geneerisiä Ballet-primitiiivejä suoraan: project config -schemaa, `validateProjectAutomationConfig`-validointia, `RuntimeDatabase`a, persisted StepRun-transitioneja, retry-/stall-policyä, wait/resumea ja cross-Loop child Runeja. Agentit korvataan mock outcome -fixtureillä; yksikään provider-agentti tai ulkoinen write-työkalu ei käynnisty.

## Nykyisen checkoutin lähdetila

Nykyiset 8 Goalia ja 11 ADR:ää ovat accepted, indeksoituja ja rakenteellisesti eheitä. Todellinen managed-product-blueprint ei kuitenkaan ole vielä source-ready: saman scopen DESIGN-lähde, stable `acceptance_ids` ja hyväksytyt `quality_thresholds` puuttuvat. Siksi nykyisen source-planen oikea outcome on `needs_input`; erillinen full-happy fixture todistaa positiivisen polun muuttamatta human-owned lähteitä.

`managed-product.code_paths` on myös tyhjä eikä todellisia release/environment/rollback-contracteja ole. Oikea implementation/release-polku pysyy tämän vuoksi `blocked`; positiivinen approval-polku on turvallinen mock-simulaatio, jonka external actionit ovat aina `not_executed`.

## Tapausmatriisi

Tapaus | Loop / Step | Agentti | Odotettu → toteutunut outcome | Artifactit | Approval boundary | Tulos | Capability gap
--- | --- | --- | --- | --- | --- | --- | ---
CONFIG-STRUCTURE | all Loops / all Steps | all configured agents | valid → valid | .ballet/project.json, .codex/agents/*.toml | Schema and semantic references must validate before any Run. | PASSED | —
AGENT-SKILL-BOUNDARIES | all agent Steps | 10 agents / 9 skills | enforced → enforced | .codex/agents/*.toml, .agents/skills/*/SKILL.md, .agents/skills/*/scripts/validate.mjs | Authors return ready; only two independent checker Steps may return approved, while release approval stays human-owned. | PASSED | —
ALL-CONFIGURED-TRANSITIONS | 20 agent Steps × 6 outcomes; 5 human Steps × 2 decisions | all agents and human gates | 130/130 passed → 130/130 passed | .ballet/project.json, .ballet/evals/fixtures/agent-outcomes.yaml | Actual RuntimeDatabase transition must equal the project-configured action and retry limit. | PASSED | —
SOURCE-READINESS-HAPPY | blueprint-design / source-inventory → source-validation | roadmap-agent / source-contract-audit | ready → ready | mock source-plane, mock Goal/ADR/DESIGN, source-snapshot.yaml | Only accepted, same-scope, hash-matching fixture sources may continue. | PASSED | —
CURRENT-SOURCE-READINESS | blueprint-design / source-validation | roadmap-agent / source-contract-audit | needs_input → needs_input | .ballet/source-plane.yaml, .ballet/goals/**, .ballet/adr/** | Missing same-scope DESIGN, stable acceptance IDs and quality thresholds require a human-owned source update. | PASSED | —
SOURCE-MISSING-DECISION | blueprint-design / gap-and-conflict-audit → source-decision-gate | roadmap-agent / source-contract-audit + decision-request | needs_input → needs_input | source-missing.yaml, specification-gaps.yaml, decision-requests.yaml | A gate response is not source authority; inventory must rerun after accepted source update. | PASSED | —
SOURCE-CONFLICT | blueprint-design / gap-and-conflict-audit → source-decision-gate | roadmap-agent / source-contract-audit + decision-request | needs_input → needs_input | source-conflict.yaml, specification-gaps.yaml, decision-requests.yaml | A gate response is not source authority; inventory must rerun after accepted source update. | PASSED | —
SKILL-DETERMINISTIC-VALIDATORS | blueprint-design + milestone-planning artifact Steps | all 9 configured skills | 9 skills / 12 modes passed → 9 skills / 12 modes passed | all fixture blueprint artifacts, milestone manifest, issue drafts | Each persisted artifact is bound to canonical path, source snapshot, author and raw-byte inputs. | PASSED | —
BLUEPRINT-HUMAN-APPROVAL | blueprint-design / independent-blueprint-verifier → blueprint-gate | blueprint-verifier-agent + human | milestone-planning started → milestone-planning started | blueprint-review.yaml, blueprint-gate-packet.yaml, blueprint-approved handoff | Only approved independent review with exact packet/source hashes reaches milestone planning. | PASSED | GAP-APPROVAL-ASSERTION (runtime input remains opaque; downstream validator enforces the fixture claim)
BLUEPRINT-VERIFIER-CHANGES-REQUESTED | blueprint-design / independent-blueprint-verifier | blueprint-verifier-agent | changes-requested; stale packet blocked → changes-requested; stale packet blocked | blueprint-review.yaml, absent-or-stale blueprint-gate-packet.yaml | A non-approved review cannot emit or retain an approvable packet. | PASSED | —
BLUEPRINT-HUMAN-REJECTION | blueprint-design / blueprint-gate → source-inventory | human + blueprint authors/checker | blocked after 3 repairs → blocked after 3 repairs | human rejection fixture outcomes | Rejection never starts milestone planning and uses project.json maxAttempts=3. | PASSED | —
MILESTONE-PLANNING-AND-ISSUE-GATE | milestone-planning / plan-milestone-issues → milestone-gate | milestone-issues-agent, implementation-plan-agent, test-plan-agent + human | milestone-delivery started → milestone-delivery started | milestone-manifest.yaml, issue-drafts.yaml, implementation-plan.yaml, test-plan.yaml | Issue drafts remain draft_only/not_executed through the human milestone gate. | PASSED | No GitHub writer Step is configured; positive publication is intentionally unexpressed.
IMPLEMENTATION-MAKER-CHECKER-STAGING | milestone-delivery / implement-milestone → run-acceptance-tests → implementation-gate | implementation-agent ≠ acceptance-test-agent + human | release-validation started → release-validation started | acceptance-evidence.yaml, staging-report.yaml, implementation-gate claim | No release child exists before exact staging/Git-SHA human approval. | PASSED | GAP-APPROVAL-ASSERTION
CHANGES-REQUESTED-BOUNDED-REPAIR | milestone-delivery / run-acceptance-tests → implement-milestone | acceptance-test-agent → implementation-agent | blocked after 3 changed-evidence repairs → blocked after 3 changed-evidence repairs | four distinct failed acceptance fixture outcomes | Only same-milestone repair is allowed; project.json maxAttempts=3 and same-evidence stall apply. | PASSED | —
CHANGES-REQUESTED-SAME-EVIDENCE | milestone-delivery / run-acceptance-tests | acceptance-test-agent | retry_stalled → retry_stalled | repeated acceptance evidence fingerprint | Unchanged evidence cannot consume repeated repair cycles. | PASSED | —
NEEDS-INPUT-WAIT-RESUME | milestone-planning / implementation-plan | implementation-plan-agent + human input | resumed same-step → resumed same-step | needs_input outcome, resume input | Resume appends input but does not skip the current Step or a later gate. | PASSED | —
BLOCKED-OUTCOME | release-validation / make-git-release | release-agent | blocked → blocked | blocked fixture outcome, empty external ledger | A missing approval/contract blocks before deploy-release. | PASSED | GAP-LOOP-ENTRY (manual downstream start is platform-permitted, so the agent guard must block it)
FAILED-OUTCOME-RETRY | milestone-planning / implementation-plan | implementation-plan-agent | permanent failed; transient retried once → permanent failed; transient retried once | failed-permanent outcome, failed-transient outcome | Only transient failure uses project.json maxAttempts=1. | PASSED | —
STALE-APPROVAL-SHA | milestone-planning / plan-milestone-issues | milestone-issues-agent / issue-slicing | blocked → blocked | mutated blueprint handoff SHA, unchanged gate packet | A stale packet SHA blocks before milestone artifacts can be trusted. | PASSED | GAP-APPROVAL-ASSERTION (project validator catches it; core input is opaque)
DOCUMENTATION-DRIFT | blueprint-design / source-validation | roadmap-agent / source-contract-audit | blocked → blocked | source-snapshot.yaml, mutated Goal bytes | Raw-byte drift invalidates the snapshot before downstream artifacts. | PASSED | —
STALE-IMPLEMENTATION-APPROVAL-SHA | release-validation / make-git-release | release-agent / delivery-evidence | blocked → blocked | implementation-gate claim, release-manifest with different Git SHA | Release subject Git SHA must equal the exact human-approved staging SHA. | PASSED | GAP-APPROVAL-ASSERTION (project validator enforces it after opaque handoff)
RELEASE-WITHOUT-APPROVAL | release-validation / make-git-release | release-agent / delivery-evidence | blocked → blocked | rejected implementation-gate claim, release-manifest fixture | No tag/deploy/write is simulated without approved implementation claim. | PASSED | GAP-LOOP-ENTRY + GAP-APPROVAL-ASSERTION
RELEASE-AFTER-APPROVAL | release-validation / make-git-release → deploy-release → verify-release → release-gate | release-agent + human | completed without external writes → completed without external writes | implementation-gate claim, release/environment contracts, rollback evidence, release-manifest.yaml | Fixture authorization is allowed, while every external action remains not_executed. | PASSED | Provider-level conditional tool authorization is not machine-enforced by Ballet.
ROLLBACK-EVIDENCE-MISSING | release-validation / make-git-release | release-agent / delivery-evidence | blocked → blocked | release-manifest without rollback evidence | Rollback evidence is a precondition, not post-failure documentation. | PASSED | —
RELEASE-GATE-REJECTION | release-validation / release-gate → verify-release | human → release-agent checker | verify-only repair → verify-only repair | release verification fixture, human rejection | Rejection retries verification only and never creates another make/deploy Step. | PASSED | —
FULL-CROSS-LOOP-HAPPY-PATH | all 4 Loops / 20 normal agent Steps / 4 delivery gates | all 10 agents + human | completed → completed | complete full-happy fixture bundle | Each cross-Loop child starts only after its configured human gate in this simulated path. | PASSED | Manual downstream Loop start and typed approval enforcement remain documented generic gaps.

## Todennetut invariantit

- Kaikki 4 Loopia, 20 agent-Stepiä, 5 human gatea, 10 agenttia ja 9 skilliä ovat mukana vähintään yhdessä ajossa; kaikki 130 konfiguroitua transition-haaraa vastaavat persisted runtime-tulosta.
- Maker-Stepin fabrikoitu `approved` päättyy `blocked`-tilaan. Vain riippumaton blueprint-verifier ja acceptance-checker saavat palauttaa `approved`; release-agent palauttaa myös verify-Stepissä vain `ready`, ja human release-gate omistaa hyväksynnän.
- Implementation-maker ja acceptance-checker ovat eri agentteja. Blueprint-verifier ei ole yhdenkään tarkistamansa blueprint-artifactin persisted author.
- Blueprint-, milestone- ja implementation-handoffit sitoutuvat canonical pathiin, scopeen, source snapshotiin, raw-byte SHA-256 -hasheihin ja tarvittaessa tarkkaan Git SHA:han.
- Issue draftit ovat ennen milestone-gatea ja sen jälkeen `draft_only`, `external_target: null` ja external actioniltaan `not_executed`. GitHub writer -Stepiä ei ole.
- Acceptance `changes-requested` palaa vain implementation-Stepiin; muuttumaton evidence stallaa ja muuttuva evidence loppuu `.ballet/project.json`-transition `maxAttempts: 3` -rajaan.
- Permanent failure ei retrytä. Transient failure käyttää vain nykyisen Stepin project-configured retry-policyä. Numeerisia retry-rajoja ei enää määritellä rinnakkaisena authorityna agentti- tai governance-proosassa.
- `needs_input` odottaa ja jatkaa samaa downstream-Stepiä appendatulla inputilla; se ei ohita gatea.
- Source-, artifact-, approval- tai rollback-hash-drift tuottaa `blocked` ennen downstream- tai ulkoista vaikutusta.
- Release ilman implementation approvalia blokataan ennen `deploy-release`-Stepiä. Hyväksytyn mock-claimin jälkeen koko release-Loop voidaan ajaa human release-gateen ja completed-tilaan ilman ulkoista writeä.

## Project-local korjaukset

- Maker-agenttien `approved`-reitit muutettiin blokkaaviksi; checkerien `ready` ei ohita eksplisiittistä approval-outcomea.
- Release-agentin make/deploy/verify-protokolla erotettiin: kaikki kolme palauttavat `ready`, ja hyväksyntä on yksin human release-gatella.
- Milestone- ja implementation-gateille lisättiin hash- ja subject-sidotut claim-sopimukset sekä delivery-evidence-validator.
- Kaikille 9 skillille lisättiin oma deterministinen CLI-validator ja yhteinen canonical path/hash/source snapshot/author -envelope.
- Retry-numeroiden rinnakkainen proosa-authority poistettiin; rajat luetaan yksinomaan `.ballet/project.json`-transitioneista.

## Capability gaps

Geneeriset platform-puutteet ja kaksi unrelated käyttötapausta kutakin kohden on dokumentoitu tiedostossa `.ballet/outputs/CAPABILITY-GAPS.md`:

- `GAP-APPROVAL-ASSERTION`: typed, subject/hash-bound human approval
- `GAP-LOOP-ENTRY`: transition-only Loop entry policy
- `GAP-CONDITIONAL-EFFECTS`: approval-bound external effect authorization

GitHub issue publicationin puuttuminen on project-local workflow-valinta, ei osoitettu platform-gap. Nykyinen konfiguraatio todistaa konservatiivisen no-write-rajan; positiivinen julkaisu vaatisi erikseen hyväksytyn project-local writer-Step-ratkaisun.

## Evidenssitiedostot

- `.ballet/evals/run-evals.ts` — runtime- ja validator-harness
- `.ballet/evals/fixtures/*.yaml` — source-, artifact-, outcome-, approval- ja release-mockit
- `.ballet/evals/results.json` — tämän raportin koneellinen lähde
- `.agents/skills/*/scripts/validate.mjs` — skill-kohtaiset deterministic validatorit
- `.agents/skills/_shared/scripts/validate-delivery-evidence.mjs` — planning/staging/release handoff -validator
- `.ballet/outputs/CAPABILITY-GAPS.md` — geneeriset capability gaps

## Lopputarkistukset

- `npx tsx .ballet/evals/run-evals.ts --write-results`: PASS, 26/26 tapausta ja 130/130 transition-haaraa
- `npm run test`: PASS, 72 testitiedostoa läpäisi, 1 ohitettiin; 377 testiä läpäisi, 2 ohitettiin
- `npm run lint`: PASS, 0 virhettä; 30 ei-blokkaavaa complexity/max-lines-varoitusta
- `npm run build`: PASS
- Kaikkien uusien `.mjs`-validaattorien `node --check`: PASS
- `git diff --check`: PASS
- Muutetut ja untracked-tiedostot yhdistävä boundary-check: PASS, vain `.ballet/**`, `.codex/agents/**` ja `.agents/skills/**`
- Numeeristen retry-rajojen duplikaattihaku agentti-/skill-/instruction-proosasta: PASS, ei osumia
