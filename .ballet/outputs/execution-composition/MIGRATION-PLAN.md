# V8 Agent -mallista strict v9 execution compositioniin — suora konversio

Status: superseded by [ADR-015](../../adr/adr-015-work-loop-state-ja-loop-orchestrator.md) and the [Work Loop v10 implementation plan](../work-loop/IMPLEMENTATION-PLAN.md). The remainder is historical migration evidence.

Tila: hyväksytty ja tämän repositoryn tracked dataan sovellettava pre-release-konversio.

## Menettely

Ballet ei ole tuotannossa, joten repository muunnetaan yhtenä breaking tracked-data-muutoksena. Tämä ei ole runtime-migration:

- ei v8-readeria;
- ei v8/v9 dual-writea;
- ei startup-migrationia;
- ei migration CLI:tä tai dry-run/apply-protokollaa;
- ei backup-, journal-, recovery- tai rollback-frameworkia; ja
- ei historiallisten pre-release Runien compatibility-projektiota.

Konversio on all-or-nothing repository-edit. Production-runtime hyväksyy sen jälkeen vain strict v9:n.

## Lähdeinventory

Konversion lähde sisälsi:

- 9 top-level v8 Agentia ja 9 täsmäävää `.codex/agents/<agent-id>.toml`-tiedostoa;
- 4 Loopia;
- 13 Agent-Stepiä;
- 4 Human-Stepiä;
- 12 terminal-nodea;
- 0 Scheduled-Stepiä;
- 5 uniikkia `[provider, model, reasoning effort, network access]` -tuplea;
- 0 valittua skill-tiedostoa; ja
- yhden `.ballet/instructions/loop-engineer-minimal.md`-dokumentin ilman eksplisiittistä instruction-ID:tä.

Jokainen executable Step viittasi täsmälleen yhteen olemassa olevaan, enabled Agentiin. Jokaiselle Agentille oli täsmälleen yksi TOML, kaikki runtime-tuplat olivat täydellisiä, skill-valintoja ei ollut eikä generated instruction -poluissa tai ID:issä ollut collisionia. Mapping oli yksiselitteinen, joten `needs_input`-pysäytystä ei tarvittu.

## ExecutionProfile-deduplikointi

Profilet deduplikoidaan täsmälleen providerin, modelin, reasoning effortin ja network accessin yhdistelmällä. Ihmisen ymmärrettävä ID muodostuu muodossa:

```text
<provider>-<model-slug>-<reasoning>-network-on|off
```

Profilet ovat:

| ID | Name | Tuple | Legacy Agentit |
|---|---|---|---|
| `codex-gpt-5-6-luna-medium-network-off` | Codex GPT-5.6 Luna · Medium · Network off | codex / gpt-5.6-luna / medium / off | `implementation-plan-agent`, `test-plan-agent` |
| `codex-gpt-5-6-luna-medium-network-on` | Codex GPT-5.6 Luna · Medium · Network on | codex / gpt-5.6-luna / medium / on | `milestone-issues-agent` |
| `codex-gpt-5-6-sol-medium-network-off` | Codex GPT-5.6 Sol · Medium · Network off | codex / gpt-5.6-sol / medium / off | `architecture-agent`, `roadmap-agent`, `ui-design-agent` |
| `codex-gpt-5-6-terra-medium-network-off` | Codex GPT-5.6 Terra · Medium · Network off | codex / gpt-5.6-terra / medium / off | `implementation-agent` |
| `codex-gpt-5-6-terra-medium-network-on` | Codex GPT-5.6 Terra · Medium · Network on | codex / gpt-5.6-terra / medium / on | `acceptance-test-agent`, `release-agent` |

`executionProfiles` tallennetaan yllä olevassa ID-järjestyksessä. Nimi ei ole identity, ja myöhempi nimen muutos ei muuta Step-viitettä.

## Project-primary instructionit

Jokaisen käytetyn legacy-Agentin decoded `developer_instructions` siirtyy yhteen Project-instructioniin:

| Agent ID | Project-viite | Tiedosto |
|---|---|---|
| `acceptance-test-agent` | `project:acceptance-test-agent` | `.ballet/instructions/migrated-acceptance-test-agent.md` |
| `architecture-agent` | `project:architecture-agent` | `.ballet/instructions/migrated-architecture-agent.md` |
| `implementation-agent` | `project:implementation-agent` | `.ballet/instructions/migrated-implementation-agent.md` |
| `implementation-plan-agent` | `project:implementation-plan-agent` | `.ballet/instructions/migrated-implementation-plan-agent.md` |
| `milestone-issues-agent` | `project:milestone-issues-agent` | `.ballet/instructions/migrated-milestone-issues-agent.md` |
| `release-agent` | `project:release-agent` | `.ballet/instructions/migrated-release-agent.md` |
| `roadmap-agent` | `project:roadmap-agent` | `.ballet/instructions/migrated-roadmap-agent.md` |
| `test-plan-agent` | `project:test-plan-agent` | `.ballet/instructions/migrated-test-plan-agent.md` |
| `ui-design-agent` | `project:ui-design-agent` | `.ballet/instructions/migrated-ui-design-agent.md` |

