# Execution composition — avoimet toteutuspäätökset

Tila: Goal- ja ADR-arkkitehtuuriportit on ratkaistu ja hyväksytty. Tämä dokumentti seuraa niiden jälkeen avoimiksi jääviä toteutus-, migration-, UI- ja byte-sopimusten yksityiskohtia.

## Miten tätä dokumenttia luetaan

Step + `ExecutionProfile` -malli, strict v9 -kohde, Stepin composition-omistajuus, Root Run -snapshotraja ja workflow'n project-local-raja ovat hyväksyttyä arkkitehtuuria. Muut execution-composition-paketin tarkat schema-, UI-, migration-, prompt- ja testiratkaisut ovat edelleen ehdotuksia. Jos jokin alla oleva avoin yksityiskohta ratkaistaan toisin kuin pakettiehdotuksessa, kaikki affected-artifactit päivitetään keskenään yhtenäisiksi ennen production-implementaatiota.

`Blocking` tarkoittaa, ettei implementation- tai migration-apply saa alkaa ennen päätöstä. `Deferred` tarkoittaa, että V1 voidaan toteuttaa ilman capabilityä, kun lykkäys hyväksytään eksplisiittisesti.

## Ratkaistut Goal-portit

| Poistettu dokumentti | Kanoninen dokumentti | Ratkaisu |
|---|---|---|
| `goal-009` | `goal-004` | Sisältö yhdistetty kanoniseen Goaliin; `goal-009` poistettu |
| `goal-010` | `goal-003` | Sisältö yhdistetty kanoniseen Goaliin; `goal-010` poistettu |
| `goal-011` | `goal-002` | Sisältö yhdistetty kanoniseen Goaliin; `goal-011` poistettu |

Kaikki kahdeksan jäljelle jäävää Goal-dokumenttia ovat `accepted`.

## Ratkaistut ADR-portit

| Dokumentti | Ratkaisu | Tila |
|---|---|---|
| `adr-010` | `StepResult` on canonical `approved | rejected`; runtime state ei muodosta resultia | `accepted` |
| `adr-011` | Canvas- ja editorisemantiikka yhdistetty `adr-004`:ään; `adr-011` poistettu | `adr-004` on `accepted` |
| `adr-012` | Execution profile erotettu Step-owned instruction/skill-valinnoista; Agent ei välitä compositionia | `accepted` |
| `adr-013` | Workflow-yksityiskohdat kuuluvat eksplisiittisesti valittuihin skilleihin, eivät Systemiin | `accepted` |
| `adr-014` | Workflow-templatet ovat tavallista project-local dataa, eivät uusi entity tai pack | `accepted` |

ADR-002, ADR-004, ADR-005, ADR-006 ja ADR-008 on yhdenmukaistettu saman Step + `ExecutionProfile` -kohdearkkitehtuurin kanssa ja ne ovat `accepted`.

## Hyväksytty arkkitehtuuribaseline

- `.ballet/project.json` käyttää strict v9 -mallia ja sisältää `executionProfiles`-kokoelman sekä Loopit.
- Executable Step omistaa `executionProfileId`-, `primaryInstructionId`- ja `skillIds`-viitteet, task descriptionin sekä `approved`- ja `rejected`-Transitionit.
- Top-level Agent runtime -omistajuus, Stepin `agentId` ja standalone Agent Run eivät kuulu kohdemalliin. `.codex/agents` on vain eksplisiittisen migrationin lähde.
- Root Run snapshottaa atomisesti kaikki saavutettavat Loopit, Stepit, Transitionit, execution profilet, instructionit, skillsit ja teeman. Worktree-muutos vaikuttaa vasta seuraavaan Root Runiin.
- Workflow-järjestys on project-local Loop-dataa ja workflow-menettelyt ovat eksplisiittisesti valittuja Project-skillejä. Balletin omalle roadmap–milestone–release-ketjulle ei ole yleisen arkkitehtuurin erikoispolkua.
- Historialliset Agent-snapshotit säilyvät immutable read-only-historiana.
- Vain validoitu completed outcome tai Human-vastaus tuottaa `approved | rejected` -tuloksen; tekninen `blocked`, `failed`, `cancelled` tai `needs_input` ei aktivoi Transitionia.

## Blocking ennen V1-implementaatiota

### OD-001 — Kohdeskeeman versio ja kokoelmamuoto

Hyväksytty reunaehto: kohde on strict `.ballet/project.json` v9, jossa ovat `executionProfiles`-kokoelma ja Loopit.

Avoin toteutuskysymys: Onko `executionProfiles` ID:n mukaan lajiteltu lista vai ID-keyed map?

