# Execution composition — strict v9 test plan

Status: superseded by the [Work Loop execution contract V3](../work-loop/EXECUTION-CONTRACT-V3.md) and the v10 test phases in the [implementation plan](../work-loop/IMPLEMENTATION-PLAN.md). The remainder is historical test evidence.

Tila: hyväksytty V1-testisopimus.

## Tavoite

Testaus todistaa, että:

- strict v9 on ainoa project config -malli;
- ExecutionProfile on ainoa runtime authoring -entity;
- Agent- ja Scheduled-Step omistavat Project-resource-compositionin;
- prompt on viiden sectionin deterministinen exact byte -sopimus;
- Root Run snapshot on immutable ja all-or-nothing;
- persisted `StepRun.result` on ainoa Transition-kontrollilähde;
- kaikki executable Step -tyypit voivat tehdä cross-Loop-transitionin;
- direct repository conversion säilyttää nykyisen observable workflow'n; ja
- platform-koodissa tai System instructionissa ei ole project-workflow-hardcodea.

## Tasot

| Taso | Vastuu |
|---|---|
| Schema/unit | Strict kentät, ID:t, viitteet, set-semantics, kokorajat ja status/result-invarianssit |
| Domain/unit | Profile-dedupe, resource resolution, prompt order, hashit ja Transition-valinta |
| Persistence/integration | Project config, immutable snapshot, exact evidence ja StepRun readback |
| Provider contract | Runtime tuple, exact prompt/schema bytes ja structured outcome |
| UI/component | Collections, editorit, blocking states, composition preview ja saavutettavuus |
| Conversion acceptance | Nykyrepositoryn direct tracked conversion ilman runtime-migrationia |
| Boundary | Ei Agent entityä, Built-in/clone/template-frameworkia tai project-workflow-hardcodea |

## Config- ja resource-testit

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| CFG-001 | Valid strict v9 config | Parse onnistuu |
| CFG-002 | `version: 8` tai top-level `agents` | Hylätään selkeällä strict v9 -virheellä |
| CFG-003 | Tuntematon top-level- tai profile-kenttä | Strict schema hylkää exact pathin kanssa |
| CFG-004 | ExecutionProfile sisältää täsmälleen kuusi kenttää | Parse onnistuu |
| CFG-005 | Profile ID ei ole lowercase kebab-case | Hylätään |
| CFG-006 | Duplicate profile ID | Config hylätään |
| CFG-007 | Profile name tyhjä | Hylätään |
| CFG-008 | Sama name eri profile-ID:illä | ID säilyy identitynä; UI disambiguoi |
| CFG-009 | `executionProfiles` eri input-järjestyksessä | Tallennus järjestää ID:n mukaan |
| CFG-010 | Executable Step viittaa puuttuvaan profileen | Save/preflight estää |
| CFG-011 | Executable Stepin task tyhjä | Hylätään |
| CFG-012 | Primary instruction puuttuu | Save/preflight estää |
| CFG-013 | Project instruction ilman ID:tä | Näkyy dokumenttina, ei selectable-resurssina |
| CFG-014 | Invalidi eksplisiittinen instruction ID | Katalogi/Run estyy |
| CFG-015 | Duplicate instruction ID | Root Run estyy exact tiedostoilla |
| CFG-016 | Primary ref osoittaa väärään/missing ID:hen | Root Run estyy |
| CFG-017 | Missing `SKILL.md` | Root Run estyy |
| CFG-018 | Skill pathissa invalidi segmentti | Katalogi/Run estyy |
| CFG-019 | Duplicate skill ID Stepillä | Hylätään, ei silent dedupea |
| CFG-020 | Skills valitaan eri järjestyksessä | Sama ID-järjestys ja prompt |
| CFG-021 | Human-Stepillä on composition-kenttä | Strict schema hylkää |
| CFG-022 | Terminalilla on composition tai `on` | Strict schema hylkää |
| CFG-023 | Scheduled-Stepillä on validi composition + schedule | Parse onnistuu |
| CFG-024 | Role/Preset/Policy/Recipe/Template/workspaceAccess/additionalInstructions | V1 schema hylkää |
| CFG-025 | Built-in-originin primary tai skill | V1 schema/resolver hylkää |

