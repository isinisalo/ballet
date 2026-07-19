# Execution composition — testisuunnitelma

Tila: ihmisen tarkistettava ehdotus. Testejä tai production-koodia ei lisätä tässä goalissa.

## Testauksen tavoite

Todentaa, että:

- authoring-malli on minimaalinen ja strict;
- Step omistaa execution profilen, yhden primary instructionin, skills-valinnat, task descriptionin ja molemmat targetit;
- composition on tavutasolla deterministinen;
- skillsit ja instructionit snapshottuvat Root Runin alkuun tarkkoine versioineen ja hasheineen;
- `approved | rejected` on erillään runtime-statuksesta;
- migration on loss-aware, idempotentti, fail-closed ja palautettavissa; sekä
- Node editor ymmärretään ilman runtime-termien tuntemusta.

## Tasot

| Taso | Vastuu |
|---|---|
| Schema/unit | Kentät, unionit, refit, canonicalisointi, hashing ja result/state-invarianssit |
| Domain/unit | Profile-dedupe, Step-mapping, origin-resolution, composition ja Transition-valinta |
| Persistence/integration | Project config, Run snapshot, immutable evidence, journal, backup ja recovery |
| Provider contract | Bundlen välitys, output schema, ambient discovery ja capability-preflight |
| UI/component | Node editorin kontrollit, tilat, copy, validointi ja saavutettavuus |
| Migration acceptance | Nykyrepositoryn golden fixture, idempotenssi, rollback ja historia |
| Boundary | Ei kiellettyjä entityjä, System-workflow'ta, settings-sivua tai template packia |

## Testifixturet

### F1 — Minimal runnable project

- yksi execution profile;
- yksi Project-primary instruction;
- ei skillejä;
- yksi Agent-Step ja kaikki terminaalit.

### F2 — Shared runtime

- kolme legacy-Agentia samalla provider/model/reasoning/network-tuplalla;
- viisi Stepiä;
- eri primary instructionit ja skills-listat.

### F3 — Origin collisions

- `builtin:review` ja `project:review`;
- samanniminen instruction ja skill eri kindissä;
- System-resurssi samalla local ID:llä.

### F4 — Invalid legacy data

- missing/disabled Agent;
- orphan runtime intentio ja orphan Agent;
- tyhjä instruction;
- missing, ambiguous, duplicate ja disabled skill;
- invalid JSON/TOML/frontmatter/UTF-8;
- path traversal ja symlink escape;
- non-empty agent-specific `readOnlyRoots`.

### F5 — Runtime history

- terminal v1 Root Run ja immutable ExecutionSpec;
- non-terminal Root Run;
- waiting-for-input Step;
- scheduled Step, jolla on schedule state.

### F6 — Nykyrepositoryn golden source

- 9 legacy-Agentia;
- 13 Agent- tai Scheduled-Stepiä;
- 5 uniikkia runtime-tuplea;
- 0 valittua skill-tiedostoa; ja
- local settingsissä orphan-empty `dev-deploy-agent: []` sekä existing instruction ilman eksplisiittistä ID:tä.

## Schema- ja domain-testit

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| DM-001 | Execution profile sisältää kuusi sallittua kenttää | Parse onnistuu |
| DM-002 | Profile sisältää instruction-, skill-, task-, `policy`- tai `workspaceAccess`-kentän | Strict schema hylkää tarkan pathin kanssa |
| DM-003 | Provider, model, reasoning effort tai network access puuttuu | Parse hylätään |
| DM-004 | Duplicate profile ID | Config hylätään |
| DM-005 | Agent-Stepillä on validi profile, yksi primary, tyhjä skills-lista ja kaksi targetia | Parse onnistuu |
| DM-006 | Primary puuttuu, on tyhjä, System-originia tai väärää kindiä | Save ja preflight hylkäävät |
| DM-007 | Skills-listassa on duplicate tai System-origin | Hylätään; ei hiljaista dedupea |
| DM-008 | Human- tai terminal-node sisältää execution compositionin | Strict schema hylkää |
| DM-009 | Scheduled-Step sisältää compositionin ja validin schedulen | Parse onnistuu |
| DM-010 | Unknown Role/Preset/Policy/Recipe/Template-kokoelma | V1 config hylkää |
| DM-011 | Uusi Step ilman eksplisiittistä profilea tai primarya | Ei fallbackia; näkyvä validation error |
| DM-012 | Sama profile name kahdella ID:llä | ID ratkaisee; UI disambiguoi tai authoring hylkää hyväksytyn päätöksen mukaan |