Paketin ehdotus: lista, jokaisella profilella eksplisiittinen `id`.

Vaihtoehto: ID-keyed map vähentäisi ID:n duplikointia mutta olisi ristiriidassa vaaditun kuusikenttäisen profilen kanssa tai vaatisi ID:n määrittelyn map-avaimeksi kentän sijaan.

Vaikutus: DATA-MODEL, migration serialization, schema- ja golden-testit.

### OD-003 — Agentin ei-execution-metadata

Hyväksytty reunaehto: top-level Agent tai muu Agent-identity-entity ei kuulu v9-authoring-malliin, eikä legacy-metadata saa palauttaa Agentia execution compositionin rinnalle.

Avoin toteutuskysymys: Miten `avatar`, enabled, nickname candidates, live status, Agent description ja timestamps raportoidaan, arkistoidaan tai poistetaan eksplisiittisessä migrationissa?

Paketin ehdotus: name/description/timestamps siirtyvät migrated instruction -provenanceen; `enabled: true` on migration-precondition; avatar/nickname/live status eivät kuulu V1 execution-malliin ja poistetaan vasta eksplisiittisen hyväksynnän jälkeen.

Vaihtoehdot koskevat vain migration-raporttia, backupia ja eksplisiittistä discard-menettelyä. Legacy-metadatalle ei luoda uutta authoring-entityä tai hiljaista Step-kenttää.

Vaikutus: Canvas-avatar, reasoning glow, Run timeline source, Agent status chips, migrationin data-loss-raja ja UI-reitit.

### OD-004 — Execution profile ID, nimi ja authoring-surface

Kysymykset:

- Käyttääkö migration full SHA-256 -pohjaista ID:tä?
- Onko generoitu nimi `<provider> <model> · <reasoning> · network on|off` hyväksyttävä väliaikainen nimi?
- Vaaditaanko profile name uniikiksi?
- Missä profilet luodaan, nimetään ja muokataan ilman settings-sivua?

Paketin ehdotus: full hash-ID, deterministinen migration-nimi, namea ei käytetä identitynä, Node editor vain valitsee olemassa olevan profilen. Erillinen Configure-kokoelmanäkymä voidaan suunnitella myöhemmän implementation-goalin sisällä; settings-sivua ei rakenneta.

Vaikutus: migrationin byte-determinismi, UI-disambiguointi ja authoring-polku.

### OD-005 — Project instructionin pysyvä identiteetti ja migration-polku

Kysymys: Onko Project-instructionin identity eksplisiittinen origin-scoped frontmatter-ID vai repo-relative path?

Paketin ehdotus: stable `project:<id>`; path on sijainti. Migration luo `.ballet/instructions/migrated-<agentId>.md` ja ID:n `project:migrated-<agentId>`. Existing identical target reuseataan; eri sisältö samalla pathilla/ID:llä estää migrationin.

Paketin ehdotus johtaa `origin: project` -arvon vain trusted rootista eikä kirjoita sitä frontmatteriin. Runtime ei saa luottaa käyttäjän muokattavaan origin-kenttään.

Vaikutus: rename-semantics, collision-policy, catalog, migration-idempotenssi ja Run evidence.

### OD-006 — Task descriptionin pakollisuus

Kysymys: Onko executable Stepin `description` eli UI:n `Task description` non-empty required?

Paketin ehdotus: kyllä uusille ja migroiduille executable Stepeille. Nykyrepositoryn kaikki käytetyt Stepit täyttävät ehdon.

Vaihtoehto: tyhjä description sallittaisiin, mutta Stepillä ei silloin olisi käyttäjälle tai providerille yksilöityä tehtävää.

Vaikutus: schema, Node editor, migration preflight ja empty-state-testit.

### OD-007 — Skillien set-semantics ja composition order

Kysymys: Ovatko skillsit V1:ssä järjestysriippumaton set vai käyttäjän järjestämä lista?

Paketin ehdotus: set; duplicate on virhe; canonical order on `builtin` ennen `project`, sitten origin-scoped ID:n UTF-8 byte -järjestys. UI ei tarjoa drag-reorderia.

Vaihtoehto: käyttäjän järjestämä lista vaatisi precedence-sopimuksen ja Advanced-order-editorin, eikä sitä pidä lisätä V1:een ilman käyttötapausta.

Vaikutus: prompt bytes, migrationin legacy-order-semantics, multi-select ja hashit.

### OD-008 — Skill-snapshotin tiedostoraja

