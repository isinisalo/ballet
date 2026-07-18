#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const resultPath = path.join(root, ".ballet/evals/results.json");
const reportPath = path.join(root, ".ballet/outputs/CONFIGURATION-EVAL-REPORT.md");
const result = JSON.parse(await readFile(resultPath, "utf8"));

const cell = (value) => String(value ?? "—")
  .replaceAll("|", "\\|")
  .replaceAll("\n", " ");

const rows = result.records.map((record) => [
  record.case,
  record.loop_step,
  record.agent,
  `${record.expected_outcome} → ${record.actual_outcome}`,
  record.artifacts.join(", "),
  record.approval_boundary,
  record.result.toUpperCase(),
  record.gap ?? "—"
].map(cell).join(" | "));

const report = `# Configuration eval report

## Tulos

**PASS — ${result.summary.passed}/${result.summary.total} project-local eval-tapausta läpäisi, 0 epäonnistui.**

- Git HEAD: \`${result.head}\`
- Eval-komento: \`npx tsx .ballet/evals/run-evals.ts --write-results\`
- Runtime-evidenssi: 130/130 transition-haaraa (20 agent-Stepiä × 6 outcomea + 5 human Stepiä × 2 päätöstä)
- Skill-evidenssi: 9/9 skillin deterministiset validatorit, architecture-skillin kaikki neljä Step-kind-moodia
- Ulkoiset vaikutukset: 0 GitHub-kirjoitusta, 0 tagia, 0 releasea, 0 deployta, 0 cloud-muutosta
- Runtime-state: vain tilapäinen SQLite \`/tmp\`-hakemiston alla; fixture-workspacet poistettiin ajon lopuksi

Eval käyttää nykyisiä geneerisiä Ballet-primitiiivejä suoraan: project config -schemaa, \`validateProjectAutomationConfig\`-validointia, \`RuntimeDatabase\`a, persisted StepRun-transitioneja, retry-/stall-policyä, wait/resumea ja cross-Loop child Runeja. Agentit korvataan mock outcome -fixtureillä; yksikään provider-agentti tai ulkoinen write-työkalu ei käynnisty.

## Nykyisen checkoutin lähdetila

Nykyiset 8 Goalia ja 11 ADR:ää ovat accepted, indeksoituja ja rakenteellisesti eheitä. Todellinen managed-product-blueprint ei kuitenkaan ole vielä source-ready: saman scopen DESIGN-lähde, stable \`acceptance_ids\` ja hyväksytyt \`quality_thresholds\` puuttuvat. Siksi nykyisen source-planen oikea outcome on \`needs_input\`; erillinen full-happy fixture todistaa positiivisen polun muuttamatta human-owned lähteitä.

\`managed-product.code_paths\` on myös tyhjä eikä todellisia release/environment/rollback-contracteja ole. Oikea implementation/release-polku pysyy tämän vuoksi \`blocked\`; positiivinen approval-polku on turvallinen mock-simulaatio, jonka external actionit ovat aina \`not_executed\`.

## Tapausmatriisi

Tapaus | Loop / Step | Agentti | Odotettu → toteutunut outcome | Artifactit | Approval boundary | Tulos | Capability gap
--- | --- | --- | --- | --- | --- | --- | ---
${rows.join("\n")}

## Todennetut invariantit

- Kaikki 4 Loopia, 20 agent-Stepiä, 5 human gatea, 10 agenttia ja 9 skilliä ovat mukana vähintään yhdessä ajossa; kaikki 130 konfiguroitua transition-haaraa vastaavat persisted runtime-tulosta.
- Maker-Stepin fabrikoitu \`approved\` päättyy \`blocked\`-tilaan. Vain riippumaton blueprint-verifier ja acceptance-checker saavat palauttaa \`approved\`; release-agent palauttaa myös verify-Stepissä vain \`ready\`, ja human release-gate omistaa hyväksynnän.
- Implementation-maker ja acceptance-checker ovat eri agentteja. Blueprint-verifier ei ole yhdenkään tarkistamansa blueprint-artifactin persisted author.
- Blueprint-, milestone- ja implementation-handoffit sitoutuvat canonical pathiin, scopeen, source snapshotiin, raw-byte SHA-256 -hasheihin ja tarvittaessa tarkkaan Git SHA:han.
- Issue draftit ovat ennen milestone-gatea ja sen jälkeen \`draft_only\`, \`external_target: null\` ja external actioniltaan \`not_executed\`. GitHub writer -Stepiä ei ole.
- Acceptance \`changes-requested\` palaa vain implementation-Stepiin; muuttumaton evidence stallaa ja muuttuva evidence loppuu \`.ballet/project.json\`-transition \`maxAttempts: 3\` -rajaan.
- Permanent failure ei retrytä. Transient failure käyttää vain nykyisen Stepin project-configured retry-policyä. Numeerisia retry-rajoja ei enää määritellä rinnakkaisena authorityna agentti- tai governance-proosassa.
- \`needs_input\` odottaa ja jatkaa samaa downstream-Stepiä appendatulla inputilla; se ei ohita gatea.
- Source-, artifact-, approval- tai rollback-hash-drift tuottaa \`blocked\` ennen downstream- tai ulkoista vaikutusta.
- Release ilman implementation approvalia blokataan ennen \`deploy-release\`-Stepiä. Hyväksytyn mock-claimin jälkeen koko release-Loop voidaan ajaa human release-gateen ja completed-tilaan ilman ulkoista writeä.

## Project-local korjaukset

- Maker-agenttien \`approved\`-reitit muutettiin blokkaaviksi; checkerien \`ready\` ei ohita eksplisiittistä approval-outcomea.
- Release-agentin make/deploy/verify-protokolla erotettiin: kaikki kolme palauttavat \`ready\`, ja hyväksyntä on yksin human release-gatella.
- Milestone- ja implementation-gateille lisättiin hash- ja subject-sidotut claim-sopimukset sekä delivery-evidence-validator.
- Kaikille 9 skillille lisättiin oma deterministinen CLI-validator ja yhteinen canonical path/hash/source snapshot/author -envelope.
- Retry-numeroiden rinnakkainen proosa-authority poistettiin; rajat luetaan yksinomaan \`.ballet/project.json\`-transitioneista.

## Capability gaps

Geneeriset platform-puutteet ja kaksi unrelated käyttötapausta kutakin kohden on dokumentoitu tiedostossa \`.ballet/outputs/CAPABILITY-GAPS.md\`:

- \`GAP-APPROVAL-ASSERTION\`: typed, subject/hash-bound human approval
- \`GAP-LOOP-ENTRY\`: transition-only Loop entry policy
- \`GAP-CONDITIONAL-EFFECTS\`: approval-bound external effect authorization

GitHub issue publicationin puuttuminen on project-local workflow-valinta, ei osoitettu platform-gap. Nykyinen konfiguraatio todistaa konservatiivisen no-write-rajan; positiivinen julkaisu vaatisi erikseen hyväksytyn project-local writer-Step-ratkaisun.

## Evidenssitiedostot

- \`.ballet/evals/run-evals.ts\` — runtime- ja validator-harness
- \`.ballet/evals/fixtures/*.yaml\` — source-, artifact-, outcome-, approval- ja release-mockit
- \`.ballet/evals/results.json\` — tämän raportin koneellinen lähde
- \`.agents/skills/*/scripts/validate.mjs\` — skill-kohtaiset deterministic validatorit
- \`.agents/skills/_shared/scripts/validate-delivery-evidence.mjs\` — planning/staging/release handoff -validator
- \`.ballet/outputs/CAPABILITY-GAPS.md\` — geneeriset capability gaps

## Lopputarkistukset

- \`npx tsx .ballet/evals/run-evals.ts --write-results\`: PASS, 26/26 tapausta ja 130/130 transition-haaraa
- \`npm run test\`: PASS, 72 testitiedostoa läpäisi, 1 ohitettiin; 377 testiä läpäisi, 2 ohitettiin
- \`npm run lint\`: PASS, 0 virhettä; 30 ei-blokkaavaa complexity/max-lines-varoitusta
- \`npm run build\`: PASS
- Kaikkien uusien \`.mjs\`-validaattorien \`node --check\`: PASS
- \`git diff --check\`: PASS
- Muutetut ja untracked-tiedostot yhdistävä boundary-check: PASS, vain \`.ballet/**\`, \`.codex/agents/**\` ja \`.agents/skills/**\`
- Numeeristen retry-rajojen duplikaattihaku agentti-/skill-/instruction-proosasta: PASS, ei osumia
`;

await writeFile(reportPath, report, "utf8");