## Profile-dedupen testit

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| EP-001 | Sama `[provider, model, reasoning, network]` eri Agenteilla | Yksi profile |
| EP-002 | Jokainen tuplen neljästä arvosta muuttuu yksi kerrallaan | Neljä erillistä profilea |
| EP-003 | JSON property/map insertion order muuttuu | Sama canonical tuple, ID ja target bytes |
| EP-004 | Locale ja timezone vaihtuvat | Sama ID ja serialization |
| EP-005 | Model/reasoning vaihtaa kirjainkokoa | Eri tuple, koska arvot ovat case-sensitive |
| EP-006 | Hash-funktio saa tunnetun golden-tuplen | Täsmälleen odotettu 64-hex ID |
| EP-007 | Simuloitu hash-collision eri tupleille | Migration estyy |
| EP-008 | Ihminen muuttaa profile namea | Runtime equality ja Step ID -viite eivät muutu |

Lisäksi property-based-testi generoi valideja tupleja ja map-järjestyksiä varmistaen, että vain neljän semanttisen arvon muutos vaikuttaa dedupe-avaimeen.

## Origin- ja resource-testit

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| OR-001 | System-baseline | Täsmälleen yksi `system:execution-contract-v1`, mandatory, read-only, ei valitsimissa |
| OR-002 | Built-in ja Project samalla local ID:llä | Molemmat ratkaistuvat origin-scoped ID:llä ilman shadowingia |
| OR-003 | Built-in clone | Uusi Project-ID ja itsenäinen content; ei live-linkkiä |
| OR-004 | Clone ilman `use`-toimintoa | Step-ref ei vaihdu |
| OR-005 | Clone and use | Project-kopio ja Step-rebind tapahtuvat yhtenä validoituna toimintona |
| OR-006 | Project source path escape/symlink | Save/preflight estää |
| OR-007 | Raw source muuttuu, body ei | `sourceSha256` muuttuu, `contentSha256` pysyy |
| OR-008 | Bodyssa yksi tavu muuttuu | `contentSha256` ja bundle-hash muuttuvat |
| OR-009 | CRLF, CR ja BOM | Normalisoitu body vastaa määriteltyä LF/no-BOM-tulosta |
| OR-010 | Tyhjä body normalisoinnin jälkeen | Run estyy |
| OR-011 | System-body sisältää roadmap/milestone/release/deploy-menettelyä | Boundary-test ja manuaalinen review hylkäävät julkaisun |
| OR-012 | Project-resurssi snapshotataan | `sourceVersion` on `project/<projectSnapshotHash>` ja source/content-hashit vastaavat oikeita tavuja |
| OR-013 | System/Built-in-resurssi snapshotataan | `sourceVersion` sisältää Ballet- ja catalog-version sekä tarkat hashit |
| OR-014 | Nested Project-skill-path | `.agents/skills/review/security/SKILL.md` ratkaistuu vain ID:ksi `project:review/security` |
| OR-015 | Kaksi legacy-aliasia tai realpathia törmää | Ambiguous alias tai target-ID collision estää resoluution |
| OR-016 | Project instruction ilman ID:tä / invalidilla ID:llä | Missing-ID ei ole valittava resurssi; invalid/duplicate eksplisiittinen ID on katalogivirhe |