Kysymys: Tarkoittaako valittu skill V1:ssä vain `SKILL.md`-tiedostoa vai koko skill-hakemiston determinististä manifestia, mukaan lukien referenced scripts/assets?

Paketin ehdotus: minimimallissa vain valittu `SKILL.md`; skill ei saa V1:ssä riippua snapshotoimattomasta tukitiedostosta.

Vaihtoehto: koko hakemisto. Tällöin tarvitaan path-, symlink-, size-, executable-mode-, manifest-order- ja per-file hash -sopimus.

Vaikutus: todellinen toistettavuus, evidence size, skill authoring ja turvallisuus.

### OD-010 — System/Built-in-katalogin resoluutio

Kysymykset:

- Onko pakollisen System-resurssin V1-ID `system:execution-contract-v1` ja ratkeaako se asennetusta read-only-katalogista?
- Pinnaako Step Built-in-version vai ratkeaako unversioned `builtin:<id>` jokaisen uuden Root Runin alussa asennettuun katalogiversioon?

Paketin ehdotus: käytä nimettyä System-ID:tä. Step viittaa unversioned Built-in-ID:hen; uusi Root Run käyttää asennettua versiota ja pinnaa evidenssiin `sourceVersion = ballet/<balletVersion>/catalog/<catalogVersion>` sekä tarkan source/content-hashin ja contentin. Explicit authoring-version pinning siirtyy myöhemmäksi.

Vaikutus: Ballet update -semantics, reproducibility ja missing Built-in -preflight.

### OD-011 — Providerien ambient instruction/skill discovery

Kysymys: Voidaanko Codex- ja Copilot-suorituksessa disabloida kaikki Ballet-evidenssin ulkopuolinen ambient instruction/skill discovery?

Paketin ehdotus: kyllä, tai provider ei ole V1 composition -capable ja preflight estää executionin.

Vaihtoehto: jos ambient sisältöä ei voi estää, determinismilupaus pitää rajata “Ballet-owned bundleen” ja ambient-lähteet tuoda näkyvään evidenceen. Tätä ei saa jättää implisiittiseksi.

Vaikutus: provider-adapterit, security boundary, prompt-hashien merkitys ja readiness.

### OD-012 — Instruction- ja bundle-kokorajat

Kysymys: Mitkä ovat Systemin, primary instructionin, yksittäisen skillin, skills-yhteismäärän ja canonical bundlen byte-rajat?

Paketin ehdotus: eksplisiittiset byte-rajat providerien yhteisen turvallisen minimin mukaan; ylitys estää Runin. Instruction- tai skill-contentia ei typistetä.

Vaikutus: schema/preflight, UI-error copy, provider-yhteensopivuus ja testifixturet.

### OD-013 — Machine-local `agentReadOnlyRoots`

Kysymys: Miten legacy agent-specific read-only roots käsitellään, kun Agent-viite poistuu?

Paketin ehdotus: non-empty arvo estää migrationin; empty/orphan-empty-avaimet voidaan poistaa manifestoidussa cleanupissa. Arvoja ei deduplikoida profileen eikä muuteta `workspace_access`-kentäksi.

Vaihtoehdot: Step- tai profile-kohtainen later policy, mutta se laajentaisi V1-mallia ja vaatii uuden ADR:n.

Vaikutus: migration apply, local settings schema ja permission policy.

### OD-015 — Migrationin triggeri, backup ja rollback

Kysymykset:

- Onko explicit `--dry-run` + `--apply` CLI oikea triggeri?
- Hyväksytäänkö checkout-kohtainen shared/exclusive cross-process mutation fence sekä fsyncattu write-ahead-journal turvallisuusrajanksi?
- Kuinka kauan local backup säilytetään?
- Onko erillinen rollback-komento tuettu ensimmäiseen v9 Runiin asti?
- Poistetaanko migrationin käsittelemät `.codex/agents/*.toml` reload-validoinnin jälkeen?

Paketin ehdotus: explicit CLI, ei startup-migrationia; kaikki Ballet-writerit osallistuvat samaan fenceen ja unfinished journal blokkaa schedulerin/Run API:n; backup säilyy vähintään ensimmäisen onnistuneen v9 Runin yli tai käyttäjän eksplisiittiseen cleanupiin; rollback vain ennen v9 Runia ja muuttumattomalla target-hashilla; legacy TOMLit poistetaan vasta commitin jälkeen.

Vaikutus: operatiivinen turvallisuus, legacy-cleanup ja CLI-scope.

### OD-016 — Scheduled Step definition hash ja state

