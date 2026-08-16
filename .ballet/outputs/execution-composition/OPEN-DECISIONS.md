# Execution composition — ratkaistut V1-päätökset

Status: superseded by [ADR-015](../../adr/adr-015-work-loop-state-ja-loop-orchestrator.md). The remainder records resolved strict-v9 decisions and is not an active contract.

Tila: kaikki strict v9 ExecutionProfile + Step execution composition -toteutusta estäneet päätökset on ratkaistu. Avoimia V1-blockereita ei ole.

## Kanoninen baseline

- `.ballet/project.json` tukee vain strict version 9 -mallia.
- `ExecutionProfile` on ainoa runtime authoring -entity.
- Agent- ja Scheduled-Step omistavat taskin, profile-viitteen, yhden Project-primary instructionin, Project-skill-setin sekä Approved/Rejected-targetit.
- Human-Stepillä ei ole execution compositionia.
- Terminal-nodeilla ei ole execution compositionia tai Transition-kontrolleja.
- Root Run snapshottaa kaiken reachable execution-datan atomisesti.
- Persisted `StepRun.result` on Transition engineä ohjaava ainoa tulos.
- Workflow-järjestys ja menettelyt ovat project-local dataa, eivät platform- tai System-sisältöä.

## Ratkaisut

| ID | Päätös |
|---|---|
| OD-001 | `executionProfiles` on lista, jokaisella itemillä eksplisiittinen ID. Lista tallennetaan ID:n mukaiseen deterministiseen järjestykseen. |
| OD-003 | Agentin avatar-, nickname-, live-status- ja muu identity-metadata ei saa v9 execution -kohdetta. Stepin appearance säilyy. Top-level Agentia ei palauteta toisen entityn nimellä. |
| OD-004 | ExecutionProfile ID on yksikäsitteinen lowercase kebab-case ja ihmisen ymmärrettävä. Name on non-empty display-arvo, ei identity. Authoring käyttää yhtä Configure-kokoelmaa ja `/execution-profiles`-reittiä sekä explicit Savea. |
| OD-005 | Project instructionin identity tulee frontmatterin `id`-kentästä; path ei ole identity. Konversio luo tiedoston `migrated-<agent-id>.md`, mutta frontmatter-ID on `<agent-id>` ja Step-viite `project:<agent-id>`. |
| OD-006 | Kaikkien executable Steppien task description on non-empty required. |
| OD-007 | `skillIds` on set-semanttinen lista. Duplicate on virhe, UI:ssa ei ole drag-reorderia ja composition order on origin-scoped ID:n UTF-8 byte -järjestys. |
| OD-008 | V1 snapshottaa vain valitun `SKILL.md`-tiedoston. Skill ei saa executionissa riippua snapshotoimattomista tukitiedostoista. |
| OD-010 | V1:ssä on yksi fixed read-only `system:execution-contract-v1`. Selectable Built-in instruction- tai skill-katalogia ei toteuteta. |
| OD-011 | Evidenssin determinismiväite rajataan Balletin muodostamaan exact prompttiin. Ballet ei väitä todistavansa providerin koko sisäistä tai ambient-kontekstia. |
| OD-012 | Yksi primary instruction enintään 128 KiB, yksi skill enintään 128 KiB ja koko Ballet-owned prompt enintään 512 KiB. Ylitys estää Runin eikä sisältöä typistetä. |
| OD-013 | V9 local settings käyttää checkout-kohtaista `readOnlyRoots: string[]` -kenttää. Legacy `agentReadOnlyRoots` -propertyn läsnäolo estää Runin exact remediation -ohjeella; Ballet ei poista tai siirrä arvoja. |
| OD-015 | Repository muunnetaan suoraan breaking pre-release -muutoksena. Ei migration CLI:tä, dry-run/applyta, journalia, backupia, rollbackia, startup-migrationia tai v8-readeria. |
| OD-016 | Tracked schedule-data ja current observable workflow säilyvät konversiossa. Konversio ei rakenna schedule-state-migration- tai recovery-protokollaa. |
| OD-017 | Balletin roadmap-, milestone-, issue-, acceptance-, release- ja deploy-menettelyt pysyvät `.ballet/project.json`-, Project instruction- ja Project skill -datana. Niitä ei siirretä Systemiin tai platform-koodiin. |
| OD-018 | `DESIGN.md` päivitetään samassa implementation-goalissa poistamaan Agent-owned execution, avatar-authoring ja standalone Agent Run -konventiot sekä määrittelemään ExecutionProfile- ja Step-composition-pinnat. |
| OD-019 | Appearance sisältää Node style- ja Node size -kentät. Advanced sisältää Node ID:n, Step typen, applicable schedulen ja read-only composition-ID:t. Molemmat ovat oletuksena suljettuja; future-placeholder-kontrolleja ei ole. |
| OD-020 | Built-in clone provenancea tai `clonedFrom`-kenttää ei lisätä, koska clone-to-project ei kuulu V1:een. |
| OD-021 | UI-termi on `Execution profile`. Uusi executable Step alkaa ilman required profile- ja primary-valintaa; käyttäjän pitää valita molemmat eksplisiittisesti. |
| OD-022 | Project-primary ID tulee frontmatterista. Project-skill ID tulee `.agents/skills/`-relative hakemistopolusta, jonka jokainen segmentti on lowercase kebab-case. Evidenssi tallentaa relative pathin ja source SHA-256:n. |
| OD-023 | Promptissa on viisi selkeillä versionoiduilla otsikoilla rajattua sectionia. Ballet tallentaa ja hash-aa täsmälleen providerille välitetyt UTF-8-tavut. Yleistä custom canonical JSON -frameworkia ei rakenneta. |
| OD-024 | `workspaceAccess` ei kuulu ExecutionProfileen, Stepiin, API:in tai UI:hin. |
| OD-025 | Additional instructions ei kuulu V1-skeemaan, API:in tai UI:hin. |
| OD-026 | V1:ssä ei ole workflow-template-katalogia, Built-in clonea, packia, marketplacea, registryä tai Template/Recipe-entityä. |