## Prompt composition -testit

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| PC-001 | System + primary + 0 skills | Golden bundle bytes/hash |
| PC-002 | Skills valitaan eri UI-järjestyksissä | Sama canonical order ja bundle-hash |
| PC-003 | Built-in- ja Project-skillsit sekaisin | Built-in ensin, sitten Project, kummassakin byte-sort |
| PC-004 | Duplicate skill | Authoring hylkää ennen renderöintiä |
| PC-005 | Skill sisältää markereita tai Markdown-otsikoita | Body säilyy muuttumatta boundaryjen sisällä |
| PC-006 | Primary tai skill ylittää kokorajan | Preflight failure; ei truncationia |
| PC-007 | Run input/history ylittää oman rajan | Vain task envelope käyttää versionoitua determinististä truncationia |
| PC-008 | Task description muuttuu | Task envelope hash muuttuu, instruction bundle hash ei |
| PC-009 | Execution profilen name muuttuu | Bundle hash ei muutu |
| PC-010 | Primary instruction muuttuu Root Runin jälkeen | Käynnissä oleva Run käyttää snapshotia; seuraava Run saa uuden hashin |
| PC-011 | Skill poistetaan Root Runin jälkeen | Resume/retry toimii snapshotista; seuraavan Runin preflight estyy |
| PC-012 | Provider adapter järjestää bundlea tai lisää ambient sourcea | Contract-test epäonnistuu/preflight estää |
| PC-013 | Additional instructions -kenttä yritetään lähettää V1:ssä | Schema hylkää |
| PC-014 | Target vaihtuu, instructionit samat | Bundle ei muutu; Step snapshot/task-control hash muuttuu |
| PC-015 | Body päättyy nollaan, yhteen tai useaan LF:ään | Length-prefix erottaa jokaisen golden-tapauksen ja bundle päättyy yhteen separator-LF:ään |
| PC-016 | Body sisältää bundle-headerin kaltaisen rivin | Parseri lukee byte lengthin mukaan; seuraava osa ei siirry |
| PC-017 | Sama task-envelope eri object insertion orderilla | `canonicalJsonV1` tuottaa samat UTF-8-tavut ja hashin |
| PC-018 | String control-, quote-, backslash- ja non-ASCII-merkeillä | Golden canonical JSON -escaping vastaa tavusopimusta |
| PC-019 | Providerille annettava output schema | `ballet-step-outcome/1` canonical bytes, hash ja adapter-versio tallentuvat evidenssiin |
| PC-020 | 20 001+ UTF-16 code unitin Run input, myös surrogate-rajoilla | `truncateMiddleV1` tuottaa määritellyt head/marker/tail-golden-tavut |
| PC-021 | Historyssä tasatimestampit, pitkät tekstit, checkit ja artifactit | V1-sort, compaction, neljän artifact-arvon raja ja 8192 byte -katkaisu tuottavat yhden golden envelopen |

Golden-testit vertaavat UTF-8-tavuja, eivät vain semanttisesti parseutunutta tekstiä.

## Root Run snapshot ja evidence

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| RE-001 | Kaikki reachable Stepit valideja | Yksi all-or-nothing execution plan ennen ensimmäistä queuea |
| RE-002 | Yksi myöhempi reachable Step viittaa puuttuvaan skilliin | Koko Root Run estyy, yhtään taskia ei queueata |
| RE-003 | Source muuttuu kesken resoluution | Source-hash race havaitaan, Run estyy |
| RE-004 | Evidence entry | Kind, origin, ID, version, source path tarvittaessa, raw/content hash ja content tallentuvat |
| RE-005 | Bundle evidence | Composition version, canonical skill list, bytes ja hash täsmäävät |
| RE-006 | Task/output evidence | Envelope- ja output schema -version/tavut/hash täsmäävät providerille annettuun |
| RE-007 | Cross-Loop transition | Lapsi-Loop käyttää alkuperäistä Root Run composition snapshotia |
| RE-008 | Retry/resume | Sama bundle-hash ja resource evidence |
| RE-009 | Evidenssin myöhempi hash mismatch | Integrity/corruption error; ei hiljaista executionia |
| RE-010 | Historiallinen ExecutionSpec v1 | Read-only-projektio toimii; tavut eivät muutu |
| RE-011 | Root Run snapshot luodaan ennen ensimmäistä yritystä | Staattinen snapshot sisältää Step/target/profile/resource/bundle-datan mutta ei tulevaa task envelopea |
| RE-012 | Retry tai resume muuttaa input/historyä | Composition snapshot -hash pysyy, uusi attempt envelope -tavu/hash tallentuu |
| RE-013 | Step-snapshotin kenttien insertion order muuttuu | `snapshotSha256` pysyy samana canonical JSON -säännöllä |

## StepResult- ja runtime-state-testit

| ID | Outcome/tapahtuma | Odotettu status/result/Transition |
|---|---|---|
| RS-001 | Completed + approved | Completed, `approved`, approved target |
| RS-002 | Completed + rejected | Completed, `rejected`, rejected target |
| RS-003 | Human approved | Completed, `approved`, approved target |
| RS-004 | Human rejected | Completed, `rejected`, rejected target |
| RS-005 | Needs input | Waiting/needs input, ei resultia, ei edgeä |
| RS-006 | Blocked outcome | Blocked, ei resultia, ei Rejected-edgeä |
| RS-007 | Provider/runtime failure | Failed, ei resultia, ei Rejected-edgeä |
| RS-008 | Cancel/timeout/policy failure | Vastaava state, ei resultia, ei edgeä |
| RS-009 | Outcome result ja StepRun result mismatch | Integrity failure; Transitionia ei seuraa |
| RS-010 | Result asetetaan non-completed-stateen | Schema/storage estää |