## Kokorajat

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| SIZE-001 | Primary instruction täsmälleen 128 KiB | Sallitaan |
| SIZE-002 | Primary instruction yli 128 KiB | Visible preflight error; ei truncationia |
| SIZE-003 | Yksi skill täsmälleen 128 KiB | Sallitaan |
| SIZE-004 | Yksi skill yli 128 KiB | Visible preflight error; ei truncationia |
| SIZE-005 | Exact prompt täsmälleen 512 KiB | Sallitaan |
| SIZE-006 | Exact prompt yli 512 KiB | Koko Root Run estyy; ei truncationia |

## Prompt composition -testit

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| PC-001 | System + primary + 0 skills + task + schema | Viisi sectionia oikeassa järjestyksessä; golden bytes/hash |
| PC-002 | Useita skills-tiedostoja | Jokainen oma section; ID-järjestys |
| PC-003 | UI-valintajärjestys vaihtuu | Exact prompt bytes ja SHA-256 pysyvät samoina |
| PC-004 | Primary body muuttuu yhdellä tavulla | Source SHA ja prompt SHA muuttuvat |
| PC-005 | Skill body muuttuu yhdellä tavulla | Source SHA ja prompt SHA muuttuvat |
| PC-006 | Task description/input muuttuu | Task section ja prompt SHA muuttuvat |
| PC-007 | ExecutionProfile name muuttuu | Prompt ei muutu; profile snapshot muuttuu |
| PC-008 | Section-body sisältää headingin kaltaisen rivin | Exact body säilyy; renderöinti on deterministinen |
| PC-009 | Sama snapshot eri localella/enumeration-järjestyksellä | Samat UTF-8-tavut |
| PC-010 | Provider-adapteri saa promptin | Täsmälleen evidenceen tallennetut bytes; ei reserializationia |
| PC-011 | Output schema | Version ja exact schema SHA vastaavat prompt-sectionia |
| PC-012 | System ID | Täsmälleen yksi `system:execution-contract-v1`; ei selectorissa |
| PC-013 | System body sisältää project-workflow'ta | Boundary-test epäonnistuu |
| PC-014 | System body ei vaadi checks/artifact refs tai salli raw hidden CoT | Contract-test epäonnistuu |
| PC-015 | Evidence | Composition version, Step ID, profile snapshot, origin/ID/path/source SHA, exact prompt+SHA ja schema version+SHA löytyvät |
| PC-016 | Evidence storage | Resource content ja exact prompt eivät monistu redundantteihin täyssisältökenttiin |
| PC-017 | Ambient provider context | UI/evidence-väite rajautuu Ballet-owned prompttiin |

Golden-testit vertaavat UTF-8-tavuja, eivät vain semanttisesti vastaavaa tekstiä.

## Root Run snapshot

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| SNAP-001 | Kaikki reachable compositionit valideja | Yksi immutable execution plan ennen ensimmäistä queuea |
| SNAP-002 | Yksi myöhempi reachable Step viittaa puuttuvaan resurssiin | Koko Root Run estyy; yhtään taskia ei queueata |
| SNAP-003 | Yksi reachable resource on liian suuri | Koko Root Run estyy |
| SNAP-004 | Source muuttuu resoluution aikana | Race/hash mismatch havaitaan; Run estyy |
| SNAP-005 | Checkoutin instruction muuttuu Runin jälkeen | Käynnissä oleva Run käyttää snapshotia; seuraava Run näkee muutoksen |
| SNAP-006 | Worktreen skill muuttuu Runin jälkeen | Sama Root Run käyttää snapshotia |
| SNAP-007 | `needs_input` resume | Sama composition/resource snapshot; uusi task context sallittu |
| SNAP-008 | Sykli palaa aiempaan Stepiin | Sama snapshot pysyy käytössä safety limitin sisällä |
| SNAP-009 | Cross-Loop handoff | Lapsi-Loop käyttää alkuperäistä Root Run snapshotia |
| SNAP-010 | Evidence hash korruptoituu | Integrity error; ei hiljaista executionia |