Kysymys: Sisältääkö uusi definition hash schedulen lisäksi profile-, primary- ja skill-viitteet, ja resetöidäänkö olemassa oleva schedule state migrationissa?

Paketin ehdotus: definition hash sisältää kaikki nimetyt arvot. Olemassa olevassa affected state -rivissä säilytä `nextRunAt` ja `updatedAt`, vaihda definition hash ja nollaa last-occurrence-kentät. Älä lue migrationissa kelloa, luo puuttuvaa riviä tai dispatchaa missed occurrencea; scheduler jatkaa cursorista fencen vapauttamisen jälkeen.

Vaikutus: scheduler-idempotenssi, migration local state ja acceptance-testit.

### OD-017 — Balletin nykyisen workflow-ohjeen sijoitus

Kysymys: Miten `.ballet/instructions/loop-engineer-minimal.md`:n roadmap–milestone–release-sisältö jaetaan Project-skilleiksi ja primary instructioneiksi?

Hyväksytty reunaehto: Balletin workflow-järjestys kuuluu project-local Loop-dataan, menettelyt eksplisiittisesti valittuihin Project-skilleihin eikä sisältöä saa siirtää Systemiin.

Paketin ehdotus: älä siirrä, muuta tai valitse nykyistä tiedostoa automaattisesti Agent-migrationissa. Koska tiedostolta puuttuu eksplisiittinen instruction-ID, säilytä se tavallisena byte-identtisenä project-dokumenttina ja näytä `unaddressable_instruction`-warning; se ei ole V1-valitsimissa. Tee sisällön jaottelu erillisenä project-data authoring -muutoksena.

Vaikutus: `goal-002`:een yhdistetty Balletin oman kehitysworkflow'n tavoite ja sen execution composition.

### OD-018 — DESIGN.md ja Agent-sidonnaiset visuaalit

Kysymys: Hyväksytäänkö, että implementation-goal päivittää `DESIGN.md`:n Agent Execution-, avatar-, reasoning glow- ja Run-route-kohdat ennen frontend-muutosta?

Paketin ehdotus: kyllä, rajatusti uuden päätöksen mukaiseksi. Nykyinen goal ei saa muuttaa `DESIGN.md`:ää.

Vaikutus: UI-konventioiden ristiriidattomuus, Canvas appearance ja root AGENTS.md:n noudattaminen.

### OD-019 — Advanced-osion sisältö ja type-vaihdon draft

Kysymys: Hyväksytäänkö Advanced-osioon Node ID, Step type, applicable schedule ja read-only composition metadata? Säilytetäänkö saman editorisession composition-draft, jos type vaihtuu väliaikaisesti Humaniksi ja takaisin?

Paketin ehdotus: Advanced sisältää nimetyt nykyiset/tekniset tiedot eikä future-placeholderia. Type-vaihto Humaniksi poistaa composition-kentät tallennettavasta draftista; takaisin vaihto vaatii eksplisiittiset valinnat, ellei UX-testillä perustella session-only restorea.

Vaikutus: yksinkertainen pääeditori, accidental data loss ja UI-testit.

### OD-020 — Built-in clone provenance

Kysymys: Tallennetaanko Project-kopioon `clonedFrom`-metadata?

Paketin ehdotus: optional provenance kyllä, mutta ei runtime-linkkiä, override-semanticsia tai auto-updatea.

Vaikutus: authoring-auditointi; ei execution-hashia muuten kuin Project-lähteen tavujen osana.

### OD-021 — Node editorin termi ja uuden Stepin oletukset

Kysymykset:

- Onko `Execution profile` ymmärrettävä label ilman provider/model/reasoning/network-termien näyttämistä?
- Alkaako uusi executable Step tyhjillä required profile- ja primary-valinnoilla?

Paketin ehdotus: käytä labelia `Execution profile` ja ihmisen nimeämää optionia. Aloita molemmat required-valinnat tyhjinä; älä valitse katalogin ensimmäistä vaihtoehtoa tai muuta Stepiä hiljaisesti Humaniksi.

Vaikutus: Node editorin ymmärrettävyys, default-state, validation copy, accessibility- ja käyttäjätestit.

### OD-022 — Project-resurssin identiteetti ja versio

Kysymykset:

- Johdetaanko Project-skillin ID `.agents/skills/`-juureen suhteutetusta POSIX-hakemistopolusta?
- Onko kaikkien Project-resurssien `sourceVersion` saman Root Run configuration snapshotin `project/<projectSnapshotHash>`?