Tilakoneen property-testin invarianssi: Transition count kasvaa resultin perusteella vain tapauksissa, joissa StepRun on validisti valmis ja result täsmälleen yksi sallituista arvoista.

## UI-component-testit

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| UI-001 | Agent-Step avataan | Task, profile single select, primary single select, skills multi-select ja kaksi targetia näkyvät |
| UI-002 | Default disclosure state | Appearance ja Advanced ovat suljettuja |
| UI-003 | Appearance avataan | Node style ja Node size näkyvät |
| UI-004 | Advanced avataan | Node ID, type, applicable schedule ja read-only composition metadata näkyvät; ei additional/workspace-kontrolleja |
| UI-005 | Profile option | Näyttää ihmisen nimen; Node editor ei vaadi provider/model/reasoning/network-termejä |
| UI-006 | Primary options | Ryhmät Built-in ja Project; System ei optiona |
| UI-007 | Skills selection | Multi-select, canonical chips, count ja yksilölliset remove-labelit |
| UI-008 | Klikkausjärjestys vaihtuu | Chip/order-preview pysyy canonicalina |
| UI-009 | Puuttuva required-arvo | Inline error, `aria-invalid`, `aria-describedby`, Save ei onnistu |
| UI-010 | No skills | `No skills selected`, validi Step |
| UI-011 | Missing saved ref | Tarkka puuttuva ID ja blocking error; ei fallbackia |
| UI-012 | Human-Step | Ei tyhjiä disabled profile/instruction/skill-kontrolleja |
| UI-013 | Terminal node | Ei compositionia tai Transition-kontrolleja; Appearance toimii |
| UI-014 | Scheduled Step | Sama composition + schedule Advanced-osiossa |
| UI-015 | Keyboard-only | Selectit, multi-select, chip remove ja disclosuret toimivat |
| UI-016 | Mobile/container narrow | 40 px / 16 px kontrollit ja pinottu layout |
| UI-017 | Draft/save failure | Arvot säilyvät ja näkyvä form-wide sekä kenttävirhe |
| UI-018 | Run snapshot view | Composition read-only; exact refit/hashit tarkastettavissa |

Terminologian acceptance-testissä käyttäjälle annetaan Node editor -mock ilman ennakkoselitystä. Hyväksyntä: käyttäjä tunnistaa taskin, execution profilen, primary instructionin, skillsit ja molemmat jatkopolut eikä hänen tarvitse avata runtime-asetuksia.

## Migration unit- ja integration-testit