Tiedoston frontmatter `id` on täsmälleen legacy Agent ID ilman `migrated-`-prefiksiä. Prefiksi kuuluu vain tiedostonimeen. `title` tulee Agentin käyttäjälle näkyvästä nimestä ja body decoded `developer_instructions` -sisällöstä. System instructionia tai project-workflow-skilliä ei lisätä bodyyn.

`loop-engineer-minimal.md` säilyy tavallisena project-dokumenttina. Koska sillä ei ole validia frontmatter-ID:tä, se ei ole selectable primary instruction eikä sitä valita Stepille automaattisesti.

## Step-mapping

Jokainen v8 Agent-Step saa:

- Agentin runtime-tuplasta johdetun `executionProfileId`-viitteen;
- `primaryInstructionId: project:<agent-id>`;
- `skillIds: []`; ja
- ei `agentId`-kenttää.

Mapping:

| Legacy Agent | ExecutionProfile | Käytetyt Stepit |
|---|---|---|
| `acceptance-test-agent` | `codex-gpt-5-6-terra-medium-network-on` | `milestone-delivery/review-implementation` |
| `architecture-agent` | `codex-gpt-5-6-sol-medium-network-off` | `blueprint-design/data-model`, `blueprint-design/c4-models` |
| `implementation-agent` | `codex-gpt-5-6-terra-medium-network-off` | `milestone-delivery/implement-milestone` |
| `implementation-plan-agent` | `codex-gpt-5-6-luna-medium-network-off` | `milestone-planning/implementation-plan` |
| `milestone-issues-agent` | `codex-gpt-5-6-luna-medium-network-on` | `milestone-planning/plan-milestone-issues` |
| `release-agent` | `codex-gpt-5-6-terra-medium-network-on` | `release-validation/make-git-release`, `release-validation/deploy-release`, `release-validation/verify-release` |
| `roadmap-agent` | `codex-gpt-5-6-sol-medium-network-off` | `blueprint-design/roadmap` |
| `test-plan-agent` | `codex-gpt-5-6-luna-medium-network-off` | `milestone-planning/test-plan` |
| `ui-design-agent` | `codex-gpt-5-6-sol-medium-network-off` | `blueprint-design/ui-design`, `blueprint-design/ui-mocks` |

Human-Stepit ja terminaalit säilyvät ilman execution composition -kenttiä.

## Säilytettävä data

Konversio säilyttää byte- tai domain-semanttisella tasolla:

- Loop ID:t ja järjestyksen;
- Step ID:t, tyypit ja nodejärjestyksen;
- non-empty task descriptionit;
- `on.approved`- ja `on.rejected`-targetit;
- Loop start -viitteet;
- schedule-datan, jos sitä olisi;
- `nodeStyle`- ja `nodeSize`-appearance-datan; sekä
- terminal-nodet.

Konversio ei muuta Looppien observable workflow-rakennetta eikä luo compact dogfooding-looppeja. Roadmap-, milestone-, issue-, acceptance-, release- ja deploy-nimet jäävät project-local Loop- ja instruction-dataan; mikään niistä ei siirry platform-koodiin tai System instructioniin.

## Poistettava legacy

Kun strict v9 config ja kaikki Project-instructionit ovat valideja:

- configin top-level `agents` poistuu;
- executable Steppien `agentId` poistuu;
- käsitellyt `.codex/agents/*.toml`-tiedostot poistuvat tracked project-datasta;
- Agent avatar-, nickname-, live-status- ja standalone Run -entityt eivät saa v9-kohdetta; ja
- `.codex/agents` ei jää snapshot- tai execution-lähteeksi.

Stepin itsenäinen `nodeStyle` ja `nodeSize` säilyvät. Reasoning glow voidaan johtaa valitusta ExecutionProfilesta ilman Agent-avatar-entityä.

## Machine-local legacy setting

`.git/ballet/settings.json` ei ole tracked conversion -kohde. Nykyisessä checkoutissa havaittu:

```json
{
  "version": 1,
  "agentReadOnlyRoots": {
    "dev-deploy-agent": []
  }
}
```

Legacy-kentän läsnäolo estää Runin myös tyhjällä arvolla. Ballet ei poista sitä hiljaisesti. Remediation on käyttäjän eksplisiittinen local settings -muutos:

1. siirrä kaikki edelleen tarvittavat polut checkout-tason `readOnlyRoots`-listaan;
2. poista koko `agentReadOnlyRoots`-property; ja
3. nykyisen tyhjän orphan-arvon tapauksessa käytä `readOnlyRoots: []`.

Run preflight näyttää tämän ohjeen ja legacy-kentän exact sijainnin.

## Valmis lopputulos

Konversio on valmis, kun:

- `.ballet/project.json` on strict version 9 ja sisältää vain `version`, `executionProfiles` ja `loops`;
- 5 ExecutionProfilea kuvaa 9 legacy runtime-tuplaviitettä;
- 9 Project-primary instructionia säilyttää Agent instruction -sisällöt;
- kaikki 13 executable Stepiä omistavat profile-, primary- ja skills-viitteensä;
- 4 Loopin workflow-, Transition- ja appearance-rakenne säilyy;
- top-level Agent, `agentId`, `.codex/agents` ja standalone Agent Run eivät jää aktiiviseen polkuun; ja
- sama tracked lähde tuottaa saman v9-tuloksen ilman runtime-migration-frameworkia.