Paketin ehdotus: kyllä. Skill-polun jokainen segmentti on lowercase kebab-casea; `.agents/skills/review/security/SKILL.md` on `project:review/security`. `projectSnapshotHash` lasketaan `.ballet/`- ja `.agents/skills/`-juurten canonical file manifestista. Yksittäisen resurssin tarkat tavut erottaa `sourceSha256`.

Vaihtoehto: Project-skillillä voisi olla eksplisiittinen frontmatter-ID ja resurssikohtainen versionumero. Se vaatisi rename-, collision- ja version bump -sopimukset.

Vaikutus: skill rename, migration-aliasit, Run evidence, snapshot invalidation ja reproduktio.

### OD-023 — Canonical tavut, hashit ja migration-formaatit

Kysymys: Hyväksytäänkö `PROMPT-COMPOSITION.md`:n `canonicalJsonV1`, length-prefixed instruction bundle, task-envelope/output-schema -versiointi ja yrityskohtainen evidenssi sekä `MIGRATION-PLAN.md`:n source/target manifesti-, pretty JSON- ja generated Markdown -tavusopimukset?

Paketin ehdotus: kyllä. Versioi jokainen sopimus; sama versio ei saa riippua localesta, object insertion orderista, tiedostojärjestelmän enumerationista, kellonajasta tai birthtime/mtime-arvosta. Hashaa aina todelliset serialisoidut tavut.

Vaihtoehto: standardoitu ulkoinen canonical JSON -profiili voidaan valita, jos kaikki tuetut runtimet tuottavat todistetusti samat golden-tavut. Tällöin kaikki paketin esimerkit ja testivektorit pitää päivittää ennen implementaatiota.

Vaikutus: profile-dedupe, prompt/evidence-hashit, schedule definition, dry-run/apply-idempotenssi, rollback ja cross-platform-testit.

## Hyväksytyt V1-rajaukset

### OD-024 — `workspace_access: read-only | write`

Päätös: kenttä on deferred eikä sitä lisätä V1:een. Mahdollinen myöhempi lisäys vaatii uuden päätöksen.

Ennen myöhempää päätöstä tarvitaan:

- provider capability -matriisi;
- worktree- ja permission-policy enforcement;
- read-only Stepin outcome/finalization-semantics;
- write-yrityksen tarkka failure;
- preflight ja Run evidence; sekä
- oma ADR ja testisuunnitelma.

Nykyinen V1-baseline on kirjoitettava Root Run worktree. Tätä ei tallenneta profileen näennäisenä kenttänä.

### OD-025 — Additional instructions

Päätös: V1:ssä ei ole additional instructions -kenttää, API:a tai UI:ta. Mahdollinen insertion point on primaryn jälkeen ja ennen skillejä, mutta määrä, order ja precedence päätetään vasta käyttötapauksen ja uuden päätöksen kanssa.

### OD-026 — Workflow template -katalogi

Päätös: V1 käyttää tavallista project-local dataa ja optional yksittäisen Built-in-lähteen clonea. Packia, marketplacea, registryä tai Template/Recipe-entityä ei rakenneta. Mahdollinen myöhempi discovery tai sharing vaatii uuden päätöksen.

## Review-checklist

Ratkaistut arkkitehtuurikohdat:

- [x] yhdistää `goal-009` → `goal-004`, `goal-010` → `goal-003` ja `goal-011` → `goal-002` sekä hyväksyä jäljelle jäävät Goalit;
- [x] yhdistää `adr-011` → `adr-004` sekä hyväksyä `adr-010`, `adr-012`, `adr-013` ja `adr-014`;
- [x] lukita Step + `ExecutionProfile` -omistajuus, strict v9 -kohde ja Root Runin atominen snapshotraja;
- [x] säilyttää historiallinen Run-evidenssi immutable read-only-historiana; ja
- [x] rajata OD-024–OD-026 V1:n ulkopuolelle.

Ennen toteutuksen tai migration-applyn aloittamista pitää vielä:

- [ ] päättää avoimet OD-001, OD-003–OD-008, OD-010–OD-013 ja OD-015–OD-023 tai hyväksyä niille eksplisiittinen default;
- [ ] varmistaa, ettei Agentin metadataa tai local settings -dataa katoa hiljaisesti;
- [ ] hyväksyä migrationin current-repository golden counts 9 → 5 profilea, 9 instructionia ja 13 Step-mappingia;
- [ ] hyväksyä tarvittava rajattu `DESIGN.md`-päivitys tulevassa implementation-goalissa; ja
- [ ] päivittää proposal-tason DATA-MODEL-, MIGRATION-, UI-, PROMPT- ja TEST-dokumentit yhdessä aina, kun avoin yksityiskohta ratkaistaan.