| ID | Tapaus | Odotettu tulos |
|---|---|---|
| MG-001 | Yksi Agent/Step | Runtime → profile, instruction → primary, skills → list |
| MG-002 | Sama Agent useassa Stepissä | Jokainen Step saa samat initial refit mutta omat listansa |
| MG-003 | Sama tuple usealla Agentilla | Yksi profile |
| MG-004 | Description/schedule/appearance/targets | Säilyvät täsmälleen |
| MG-005 | Disabled legacy skill | Ei kohdelistassa |
| MG-006 | Duplicate/missing/ambiguous skill | Koko migration estyy |
| MG-007 | Existing identical instruction | Idempotent reuse |
| MG-008 | Existing conflicting instruction | Estyy, ei suffix/overwritea |
| MG-009 | Orphan Agent/runtime | Estyy, ei automaattista Loopia |
| MG-010 | Non-empty readOnlyRoots | Estyy, ei profile-kenttää |
| MG-011 | Empty local key cleanup | Vain manifestissa nimetyt avaimet poistuvat; mode ja canonical after-tavut/hash täsmäävät |
| MG-012 | Active/waiting/finalizing Run | Migration estyy |
| MG-013 | Terminal history | Ei yhtään muuttunutta DB-evidence-tavua |
| MG-014 | Scheduled Step, jolla on state-rivi | Hash vaihtuu, nextRunAt/updatedAt säilyvät ja neljä last-kenttää muuttuvat nulliksi ilman kellolukua |
| MG-015 | Dry-run | Ei tiedostomuutoksia; plan/hash toistuu identtisenä |
| MG-016 | Apply kahdesti | Toinen ajo validoiva no-op |
| MG-017 | Mixed v8/v9 | Blocking error |
| MG-018 | Source muuttuu dry-run/apply-välissä | Apply estyy |
| MG-019 | Avatar/nickname-metadata | Raportoidaan; apply odottaa päätöstä, ei hiljaista pudotusta |
| MG-020 | Agent TOML cleanup | Tapahtuu vasta v9 reload-validoinnin jälkeen |
| MG-021 | Sama source eri file mtime/birthtime-, locale- ja timezone-arvoilla | Sama source manifest, target-tavut ja hashit |
| MG-022 | Raw TOML timestamp puuttuu | Generated instruction ei saa timestamp-riviä eikä filesystem-fallbackia |
| MG-023 | Agent ID ei ole lowercase kebab-casea | Blocking ID/path-virhe ennen stagingia |
| MG-024 | Agent TOML:ssa tuntematon top-level tai nested-kenttä | `unsupported_agent_field`; ei hiljaista data lossia |
| MG-025 | Weekly weekdays eri järjestyksessä ja duplicateilla | Sama mon–sun-normalisoitu v9 definition hash |
| MG-026 | Empty orphan local key | Sallittu vain manifestoituna cleanupina; non-empty vastine estää |
| MG-027 | Canonical project JSON ja generated Markdown | Byte-for-byte golden, yksi määritelty EOF-käytäntö |
| MG-028 | Source/target manifestin object/file enumeration order vaihtuu | Samat `sourceHash`/`targetHash`; actual target-byte-muutos vaihtaa hashin |
| MG-029 | Affected schedule state muuttuu juuri ennen commitia | Apply estyy ja jättää v8-lähteet voimaan |
| MG-030 | Config Agent ID, TOML basename ja file-set | Täsmälleen yksi direct-child `<agentId>.toml`; missing/extra/case/symlink estää |
| MG-031 | Skill path-, basename-, id- ja name-candidatet osuvat eri realpatheihin | Unionissa yli yksi; `ambiguous_skill`, ei precedence-fallbackia |
| MG-032 | Scheduled-Stepiltä puuttuu state-rivi tai rowssa on nullablet | Puuttuva sallitaan ilman patchia; jokainen null/string säilyy exact before/after-manifestissa |
| MG-033 | Nykyinen `dev-deploy-agent: []` local setting | After on mode `0600`, SHA-256 `4b8894d57dfa621e534ef4eb25263e8f00254cbcb4327f1f98796314ac279dde` |
| MG-034 | Symlink source/targetissa tai yhdessä ancestorissa | Inventory/apply estyy kaikille Agent/instruction/skill/config/settings-poluille |
| MG-035 | Scheduler, Root Run/resume/finalization tai config-writer yrittää mutaatiota applyn aikana | Shared lock odottaa; yksikään toimija ei näe hybriditilaa |
| MG-036 | Schedule CAS kohtaa muuttuneen before-kentän | DB rollback + journal recovery; scheduler pysyy pausella |
| MG-037 | Unfinished journal Ballet-startupissa | Scheduler ja Run API eivät käynnisty ennen determinististä recoverya |
| MG-038 | Existing instruction ilman ID:tä / invalidilla / duplicate-ID:llä | Missing ID säilyy unaddressable-warningina; invalid/duplicate estää |
| MG-039 | Jo käynnissä oleva shared-lock-waiter saa lockin migration-prosessin crashin jälkeen | Se havaitsee unfinished-journalin lockin saamisen jälkeen, ei koske tilaan ja siirtyy exclusive-recovery-protokollaan |
| MG-040 | Kaksi prosessia yrittää recoveryn samanaikaisesti | Tasan yksi saa exclusive lockin; toinen odottaa, ottaa shared lockin uudelleen ja validoi valmistuneen tilan |
| MG-041 | Rollback kilpailee uuden Root Runin, scheduler tickin tai config-writerin kanssa | Exclusive fence ja scheduler-pause sulkevat racen; ehdot tarkistetaan uudelleen `BEGIN IMMEDIATE` -transactionissa |
| MG-042 | Crash juuri ennen/jälkeen SQLite `COMMIT`:in | Exact all-before tekee CAS+commitin, all-after hyväksyy commitin ja mixed estyy manuaalirecoveryyn sekä forward- että rollback-suunnassa |
| MG-043 | Journal-write katkeaa temp-writeen, fsynciin, renameen tai directory-fsynciin | Korkein validi sequence/checksum-recordi valitaan; temp ohitetaan, invalid asennettu slot failaa suljetusti eikä stale-recordia arvata |
| MG-044 | Journal phase/next-operation vaihtuu | Immutable `manifest.json` ja `manifestSha256` pysyvät samoina; vain checksum-validi journal-slot saa uuden sekvenssin |
| MG-045 | Crash project-configin commit-point-renamen juuri ennen/jälkeen tai parent-directory-fsyncin aikana | Actual before valitsee `ifActualBefore = rollback`; actual after valitsee `ifActualAfter = finish-forward` |
| MG-046 | Journal direction/phase/nextOperation-yhdistelmien taulukko | Rollback sallii `rollback_discarding`/`rolling_back`/`rolled_back`; vain forward/`committed`+null ja rollback/`rolled_back`+null ovat terminaalisia; terminal phase + non-null on unfinished ja muut invalidit yhdistelmät estyvät |
| MG-047 | Next-operation-hashien golden-fixturet | File hash käyttää raw-tavuja/nullia, stage-install valittua after-imagea tai backupia, schedule-CAS canonical row-objectia ja DB-commit koko lajiteltua rowset-arrayta |
| MG-048 | `manifest.json`-tavu muuttuu tai journalin `manifestSha256` on väärä | Recovery failaa suljetusti; scheduleri/API/Run ei käynnisty eikä journalin vanhempaa slottia arvata |
| MG-049 | Migration-rootissa on useita valideja terminal-directoryja ja yksi unfinished-directory | UTF-8-byte-scan löytää täsmälleen unfinished-kohteen; directoryjen sisäisiä sekvenssejä ei verrata keskenään |
| MG-050 | Scan löytää kaksi unfinished-directorya, invalidin direct-childin tai manifestin/slotin puuttumisen | `manual_recovery`; scheduler/API/Run pysyvät suljettuina eikä aikaa, nimeä tai suurinta cross-directory-sekvenssiä käytetä voittajana |
| MG-051 | Crash commit pointin jälkeen ennen create/replacea; sibling-staging puuttuu | Recovery validoi immutable after-imagen, luo exact manifestoidun staging-pathin uudelleen ja finish-forward tuottaa after-hashin/moden |
| MG-052 | Valittu after-image/backup puuttuu tai vioittuu, installed stagingissä on eri sisältö, scratch ei ole valitun imagen prefiksi tai staging+scratch ovat yhtä aikaa olemassa | Recovery failaa suljetusti; se ei regeneroi domain-objektista, arvaa pathia tai ylikirjoita ristiriitaa |
| MG-053 | Crash migration-directoryn luonnin ja ensimmäisen validin `prepared`-recordin välissä | Exact v8 before-tila migration-directoryn ulkopuolella todistetaan; partial metadata jää fail-closed-manuaalikaranteeniin |
| MG-054 | Journal-directoryssa on vain yksi slot | Vain sequence 1 forward/`prepared` + null nextOperation hyväksytään; nolla slottia tai sequence ≥ 2 ilman counterpartia on invalid/manual recovery |
| MG-055 | Crash staging scratchin write/fsync/chmod/rename/parent-fsyncin ennen tai jälkeen forwardissa tai rollbackissa | Poissa oleva tai valitun imagen validi prefiksi poistetaan exact manifest-pathista ja luodaan uudelleen; installed exact staging hyväksytään |
| MG-056 | `scheduleBefore` ja `scheduleAfter` ovat byte-identtiset, esimerkiksi kaikilta Scheduled-Stepeiltä puuttuu state-rivi | Exact actual luokitellaan vain no-opiksi; forward/rollback ei tee CAS:ia, muu actual on mixed |
| MG-057 | Commit/rollback olisi terminaalinen mutta staging- tai staging-write-path on yhä olemassa | Terminal journalia ei kirjoiteta; tila jää fail-closed-recoveryyn, kunnes manifestin exact post-state toteutuu |
| MG-058 | Initial applyn tai uuden terminal-tilasta pyydetyn rollbackin staging/staging-write-pathissa on pre-existing file, tai kahden actionin pathit törmäävät | Operaatio estyy ennen `prepared`/`rolling_back`-recordia; tiedostoa ei lueta omaksi, poisteta, renameata tai ylikirjoiteta |
| MG-059 | Rollback palauttaa forward-delete Agent TOMLin ja forward-replace config/settings-tiedoston, fault jokaisessa staging/target-vaiheessa | Backup/before-state asentuu torn-write-safe-protokollalla; crash recovery päätyy exact v8:aan ilman direct target writea |
| MG-060 | Crash applyn staging-vaiheen jälkeen tai jokaisen instruction-renamen välissä ennen config commit pointia | Durable `rollback_discarding` poistaa exact käyttämättömät after-stage/prefix-scratchit journalisoidusti, vaihtaa vasta sitten `rolling_back`-vaiheeseen ja palauttaa targetit; lopputulos exact v8 |
| MG-061 | Crash durable `rolling_back` -recordin jälkeen jokaisessa before scratch/staging/target-vaiheessa | Recovery ei aja initial absence-precheckiä; validi manifest-owned välitila jatkuu idempotentisti exact v8:aan |
| MG-062 | Generated instructionin tai muun file-actionin destination-parent puuttuu | Dry-run/apply estyy `missing_target_parent`-virheeseen; migration ei luo authoring-target-directorya eikä jätä rollbackiin tyhjää hakemistoa |