## StepResult ja runtime state

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| RES-001 | Completed + approved | Persistoi completed/result, readback, Approved target |
| RES-002 | Completed + rejected | Persistoi completed/result, readback, Rejected target |
| RES-003 | Provider outcome result on approved mutta persisted result readback rejected | Transition käyttää persisted rejected; mismatch on integrity error sovitun invariantin mukaan |
| RES-004 | Transition yritetään valita ennen persistence/readbackia | Testi epäonnistuu; polku ei ole sallittu |
| RES-005 | Human approved | Completed + persisted approved + Approved target |
| RES-006 | Human rejected | Completed + persisted rejected + Rejected target |
| RES-007 | Needs input | Sama Step pausettuu; ei resultia tai Transitionia |
| RES-008 | Needs-input resume | Jatkaa samaa Step Runia ja samaa snapshotia |
| RES-009 | Technical blocked | Blocked; ei resultia tai Transitionia |
| RES-010 | Runtime/provider failed | Failed; ei resultia tai Transitionia |
| RES-011 | Cancelled | Ei StepResultia tai Transitionia |
| RES-012 | Result non-completed-statuksella | Persistence/schema integrity error |
| RES-013 | Completed ilman resultia | Persistence/schema integrity error |

## Transitionit

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| TR-001 | Agent-Step → toinen Loop | Sallittu handoff |
| TR-002 | Human-Step → toinen Loop | Sallittu handoff |
| TR-003 | Scheduled-Step → toinen Loop | Sallittu handoff |
| TR-004 | Approved → local executable | Sallittu |
| TR-005 | Rejected → local terminal | Sallittu |
| TR-006 | User-defined cycle | Toimii yleisen transition safety limitin sisällä |
| TR-007 | Technical blocked/failed | Mikään domain-edge ei aktivoidu |
| TR-008 | Terminal editor/domain | Ei outgoing Transitionia |

## Direct conversion -testit

Nämä testit validoivat tracked repository -lopputuloksen; ne eivät testaa migration CLI:tä, journalia tai rollbackia.

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| CV-001 | 9 legacy Agentia | Kaikki mapataan yksiselitteisesti |
| CV-002 | 9 runtime intentiä | Täsmälleen 5 ExecutionProfilea tuple-dedupella |
| CV-003 | Profile-ID:t | Ihmisen ymmärrettävä lowercase kebab-case ja deterministic |
| CV-004 | Generated instructions | 9 tiedostoa `migrated-<agent-id>.md`, frontmatter-ID `<agent-id>` |
| CV-005 | Step primary refs | `project:<agent-id>`, ei `project:migrated-...` |
| CV-006 | 13 Agent-Stepiä | Jokaisella profile/primary/`skillIds: []`; ei `agentId`:tä |
| CV-007 | Loop/Step IDs ja order | Säilyvät |
| CV-008 | Descriptions ja transitions | Säilyvät |
| CV-009 | Schedule ja appearance | Säilyvät; nykyfixturellä 0 schedulea |
| CV-010 | Human ja terminals | Säilyvät ilman compositionia |
| CV-011 | Top-level `agents` | Poistuu |
| CV-012 | `.codex/agents/*.toml` | Poistuu tracked execution-lähteenä |
| CV-013 | Existing no-ID instruction | Säilyy tavallisena documenttina, ei selectable |
| CV-014 | Legacy Agent avatar/nickname/status | Ei uutta entityä; Step appearance ei katoa |
| CV-015 | Sama lähdekonversio | Sama v9 data ja järjestys |
| CV-016 | Observable workflow | 4 Loopia, 13 Agent-Stepiä, 4 Human-Stepiä ja 12 terminaalia säilyvät |

## Machine-local settings

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| LOCAL-001 | Vain `readOnlyRoots: []` | Local settings validi |
| LOCAL-002 | Checkout-wide absolute roots | Kaikki Stepit saavat saman read-only policyn |
| LOCAL-003 | Legacy `agentReadOnlyRoots` non-empty | Run estyy exact path/value/remediation-tiedolla |
| LOCAL-004 | Legacy `agentReadOnlyRoots` empty/orphan | Run estyy samalla tavalla; ei silent cleanupia |
| LOCAL-005 | Profile/Step yrittää sisältää roots/workspace accessin | Strict schema hylkää |