## Täydentävät runtime-päätökset

### Transitionit

Agent-, Human- ja Scheduled-Stepin `approved` ja `rejected` voivat kumpikin kohdistua saman Loopin executable nodeen, saman Loopin terminaaliin tai toiseen Loopiin. Runtime state ei muodosta Transitionia. Käyttäjän syklejä ei estetä workflow-oletuksen perusteella; yleinen transition safety limit jää voimaan.

### System instruction

`system:execution-contract-v1` sisältää vain:

- instruction-auktoriteetin;
- tool- ja permission-rajojen noudattamisen;
- salaisuuksien käsittelyrajan;
- structured outcome -sopimuksen;
- kiellon palauttaa raakaa hidden chain-of-thoughtia; ja
- vaatimuksen raportoida ajetut tarkistukset ja artifact-viitteet.

Se ei sisällä project-workflow'ta tai Ballet-repositoryn erityissääntöjä.

### Prompt ja evidence

Composition order on System → primary → skills ID-järjestyksessä → task envelope → output schema. Evidence sisältää composition-version, Step ID:n, ExecutionProfile-snapshotin, resurssien originin/ID:n/Project-relative pathin/source SHA-256:n, exact promptin ja prompt SHA-256:n sekä output-schema-version ja schema SHA-256:n. Sama täysi sisältö tallennetaan vain yhteen snapshot/evidence-kohtaan.

### Persisted StepResult

Completed-outcome validoidaan, `completed` status ja result persistoidaan, Step Run luetaan takaisin storesta ja Transition valitaan vain takaisin luetusta `StepRun.result`-kentästä. `needs_input` pausettaa saman Stepin. Technical `blocked`, `failed` ja `cancelled` eivät tuota StepResultia tai Transitionia. Invalidi persisted status/result-yhdistelmä on integrity error.

## Review-checklist

- [x] strict v9 listamuoto ja kuusikenttäinen ExecutionProfile;
- [x] Step-owned Project-primary ja Project-skills;
- [x] Project-only V1-resurssit ja fixed System instruction;
- [x] direct pre-release conversion ilman migration-subsystemia;
- [x] immutable all-or-nothing Root Run snapshot;
- [x] viiden sectionin exact prompt, hashit ja kokorajat;
- [x] fail-closed legacy machine-local setting;
- [x] persisted StepRun-resultin readback;
- [x] all-Step-type cross-Loop ja syklien säilytys;
- [x] ExecutionProfile-, Node editor- ja composition preview -UI;
- [x] platform/project-workflow-raja; ja
- [x] ei unresolved V1-blockeria.