## Fault-injection ja rollback

Injektoi virhe jokaisen seuraavan vaiheen ennen ja jälkeen:

- backup file write;
- backup fsync;
- immutable after-image write, read-back-validation ja fsync;
- backup- ja staging-parent-directory fsync;
- manifest write/fsync;
- instruction staging;
- project config staging;
- staging scratch write, file fsync, read-back, chmod/fsync, atomic install-rename, target rename ja destination-parent fsync sekä forward- että rollback-directionissa;
- forward→rollback direction-switch, jokaisen unused after-stage/prefix-scratchin delete-journal, unlink ja parent-fsync;
- target validation;
- mutation-fence acquisition ja scheduler-pause acknowledgement;
- SQLite `BEGIN IMMEDIATE`, jokainen schedule CAS sekä välittömästi ennen ja jälkeen DB commitin;
- jokainen write-ahead-journal-vaihe, journal-slotin temp-write/fsync/rename/directory-fsync ja tahallisesti katkaistu tai checksumiltaan virheellinen asennettu record;
- instruction rename;
- instruction parent-directory fsync;
- config commit-point rename;
- `.ballet/`-directory fsync;
- reload validation;
- Agent TOML cleanup;
- `.codex/agents/`-directory fsync;
- local settings/schedule cleanup;
- `.git/ballet/`-directory fsync; sekä
- journal committed -write.