## UI-component-testit

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| UI-001 | Execution Profiles collection | Kortit/lista, metadata ja validation näkyvät |
| UI-002 | Profile create/edit/save | Vain Name/Provider/Model/Reasoning/Network ja explicit Save |
| UI-003 | Agent-Step | Task, required profile, required Project-primary, skills ja kaksi targetia näkyvät oikeassa orderissa |
| UI-004 | Scheduled-Step | Sama composition + schedule Advanced-osiossa |
| UI-005 | Human-Step | Ei profile/primary/skill-kontrolleja |
| UI-006 | Terminal | Ei composition- tai Transition-kontrolleja |
| UI-007 | Default disclosures | Appearance ja Advanced suljettuja |
| UI-008 | Appearance | Node style ja Node size |
| UI-009 | Advanced | Node ID, type, applicable schedule ja read-only composition IDs |
| UI-010 | Project Instructions collection | Title, ID, path, validation; no-ID doc ei selectorissa |
| UI-011 | Project Skills collection | Name/title, ID, path ja validation |
| UI-012 | Primary selector | Vain Project-options; System ei optiona |
| UI-013 | Skills keyboard | Multi-select, chips, remove ja popover toimivat näppäimistöllä |
| UI-014 | Skill order | Chips/preview aina ID-järjestyksessä; ei drag-reorderia |
| UI-015 | Missing resource | Exact ID/path ja blocking error; ei fallbackia |
| UI-016 | Unavailable profile | Valinta säilyy ja blocking reason näkyy |
| UI-017 | Composition preview | System, Project-primary, skills ID-orderissa, validity, origins ja IDs |
| UI-018 | Run snapshot view | Exact refs/hashit ja prompt-evidence read-only |
| UI-019 | Standalone Agent routes | Agent collection/editor ja `/run/agents/...` eivät ole saavutettavissa |
| UI-020 | Accessibility | Labels, descriptions, errors, fieldsetit, focus ja 40px/16px mobile controls |

## Visuaalinen browser-check

Avaa production- tai dev-UI selaimessa ja tarkista vähintään:

- Agent-Step;
- Scheduled-Step;
- Human-Step;
- Terminal-node;
- ExecutionProfile-editori;
- Project instruction -valitsin;
- Project skills multi-select; ja
- Step composition preview.

Normaalilla desktop-viewportilla Agent-Stepin task, profile, primary instruction, skills ja molemmat Transitionit ovat ymmärrettävissä ilman pitkää runtime-asetus- tai virhetransition-listaa. Tarkista myös keyboard focus, narrow layout ja terminalin Transition-kontrollien puuttuminen.

## Platform/project-boundary

- System corpus ei sisällä roadmap-, milestone-, issue-, katselmointi-, acceptance-, staging-, release- tai deploy-menettelyä.
- `backend/`, `frontend/` ja `shared/` eivät sisällä Ballet-repositoryn workflow-ID:itä tai tiedostonimiä.
- Project-workflow säilyy `.ballet/project.json`, `.ballet/instructions/**` ja `.agents/skills/**` -datana.
- V1 ei sisällä generic plugin/policy/resource-registry/migration/template-frameworkia.
- ExecutionProfile on ainoa uusi authoring-entity.

## Lopulliset komennot

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

Kaikkien ensimmäisen viiden komennon pitää läpäistä. Viimeinen boundary-scan ei saa palauttaa project-workflow-kohtaista osumaa platform-koodista.

## Exit criteria

- Kaikki yllä nimetyt config-, prompt-, snapshot-, result-, transition-, conversion-, local-settings-, UI- ja boundary-testit läpäisevät.
- Browser-check kattaa kaikki nimetyt editorit ja Step-tyypit.
- Nykyrepositoryn conversion tuottaa 5 profilea, 9 Project-instructionia ja 13 Step-mappingia menettämättä Loop-rakennetta.
- Independent read-only review ei löydä unresolved high-severity -ongelmaa.