Kun durable `prepared`-recordi on asennettu eikä fixture tahallisesti korruptoi tai monista recovery-metadataa, normaalissa forward-crash- tai I/O-faultissa automaattisen restart/recoveryn jälkeen todetaan yksi kahdesta sallitusta lopputuloksesta:

1. byte-for-byte alkuperäinen v8 ja recovery-ready journal; tai
2. kokonaan validoitu v9 ja manifestin mukainen viimeisteltävä cleanup.

Kolmas tulos, pysyvä fail-closed `manual_recovery`, sallitaan vain eksplisiittisissä corruption/ambiguity-fixtureissä (MG-048, MG-050 ja MG-052) tai crashissa migration-directoryn luonnin ja ensimmäisen validin durable `prepared`-recordin välissä. Pre-prepared-tapauksessa todistetaan, että kaikki migration-directoryn ulkopuoliset authoring-, settings- ja DB-arvot ovat exact source-manifestin v8 before-tilassa; vain osittainen local migration-metadata jää karanteeniin. Corruption/ambiguity-tapauksessa actual file- ja rowset-hashit, immutable imagejen hashit sekä kaikkien slottien raw-tavut raportoidaan, mutta stale-slot-fallbackia tai automaattista mutaatiota ei tehdä. Scheduler, authoring/config-API ja Run/resume/finalization pysyvät poissa käytöstä jokaisessa prosessissa, kunnes ihminen ratkaisee karanteenin.

Osittaista hybriditilaa ei koskaan tulkita validiksi eikä anneta käyttöön; manual-recovery-tapauksessa tila jää karanteeniin.

Rollback-directionin vastaava fault-matriisi ajetaan durable `rolling_back`-recordista alkaen. Automaattisen recoveryn ainoa normaali terminaalinen tulos on exact v8 + `rolled_back`; kesken recoveryn mahdollinen manifestin mukainen välitila ei avaudu schedulerille tai API:lle. Vain yllä erikseen nimetyt corruption/ambiguity-fixturet saavat päätyä manuaalikaranteeniin.

Rollback-testit:

- ennen ensimmäistä v9 Runia ja muuttumattomalla target-hashilla rollback palauttaa kaikki lähdetavut ja modet;
- v9 Runin jälkeen rollback estyy;
- käyttäjän target-muutoksen jälkeen rollback estyy eikä ylikirjoita;
- vain manifestissa migrationin luomiksi merkityt tiedostot poistetaan;
- backup-hakemiston permissionit ovat `0700`, tiedostojen `0600`;
- rollbackin aikana aloitettu Root Run, scheduler tick ja writer odottavat, minkä jälkeen ne näkevät vain kokonaisen v8-tilan; ja
- crash ennen/jälkeen rollbackin DB-commitin palautuu all-after/all-before-säännöllä, kun taas mixed rowset jää fail-closed-manuaalirecoveryyn.

## Nykyrepositoryn acceptance

F6-golden migrationin odotukset:

- 9 Agentia → 9 Project-primary instructionia;
- 9 runtime-intentiä → 5 execution profilea;
- 13 Agent- tai Scheduled-Stepiä → 13 profile/primary/skills-mappingia;
- 0 legacy skill-valintaa → 13 tyhjää `skillIds`-listaa;
- orphan-empty `dev-deploy-agent` poistuu local settingsistä ja tiedosto säilyy moodilla `0600`;
- `loop-engineer-minimal.md` tuottaa yhden unaddressable-warningin ja säilyy byte-identtisenä;
- Loop-, Step-, schedule-, description-, target- ja appearance-data säilyy;
- top-level `agents` ja Step `agentId` eivät jää targetiin; ja
- historiallinen Run-data ei muutu.

Golden target serialisoidaan fixtureen ja sitä verrataan byte-for-byte kaikilla tuetuilla locale/timezone-asetuksilla.

## Boundary- ja scope-testit

- V1 project schema ei sisällä Role-, Preset-, Policy-, Recipe- tai Template-entityä.
- Execution profile sisältää vain kuusi sallittua kenttää.
- System-resurssin corpus ei sisällä Balletin ohjelmistokehityksen roadmap-, milestone-, release- tai deploy-menettelyä.
- Workflow template tallentuu tavallisina project-local Loop/Step/instruction/skill-resursseina.
- Node editor ei sisällä settings-sivua, profile detail -editoria, template packia, additional instructions -kontrollia tai workspace access -kontrollia.
- Migration ei kirjoita GitHubiin, käynnistä deployta tai muuta historiallista evidenssiä.

## Toteutusvaiheen komennot

Kun production-implementaatio tehdään myöhemmässä goalissa, vähimmäisvalidointi on:

```text
npm run test
npm run lint
npm run build
```

Lisäksi ajetaan migrationin golden-, property-, fault-injection- ja rollback-testit erikseen nimetyllä testikomennolla sekä provider-adapterien fixture-contract-testit ilman oikeita CLI-prosesseja.

Tässä dokumentointigoalissa näitä komentoja ei vaadita, koska frontend-, backend-, shared-, package- tai build-tiedostoja ei muuteta. Paketin rakenteelle ajetaan sen sijaan status-, path-, linkki-, frontmatter- ja ristiriita-auditointi.

## Exit criteria implementation-goalille

- Kaikki DM-, EP-, OR-, PC-, RE-, RS-, UI-, MG- ja boundary-testit läpäisevät.
- Nykyrepositoryn golden-tulos on 5 profilea, 9 instructionia ja 13 Step-mappingia.
- Fault-injection ei jätä hybriditilaa.
- Run evidence todistaa jokaisen käytetyn instructionin ja skillin exact version/hash/contentin.
- Canvas aktivoi vain canonical resultin mukaisen Approved/Rejected-edgen.
- UI-terminologia täyttää käyttäjätestin ilman runtime-taustatietoa.
- Avoimet blocking-päätökset on ratkaistu ja vastaavat Goal/ADR-dokumentit hyväksytty erillisessä ihmisen päätöksessä.
