# Agent-mallista Step execution compositioniin — migration-suunnitelma

Tila: ihmisen tarkistettava ehdotus. Migrationia ei toteuteta eikä ajeta tässä goalissa.

## Tavoite ja lähde

Migration muuntaa strict v8 -projektin hyväksytyn arkkitehtuurin mukaiseen strict v9 -kohteeseen ilman hiljaista fallbackia tai historiallisten Run-evidenssien uudelleenkirjoitusta. Tämän dokumentin tarkka migration-protokolla on edelleen ihmisen tarkistettava ehdotus.

V8-lähteet:

| Lähde | Nykyinen omistajuus |
|---|---|
| `.ballet/project.json.agents[agentId]` | `provider`, `model`, `reasoning`, `policy.network` |
| Agent- tai Scheduled-Step | `agentId`, `description`, `on.approved`, `on.rejected`, type/schedule/appearance |
| `.codex/agents/<agentId>.toml` | nimi, kuvaus, `developer_instructions`, skills/`skills.config`, enabled ja appearance-metadata |
| `.agents/skills/**/SKILL.md` | skillin Project-sisältö |
| `.git/ballet/settings.json` | mahdolliset agenttikohtaiset machine-local `readOnlyRoots` |
| `.git/ballet/state.sqlite` | immutable historialliset Run-, plan- ja ExecutionSpec-snapshotit |

Authoring-Agentissa ei nykyisin ole kanonista `skillIds`-kenttää. Migration ratkaisee Agentin `skills`/`skills.config`-valinnat nykyisen lukumallin kautta ja muodostaa niistä kohde-Stepin `skillIds`-listan.

## Kohde yhdellä rivillä

```text
legacy Step.agentId
  ├─ Agent runtime tuple       → Step.executionProfileId
  ├─ Agent developer instruction → Step.primaryInstructionId
  └─ Agent enabled skills       → Step.skillIds
```

`description`, `on.approved` ja `on.rejected` säilyvät Stepin omistamina. `agentId` ja top-level `agents` poistuvat v9 authoring-mallista.

## Ehdotettu käyttömalli

Migration ei ole startupin hiljainen sivuvaikutus. Ehdotettu käyttöliittymä on eksplisiittinen CLI-operaatio:

```text
ballet migrate execution-composition --dry-run
ballet migrate execution-composition --apply
```

`--dry-run` tuottaa deterministisen planin, warningit, blocking-virheet, source-hashin ja target-hashin kirjoittamatta mitään. `--apply` hyväksyy vain saman lähdehashin; jos lähde on muuttunut dry-runin jälkeen, käyttäjän pitää muodostaa uusi plan.

CLI-nimi ja triggeri vaativat ihmisen hyväksynnän, mutta muu suunnitelma olettaa tätä eksplisiittistä polkua.

## Preconditions

Apply estetään ennen yhtään kirjoitusta, jos:

- `.ballet/project.json.version` ei ole täsmälleen `8`;
- JSON-, TOML- tai skill-lähde ei parseudu nykyisen strict-mallin mukaan;
- toinen config-mutaatio tai migration pitää checkout-lockia;
- Root Run, execution task, waiting-for-input-Step tai finalisointi ei ole terminaalitilassa;
- worktree cleanup tai aiempi migration-journal on ratkaisematta;
- source-hash muuttuu planin muodostamisen aikana;
- käytetty Step viittaa puuttuvaan tai disabled Agentiin;
- käytetyltä Agentilta puuttuu runtime-intentio tai non-empty instruction;
- Agent tai runtime-intentio on orphan eikä sille ole yksikäsitteistä kohdetta;
- skill-viite puuttuu, on epäyksikäsitteinen, duplicate tai path traversal/symlink -riskinen;
- käytetyllä tai orphan-Agentilla on non-empty machine-local `readOnlyRoots`;
- legacy Agent ID ei ole lowercase kebab-casea tai ei muodosta turvallista target-ID:tä ja -polkua;
- Agent TOML sisältää dokumentoidun legacy-skeeman ulkopuolisen kentän;
- generated instruction-, project config-, local settings- tai Agent TOML -targetin destination-parent puuttuu;
- target-instruction-polussa on eri sisältö; tai
- lähde on jo osittain v9-muotoinen.

Virheet lajitellaan ensin source pathin UTF-8 byte -järjestyksessä, sitten vakaalla error codella. Migration ei tee best-effort-osajoukkoa.

Tyhjä tai orphan-Agentiin kuulunut tyhjä `agentReadOnlyRoots`-avain ei yksin estä migrationia. Sen poistaminen on sallittu vain manifestiin yksilöitynä machine-local cleanupina; non-empty arvo estää aina.

## Deterministinen byte-sopimus

Tämä suunnitelma käyttää `PROMPT-COMPOSITION.md`:ssä määriteltyä `canonicalJsonV1`-algoritmia. Kaikki repository-polut normalisoidaan repositoryjuureen suhteutetuiksi POSIX-poluiksi, path escape hylätään ja path-listat lajitellaan UTF-8-tavujen nousevaan järjestykseen.

### Source manifest ja source-hash

Dry-run rakentaa seuraavan semanttisen manifestin:

```ts
interface FileContentStateV1 {
  mode: string;
  size: number;
  sha256: string;
}

interface FileStateV1 extends FileContentStateV1 {
  path: string;
}

interface SourceManifestV1 {
  format: "ballet-execution-composition-source-v1";
  projectConfigVersion: 8;
  files: FileStateV1[];
  scheduleState: ScheduleStateRowV1[];
}
```

`files` sisältää raw-tavuina luetun `.ballet/project.json`-tiedoston, kaikki `.codex/agents/*.toml`-tiedostot, kaikki instruction-ID/collision-katalogiin luetut `.ballet/instructions/**/*.md`-tiedostot, kaikki skill-alias-katalogiin luetut `.agents/skills/**/SKILL.md`-tiedostot ja `.git/ballet/settings.json`-tiedoston, jos se on olemassa. `mode` on nelinumeroinen lowercase octal -merkkijono, `size` tavumäärä ja `sha256` raw-tavujen lowercase SHA-256.

`ScheduleStateRowV1` sisältää täsmälleen kaikki `loop_schedule_state`-rivin semanttiset arvot:

```ts
interface ScheduleStateRowV1 {
  loopId: string;
  stepId: string;
  definitionHash: string;
  nextRunAt: string | null;
  lastScheduledAt: string | null;
  lastStatus: "started" | "skipped" | "missed" | null;
  lastRunId: string | null;
  lastError: string | null;
  updatedAt: string;
}
```

Kaikki taulun rivit exportoidaan; string-arvot säilytetään täsmälleen tietokannasta luettuina, null säilyy nullina eikä timestampia reformatoida. `definitionHash` on 64 lowercase hex-merkkiä. `nextRunAt`, `lastScheduledAt` ja `updatedAt` validoidaan non-null-arvoina samaan exact `YYYY-MM-DDTHH:mm:ss.sssZ` UTC-instant -muotoon kuin Agent-timestampit. Rivit lajitellaan `(loopId, stepId)`-parin UTF-8 byte -järjestykseen. Rivi, jolle ei ole täsmälleen yhtä v8 Scheduled-Stepiä, estää migrationin; puuttuva rivi validille Scheduled-Stepille on sallittu. `sourceHash = SHA-256(UTF8(canonicalJsonV1(sourceManifest)))`.

SQLite-tiedoston fyysisiä tavuja ei hashata: non-terminal runtime-tila, lockit ja affected schedule -rivit luetaan uudelleen ja verrataan manifestiin heti ennen commit pointia. Muutos estää applyn.

### Target manifest ja target-hash

Target manifestin tarkka rakenne on:

```ts
interface LocalSettingsPatchV1 {
  path: ".git/ballet/settings.json";
  removedAgentIds: string[];
  before: FileContentStateV1;
  after: FileContentStateV1;
}

interface ScheduleStatePatchV1 {
  loopId: string;
  stepId: string;
  before: ScheduleStateRowV1;
  after: ScheduleStateRowV1;
}

interface TargetManifestV1 {
  format: "ballet-execution-composition-target-v1";
  sourceHash: string;
  schemaVersion: 9;
  targetFiles: FileStateV1[];
  deletedAgentTomlPaths: string[];
  localSettingsPatch: LocalSettingsPatchV1 | null;
  scheduleStatePatches: ScheduleStatePatchV1[];
}
```

`targetFiles` sisältää canonical v9 project JSONin ja jokaisen generated tai reused instructionin. File- ja delete-listat, `removedAgentIds` sekä schedule-patchit lajitellaan aiemmin määritellyllä UTF-8 byte -säännöllä. Before/after ovat kokonaisia objekteja; `localSettingsPatch` on eksplisiittisesti null, kun muutosta ei ole. Omitted defaultia tai osittaista DB-row'ta ei käytetä.

`targetHash = SHA-256(UTF8(canonicalJsonV1(targetManifest)))`. Planin `targetHash` todistaa sekä varsinaiset target-tavut että kaikki cleanupit; pelkkä in-memory object -hash ei riitä.

### Canonical target -tavut

V9 project config valmistellaan näin:

1. object-avaimet lajitellaan rekursiivisesti `canonicalJsonV1`:n UTF-8 byte -säännöllä;
2. `executionProfiles` lajitellaan ID:n mukaan ja jokainen `skillIds` canonical skills -järjestykseen; Loop- ja node-arrayt sekä muut semanttiset arrayt säilyttävät lähdejärjestyksen;
3. lajiteltu arvo serialisoidaan alla määritellyllä `prettyJsonV1`-algoritmilla;
4. loppuun lisätään täsmälleen yksi LF; ja
5. tiedosto on UTF-8 ilman BOMia.

`prettyJsonV1` käyttää `canonicalJsonV1`:n scalar- ja string-escaping-sääntöjä sekä samaa object-key-järjestystä. Tyhjä object/array on yhdellä rivillä `{}`/`[]`. Non-empty object alkaa `{` + LF, kirjoittaa jokaisen entryn omalle rivilleen nykyinen indent + kaksi U+0020-välilyöntiä, canonical JSON -keyn, `: ` ja rekursiivisen arvon, erottaa entryt pilkulla + LF ja päättyy LF + nykyinen indent + `}`. Non-empty array käyttää samaa rakennetta merkeillä `[`/`]`, yhtä itemiä per rivi ja pilkku + LF -erotinta. Trailing commaa tai muuta whitespacea ei ole. `prettyJsonV1` itsessä ei lisää EOF-LF:ää; tiedostowriter lisää yllä nimetyn yhden LF:n.

Target `.ballet/project.json` säilyttää source-moden. Uusi generated instruction luodaan moodilla `0644`; byte-identtisesti reused instruction säilyttää nykyisen modensa. Mode kuuluu target manifestiin, joten sen muutos vaihtaa `targetHash`-arvon.

Generated instructionin tavujono on täsmälleen seuraavien osien konkatenointi:

1. literal `---\n`;
2. literal `id: `, safe lowercase kebab-ID ja LF;
3. literal `title: `, Agent-nimen `canonicalJsonV1`-string-token ja LF;
4. optional literal `description: `, descriptionin `canonicalJsonV1`-string-token ja LF;
5. optional literal `createdAt: `, validoidun ISO-timestampin `canonicalJsonV1`-string-token ja LF;
6. optional literal `updatedAt: `, validoidun ISO-timestampin `canonicalJsonV1`-string-token ja LF;
7. literal `---\n\n`; sekä
8. normalisoidun `developer_instructions`-bodyn UTF-8-tavut.

Optional-rivit ovat mukana vain, jos raw TOML sisältää vastaavan non-empty arvon; niiden keskinäinen järjestys on yllä oleva. Migration ei käytä tiedostojärjestelmästä johdettua birthtime/mtime-arvoa: puuttuva timestamp jätetään pois. `origin` johdetaan trusted rootista eikä sitä kirjoiteta frontmatteriin.

Bodylle tehdään vain BOM-poisto ja CRLF/CR → LF -normalisointi. Jos body ei pääty LF:ään, lisätään yksi; jos se päättyy yhteen tai useampaan LF:ään, ne säilytetään eikä uutta lisätä. JSON-double-quoted YAML-scalarit käyttävät `canonicalJsonV1`-string-escapingia.

## Vaihe 1: read-only inventory

1. Ota checkout-kohtainen eksklusiivinen migration/config-lock.
2. Lue `.ballet/project.json` tavutasolla ja validoi v8.
3. Lue `.codex/agents/*.toml` normalisoidussa path-järjestyksessä.
4. Hydratoi jokainen Agent nykyisellä instruction- ja skill-resoluutiolla.
5. Lue Project instruction -ID-katalogi ja kaikki Project `SKILL.md` -lähteet collision- ja alias-multimapeiksi; laske jokaisen luetun lähteen source-hash.
6. Lue machine-local settings ja non-terminal runtime-state read-onlyna.
7. Tallenna inventoryyn source path, file mode, byte length ja lowercase SHA-256.
8. Varmista, että kaikki top-level runtime-intentiot ja Agentit ovat käytettyjä tai pysäytä migration orphan-virheeseen.

Inventory ei luokittele `.ballet/instructions/loop-engineer-minimal.md`-dokumenttia System-ohjeeksi eikä automaattisesti valitse sitä millekään Stepille. Project instruction -katalogi indeksoi vain tiedoston, jolla on eksplisiittinen validi frontmatter-ID. Missing-ID-tiedosto säilyy byte-for-byte tavallisena project-dokumenttina, raportoidaan `unaddressable_instruction`-warningina eikä voi törmätä tai tulla valituksi; eksplisiittinen invalidi tai duplicate ID on blocking. Nykyinen `loop-engineer-minimal.md` jää tällä säännöllä muuttumattomaksi OD-017:n erillistä authoring-päätöstä odottamaan.

Jokainen configin Agent ID validoidaan muodolla `[a-z0-9]+(?:-[a-z0-9]+)*`. Sille pitää olla täsmälleen yksi direct-child regular file polussa `.codex/agents/<agentId>.toml`; symlink, case-insensitive vaihtoehto, eri basename tai alihakemistossa oleva tiedosto ei kelpaa fallbackiksi. Jokainen ylimääräinen `.codex/agents/*.toml` on orphan ja estää migrationin. Vasta tämän bijektion jälkeen ID:tä käytetään target-instruction-ID:ssä tai polussa.

Raw Agent TOML validoidaan erikseen ennen hydratoitua lukumallia. Sallitut top-level-avaimet ja tyypit ovat:

- `name`: required string, jossa on trimmaamisen jälkeen vähintään yksi merkki; target säilyttää alkuperäisen stringin;
- `description`: optional string; tyhjä string jätetään targetista pois, muu säilytetään täsmälleen;
- `enabled`: optional boolean, jonka puuttuva arvo tarkoittaa legacy-defaultia `true`; viitatun Agentin `false` estää;
- `developer_instructions`: required string, jonka normalisoidussa bodyssa on trimmaamisen jälkeen vähintään yksi merkki;
- `createdAt` ja `updatedAt`: optional string muodossa `YYYY-MM-DDTHH:mm:ss.sssZ`; arvon pitää olla validi UTC-instant ja round-tripata täsmälleen samaan stringiin;
- `avatar`: optional nykyisen `AgentAvatar`-enumin string;
- `nickname_candidates`: optional array non-empty stringejä; sekä
- `skills`: optional, jompikumpi tarkasti jäljempänä määritellyistä kahdesta muodosta.

Muu top-level-avain, väärä tyyppi, tuntematon nested-kenttä tai non-finite TOML-arvo tuottaa `unsupported_agent_field`- tai typed validation -virheen; migration ei coercea eikä pudota tuntematonta dataa. Tunnettu mutta kohteeton avatar/nickname-metadata raportoidaan erikseen OD-003:n mukaisesti.

## Vaihe 2: execution profilejen canonicalisointi

Jokaisen käytetyn Agentin strict-skeeman läpäissyt tuple on:

```text
[provider, model, reasoning, network]
```

Kanoninen avain on `canonicalJsonV1`-serialisoitu JSON-array täsmälleen tässä kenttäjärjestyksessä UTF-8:na, esimerkiksi:

```json
["codex","gpt-5.6-sol","medium",false]
```

Säännöt:

- `provider` tulee validoidusta enumista;
- `model` ja `reasoning` käyttävät skeeman trimmaamaa arvoa mutta säilyvät case-sensitiveinä;
- `network` on boolean;
- Agent ID, property insertion order, profile name, locale, kellonaika tai Step-järjestys ei kuulu avaimen laskentaan; ja
- sama tuple tuottaa yhden profilen riippumatta siitä, montako Agentia tai Stepiä sitä käytti.

Migration-ID:

```text
execution-profile-<64 lowercase SHA-256 hex of canonical tuple bytes>
```

Eri tuple samalla hashilla on blocking collision. Profiilin deterministinen migration-nimi on:

```text
<provider> <model> · <reasoning> · network on|off
```

Kohdeprofile:

```json
{
  "id": "execution-profile-…",
  "name": "codex gpt-5.6-sol · medium · network off",
  "provider": "codex",
  "model": "gpt-5.6-sol",
  "reasoningEffort": "medium",
  "networkAccess": false
}
```

Profiilit serialisoidaan ID:n UTF-8 byte -järjestyksessä. Ihminen voi myöhemmin nimetä profilen uudelleen ilman dedupe-semanticsin muuttamista; rename-käytäntö vaatii erillisen authoring-päätöksen.

## Vaihe 3: Agent instructionien muuntaminen

Jokaiselle käytetylle legacy-Agentille luodaan yksi Project-originin primary instruction:

```text
reference: project:migrated-<legacyAgentId>
path:      .ballet/instructions/migrated-<legacyAgentId>.md
title:     <legacy Agent name>
body:      <decoded developer_instructions>
```

Tiedoston ehdotettu frontmatter:

```yaml
---
id: migrated-<legacyAgentId>
title: "<legacy Agent name>"
description: "<legacy Agent description, jos non-empty>"
createdAt: "<raw TOML createdAt, jos eksplisiittinen>"
updatedAt: "<raw TOML updatedAt, jos eksplisiittinen>"
---
```

`origin: project` johdetaan trusted `.ballet/instructions/`-juuresta eikä sitä tallenneta muokattavaan frontmatteriin. Optional-rivien poissaolo ei tuota tyhjää avainta.

Body muodostetaan TOML-parserin palauttamasta `developer_instructions`-merkkijonosta:

- UTF-8, ei BOMia;
- CRLF/CR muunnetaan LF:ksi;
- muuta trimmausta tai tekstin täydentämistä ei tehdä; ja
- System-baselinea tai workflow-skill-tekstiä ei lisätä automaattisesti.

Jos target-polku on jo olemassa ja sen raw-tavut ovat byte-identtiset generated target -tavujen kanssa, tiedostoa käytetään idempotentisti. Sama path/ID eri tavuilla tai sama target-ID toisessa Project-instruction-tiedostossa estää migrationin; automaattista suffixia, canonical rewritea tai overwritea ei tehdä.

Agentin muut kentät käsitellään paketin ehdotusoletuksella:

| Legacy-kenttä | Kohde |
|---|---|
| `name` | Instruction title |
| `description` | Instruction description -metadata |
| `developer_instructions` | Instruction body |
| `skills` / `skills.config` | Jokaisen viittaavan Stepin `skillIds` |
| runtime intent | Deduplikoitu ExecutionProfile |
| `enabled: true` | Ei kohdekenttää; migration-precondition |
| `enabled: false` | Blocking, jos Agent on viitattu |
| `avatar`, nickname candidates | Ei V1 execution -kohdetta; kirjataan migration-raportin removed metadata -osioon |
| raw TOML timestamps | Instruction provenance metadata, vain kun eksplisiittisesti olemassa ja valideja |

Nykyisen loaderin tiedostojärjestelmästä johtamaa fallback-`createdAt`/`updatedAt`-arvoa ei käytetä. Näin sama source-tavuvirta tuottaa saman targetin tiedoston mtime/birthtime-arvoista riippumatta.

Avatar- ja nickname-metadataa ei pudoteta hiljaisesti: apply sallitaan vasta, kun niiden poistaminen tai uusi koti on hyväksytty `OPEN-DECISIONS.md`:ssä.

## Vaihe 4: skillIds-listan muodostaminen

Jokaisen Agentin legacy-skill-valinnat normalisoidaan nykyisestä `skills`/`skills.config`-muodosta.

Kaksi sallittua raw-muotoa ovat toisensa poissulkevia:

```text
skills = ["alias", { id?, name?, enabled? }, ...]
```

tai TOML-table, jonka ainoa avain on `config` ja jonka jokainen item on strict `{ path: string, enabled?: boolean }`. Array-objectissa pitää olla vähintään non-empty `id` tai `name`; muuta kenttää ei sallita. Molemmissa muodoissa `enabled` puuttuu → `true`, ja `false` ohittaa itemin ennen alias-resolutionia.

Jokaisesta regular, non-symlink `.agents/skills/<relative-dir>/SKILL.md`-tiedostosta muodostetaan catalog entry. `<relative-dir>` on non-empty POSIX path, jonka jokainen segmentti on lowercase kebab-casea. Entry ratkaisee target-ID:n `project:<relative-dir>` ja seuraavat case-sensitive alias-avaimet multimapissa:

- `<relative-dir>`;
- `.agents/skills/<relative-dir>`;
- `.agents/skills/<relative-dir>/SKILL.md`;
- viimeinen path-segmentti;
- validoitu SKILL.md-frontmatterin `id`, jos olemassa; sekä
- SKILL.md-frontmatterin exact non-empty `name`, jos olemassa.

Legacy array-string tuottaa yhden trimatun alias-candidaten. Array-object tuottaa kaikkien olemassa olevien trimmattujen `id`- ja `name`-arvojensa setin. `skills.config.path` normalisoidaan tässä järjestyksessä: trimmaa; muuta jokainen käänteisviiva `/`:ksi; poista toistuvat alku-`./`-prefiksit; poista yksi case-insensitive trailing `/SKILL.md`; hylkää tyhjä arvo, alku-`/` tai `~`, drive/URI-prefixi, `//` sekä tyhjä/`.`/`..`-segmentti; liitä segmentit takaisin yhdellä `/`:lla. Candidate-set on tämä normalisoitu path sekä sen viimeinen segmentti.

Kaikkien itemin candidatejen multimap-osumien canonical realpathien unioni lasketaan ilman precedenceä. Unionin pitää sisältää täsmälleen yksi realpath: nolla on `missing_skill`, useampi `ambiguous_skill`. Näin normalized pathin, basenamen, ID:n tai namen osuminen eri tiedostoihin estää migrationin eikä valitse `first`/`last write wins` -voittajaa.

Resolved `SKILL.md`-bodyn pitää olla normalisoinnin jälkeen non-empty. Kaksi eri realpathia samalla target-ID:llä on `skill_id_collision`; saman resolved target-ID:n valitseminen kahdesti on `duplicate_skill`. Migration ei luo puuttuvaa skill-tiedostoa eikä hiljaisesti deduplikoi. Kohdelista järjestetään origin rankilla `builtin`, `project` ja sen jälkeen origin-scoped ID:n UTF-8 byte -järjestyksessä.

Nykyinen Agent-lähde voi käytännössä viitata vain Project-skilleihin. Built-in-rank sisältyy samaan target-algoritmiin tulevaa yhtenäisyyttä varten.

## Vaihe 5: Step-kohtainen mapping

Jokaiselle `type: agent`- ja `type: scheduled` -Stepille:

1. ratkaise legacy `agentId`;
2. aseta `executionProfileId` Agentin tuple-hashin perusteella;
3. aseta `primaryInstructionId` arvoon `project:migrated-<agentId>`;
4. kopioi Agentin canonical `skillIds` uutena Step-kohtaisena listana; ja
5. poista `agentId`.

Seuraavat arvot säilyvät semanttisesti ja järjestykseltään muuttumatta:

- Loop ID ja Loop-järjestys;
- Step ID ja nodejärjestys;
- Step type;
- `description` task descriptionina;
- schedule;
- `on.approved` ja `on.rejected`;
- `nodeStyle` ja `nodeSize`;
- Loop start; sekä
- terminal-nodet.

Sama legacy-Agent useassa Stepissä tuottaa aluksi samat profile-, primary- ja skill-viitteet jokaiseen Stepiin. Tämän jälkeen Stepit omistavat listansa ja voivat eriytyä toisistaan.

Human-Step ja terminal-node säilyvät ilman execution composition -kenttiä.

Top-level `agents` poistetaan ja korvataan `executionProfiles`-listalla. Project config version asetetaan `9`:ksi vasta target-skeeman onnistuneen validoinnin jälkeen.

## Scheduled Step -hash

Nykyinen schedule definition hash sisältää schedule- ja Agent-viitteen. V9:n ehdotettu canonical definition on:

```json
{
  "schedule": {},
  "executionProfileId": "…",
  "primaryInstructionId": "…",
  "skillIds": []
}
```

Ensin koko schedule validoidaan. Weekly-schedulen `weekdays` deduplikoidaan ja järjestetään aina `mon, tue, wed, thu, fri, sat, sun`; muiden schedule-arrayiden järjestystä ei muuteta. Definition on `canonicalJsonV1({ schedule: normalizedSchedule, executionProfileId, primaryInstructionId, skillIds })`, ja hash on näiden UTF-8-tavujen lowercase SHA-256. Objectin tekstuaalinen property insertion order ei siis vaikuta hashiin ja `skillIds` on jo canonical.

Koska definition muuttuu mutta itse schedule ei muutu, jokainen olemassa oleva affected state -rivi saa deterministisen patchin:

- `loopId`, `stepId`, `nextRunAt` ja `updatedAt` säilyvät byte-for-byte;
- `definitionHash` vaihtuu yllä laskettuun v9-hashiin; ja
- `lastScheduledAt`, `lastStatus`, `lastRunId` ja `lastError` asetetaan nulliksi.

Migration ei lue seinäkelloa, laske occurrencea uudelleen tai luo puuttuvaa state-riviä. Scheduler luo puuttuvan rivin tai käsittelee säilytetyn `nextRunAt`-cursorin vasta migration-fencen vapauttamisen jälkeen normaalilla v9-algoritmilla. Menneeksi muuttunut cursor voidaan merkitä `missed`-tilaan ja ohittaa, mutta migration ei dispatchaa missed occurrencea. Tämä oletus vaatii ihmisen hyväksynnän.

## Machine-local settings

`agentReadOnlyRoots` ei siirry execution profileen.

- Non-empty lista käytetyllä tai orphan-Agentilla estää migrationin, koska V1:ssä ei ole semanticsia sen turvalliselle uudelleenkohdistamiselle.
- Jokainen tyhjä lista, myös orphan-avaimella, poistetaan lajitellussa Agent ID -järjestyksessä ja nimetään `LocalSettingsPatchV1.removedAgentIds`-listassa.
- Provider command override ja muut Agentista riippumattomat local settings säilyvät.
- `workspace_access`-kenttää ei generoida.

Jos `agentReadOnlyRoots` jää tyhjäksi, koko property poistetaan; settings-tiedostoa itseään ei poisteta. After-arvo validoidaan strict `LocalSettings` v1 -skeemalla ja serialisoidaan `prettyJsonV1`-algoritmilla UTF-8:ksi ilman BOMia ja täsmälleen yhdellä loppu-LF:ään. Source-mode säilyy. Jos propertyä ei tarvitse muuttaa, patchia ei ole.

Nykyrepositoryn golden-cleanup poistaa `dev-deploy-agent: []` -avaimen, säilyttää settings-tiedoston moodin `0600` ja tuottaa tavut:

```json
{
  "version": 1
}
```

Code blockin jälkeen tiedostossa on yksi LF. Tämä erottaa nykyiset additional read roots -arvot myöhemmin arvioitavasta workspacen `read-only | write` -oikeudesta.
After-tavujen SHA-256 on `4b8894d57dfa621e534ef4eb25263e8f00254cbcb4327f1f98796314ac279dde`.

## Historiallinen Run-data

Migration ei muuta olemassa olevia:

- `loop_runs.snapshot_json`-arvoja;
- `execution_plan_json`-arvoja;
- immutable `execution_tasks.spec_json`-arvoja;
- outcomeja, eventtejä tai hasheja; eikä
- finalization-evidenssiä.

ExecutionSpec v1 ja uusi compositionia sisältävä versio luetaan versionoituna unionina. Historiallisessa UI:ssa legacy Agent -snapshot näytetään read-only-evidenssinä.

Non-terminal Run estää config-migrationin. Näin sama Root Run ei voi jatkua puoliksi v8- ja puoliksi v9-snapshotilla.

## Concurrency fence

Apply edellyttää checkout-kohtaista cross-process mutation fenceä, ei vain in-process mutexia. Fence on kernelin shared/exclusive advisory file lock regular non-symlink-filessä `.git/ballet/locks/config-mutation.lock` (parent `0700`, file `0600`); lock vapautuu file descriptorin sulkeutuessa tai prosessin kuollessa, joten PID-pohjaista stale-deleteä ei tehdä. Balletin config- ja document-writerit, Agent create/update/remove, local settings -writer, Root Run -aloitus, resume/finalization- ja muu Run-state-mutaatio sekä scheduler tick/definition-sync ottavat saman fencen shared-tilassa; migration ottaa sen exclusive-tilassa ennen apply-inventorya ja pitää sen journalin `committed`-vaiheeseen asti. Tämä osallistuminen on implementationin precondition: migration-komentoa ei julkaista ennen kuin kaikki nimetyt Ballet-writerit käyttävät fenceä.

Shared-lock ei yksin riitä crashin jälkeen. Jokainen osallistuja noudattaa ennen omaa operaatiotaan samaa protokollaa:

1. ota shared lock;
2. aja alla määritelty `scanMigrationJournalsV1` vasta lockin saamisen jälkeen;
3. jos scanissa ei ole unfinished- tai invalid-tilaa, jatka pitäen shared lock operaation loppuun;
4. jos scanissa on yksi unfinished-journal tai invalid/multiple-tila, vapauta shared lock tekemättä yhtään lukua tai mutaatiota authoring- tai Run-tilaan;
5. kilpaile samasta lockista exclusive-tilassa recovery-owneriksi; ja
6. exclusive lockin saanut prosessi ajaa scanin uudelleen ja tekee yhden unfinished-journalin recoveryn tai jättää invalid/multiple-tilan fail-closed-manuaalirecoveryyn, kun taas muut odottavat, ottavat sen jälkeen shared lockin uudelleen ja palaavat kohtaan 2.

Näin migration-prosessin kuolema ei päästä jo käynnissä ollutta shared-lock-waiteria hybriditilaan. Exclusive lock takaa tasan yhden recovery-ownerin. Invalidin tai ristiriitaisen journalin tapauksessa owner ei vapauta scheduleria tai Run/config-API:a käyttöön, vaan tila jää fail-closed-manuaalirecoveryyn. Sama protokolla suoritetaan Ballet-startupissa ennen schedulerin ja API-reittien aktivointia; startup ei ole recoveryn ainoa käynnistäjä.

`scanMigrationJournalsV1` validoi `.git/ballet/migrations/execution-composition/`-juuren path/symlink-säännöillä ja luettelee sen direct-childit UTF-8 byte -järjestyksessä. Jokaisen childin pitää olla non-symlink-directory, jonka nimi on täsmälleen sen immutable manifestin 64 lowercase hex `sourceHash`; muu child on invalid. Scan validoi jokaisesta directorysta `manifest.json`:n, sen `manifestSha256`:n ja journal-slotit kaksislottisäännöllä ja valitsee **vain kyseisen directoryn sisällä** suurimman validin sekvenssin. Sekvenssejä ei verrata directoryjen välillä. Yksi asennettu slot sallitaan vain, kun se on sequence 1:n forward/`prepared`-recordi, jonka `nextOperation` on null; sequence 2:sta alkaen molempien slotien pitää olla olemassa ja valideja. Nollan slotin directory sekä myöhemmän sekvenssin puuttuva counterpart ovat invalid.

Terminal recordit (`forward/committed` tai `rollback/rolled_back`, null next-operation) saavat jäädä retention-historiana. Scanin tulos on deterministinen:

- 0 unfinished ja kaikki directoryt validit → operaatiota saa jatkaa;
- täsmälleen 1 unfinished ja kaikki directoryt validit → tämä directory on recovery-kohde;
- yli 1 unfinished, invalid/missing manifest, invalid tai puuttuva asennettu journal-recordi tai ristiriitainen slot → `manual_recovery`, eikä yhtään automaattista directoryjen väliseen aikaan tai sekvenssiin perustuvaa voittajaa valita.

Migration-directory luodaan ja sen immutable manifesti sekä ensimmäinen `prepared`-recordi fsyncataan ennen ensimmäistä migration-directoryn ulkopuolista authoring-, settings- tai DB-mutaatiota. Crash tätä ennen voi tuottaa invalidin directoryn, mutta sekin jää yllä olevan säännön mukaan turvallisesti manuaalirecoveryyn eikä jää scanilta piiloon.

Exclusive fencen jälkeen migration:

1. pysäyttää schedulerin ja odottaa mahdollisen in-flight tickin päättymisen;
2. estää uuden Root Runin, resume-vastauksen, finalisoinnin ja config/local-settings-mutaation;
3. avaa ennen commit pointia SQLite `BEGIN IMMEDIATE` -transaction;
4. lukee non-terminal Run/task/finalization-tilan ja koko `loop_schedule_state`-rowsetin uudelleen;
5. vertaa file-sourceHashia ja rowsettiä dry-run/apply-manifestiin; sekä
6. päivittää jokaisen schedule-rivin compare-and-swapilla, jonka `WHERE` vastaa kaikkia before-kenttiä null-safe-semanticsilla.

Yhdenkin CAS:n nolla/monta osumaa rollbackaa DB-transaction ja käynnistää journal-recoveryn. Transaction pidetään config commit pointin ja schedule-patchien yli; Runia tai scheduleria ei vapauteta näkemään v9-configia ennen DB-commitia, reload-validointia, local cleanupia ja committed-journalia. Prosessin crashissa seuraava shared-lock-osallistuja tai Ballet-käynnistys havaitsee unfinished-journalin ennen authoring-, scheduler- tai Run-tilan käyttöä ja suorittaa exclusive fencen alla manifestoidun rollbackin tai finish-forwardin.

Fencen ulkopuolinen editori on ulkoinen writer: apply-ohje vaatii olemaan muokkaamatta lähteitä operaation aikana. Migration tarkistaa source- ja target-hashit juuri ennen ja jälkeen aktivoinnin ja säilyttää korvatut tavut journal-backupissa, mutta ei väitä advisory fencen pysäyttävän sitä ohittavaa prosessia.

## Path- ja durability-sopimus

Jokaiselle Agent TOML-, Project instruction-, `SKILL.md`-, project config-, local settings-, staging- ja target-polulle tehdään ennen lukua tai kirjoitusta:

- lexical containment sallittuun absolute rootiin;
- jokaisen olemassa olevan ancestor-komponentin `lstat`, joka hylkää symlinkit;
- final pathin `lstat`, joka vaatii regular non-symlink-filen tai eksplisiittisesti sallitun puuttuvan targetin;
- canonical realpath -containment lähimmälle olemassa olevalle ancestorille; sekä
- source-read `O_RDONLY | O_NOFOLLOW` -lipuilla ja target-create `O_CREAT | O_EXCL | O_NOFOLLOW` -lipuilla.

Jokaisen destinationin staging-file luodaan sen destination-parentin alle, joten rename on todistetusti same-filesystem. `.ballet/project.json`, jokainen instruction ja `.git/ballet/settings.json` saavat oman sibling-tempin; staging ei nojaa `/tmp`:hen. V1-migration ei luo target-destination-parentia: jokaisen pitää olla inventoryssa olemassa oleva non-symlink-directory trusted rootin alla. Puuttuva `.ballet/instructions/` tai muu target-parent on blocking `missing_target_parent`, joka korjataan erillisenä eksplisiittisenä authoring/filesystem-toimena ennen uutta dry-runia. Migrationin oma `.git/ballet/migrations/execution-composition/<source-hash>/` sekä sen `before/`- ja `after/`-hakemistot ovat ainoat tämän operaation luomat directoryt; ne kuuluvat local recovery stateen, eivät v8/v9 authoring-targetiin.

Write-ahead-journalin vakaat vaiheet ovat `prepared`, `instructions_activating`, `config_committing`, `config_committed`, `state_cleanup`, `committed`, `rollback_discarding`, `rolling_back` ja `rolled_back`. Jokainen record on tarkalleen tätä muotoa:

```ts
interface MigrationJournalRecordV1 {
  format: "ballet-execution-composition-journal-v1";
  sequence: number; // integer >= 1, edellinen + 1
  migrationId: string;
  direction: "forward" | "rollback";
  phase:
    | "prepared"
    | "instructions_activating"
    | "config_committing"
    | "config_committed"
    | "state_cleanup"
    | "committed"
    | "rollback_discarding"
    | "rolling_back"
    | "rolled_back";
  sourceHash: string;
  targetHash: string;
  manifestSha256: string;
  nextOperation: null | {
    kind: "create" | "replace" | "delete" | "stage-install" | "schedule-cas" | "db-commit";
    target: string;
    beforeSha256: string | null;
    afterSha256: string | null;
    ifActualBefore: "finish-forward" | "rollback";
    ifActualAfter: "finish-forward" | "rollback";
  };
  checksumSha256: string;
}
```

`checksumSha256` on lowercase SHA-256 `canonicalJsonV1`-tavuista recordille, josta vain `checksumSha256`-kenttä on jätetty pois. Asennettu record serialisoidaan `canonicalJsonV1`-tavuina ja yhdellä loppu-LF:llä. `sequence` kasvaa yhdellä myös vaihetta muuttamatta tehtävien next-operation-päivitysten välillä.

Validissa forward-recordissa phase on jokin väliltä `prepared`…`committed`; validissa rollback-recordissa se on `rollback_discarding`, `rolling_back` tai `rolled_back`. Muut direction/phase-yhdistelmät estävät recoveryn. Vain forward/`committed` ja rollback/`rolled_back`, joissa `nextOperation` on null, ovat terminaalisia; kaikki muut validit recordit ovat unfinished-journaleita.

Journal käyttää kahta asennettua slottia `journal.0.json` ja `journal.1.json`. Seuraava record kirjoitetaan sekvenssin pariteetin mukaiseen slotin sibling-tempiin moodilla `0600`, temp fsyncataan, korvataan atomisella same-filesystem-renamella ja migration-directory fsyncataan. Vanha toinen slot säilyy. Recovery jättää asentamattoman tempin huomiotta, validoi jokaisen asennetun slotin skeeman, checksummin ja `manifestSha256`:n ja valitsee suurimman sekvenssin. Invalid asennettu slot, kaksi eri recordia samalla suurimmalla sekvenssillä tai puuttuva validi record jo muuttuneen sourcen yhteydessä johtaa manuaalirecoveryyn; vanhempaa recordia ei arvata voittajaksi.

Ennen jokaista rename-, replace-, delete-, stage-install-, schedule-CAS- tai DB-commit-operaatiota journal tallentaa next-operationin, before/after-hashit sekä erilliset before/after-recovery-actionit yllä olevalla torn-write-safe-protokollalla. File-operaation `target` on repo-relative POSIX-path ja hashit ovat raw file -tavujen hasheja; puuttuva before/after on null. Stage-installin target on manifestin exact `stagingPath`, before on null ja after-hash on valitun immutable after-imagen tai backupin raw-tavujen hash. Schedule-CAS:n `target` on `canonicalJsonV1([loopId, stepId])` ja hashit ovat vastaavan canonical row-objectin hasheja. DB-commitin target on literal `loop_schedule_state` ja hashit ovat koko lajitellun before/after-rowset-arrayn `canonicalJsonV1`-hasheja. Jokainen staged/backup-file fsyncataan ennen renamea. Operaation jälkeen jokainen muuttunut parent-directory fsyncataan ennen journalin seuraavaa recordia. Agent TOML -poisto, settings-replace ja journalin oma finalisointi noudattavat samaa sääntöä.

Recovery ei päättele tilaa tiedostojen nimistä: se lukee viimeisen fsyncatun journal-operaation, vertaa actual before/after-hashia ja valitsee vain vastaavan `ifActualBefore`- tai `ifActualAfter`-toiminnon. Hash, joka ei vastaa kumpaakaan, pysäyttää automaation manuaaliseen recovery-raporttiin; ainoa poikkeus on jäljempänä määritelty manifest-owned partial `stagingWritePath`. Erityisesti project-configin commit-point-replacen durable recordissa `ifActualBefore = rollback` ja `ifActualAfter = finish-forward`; näin crash renamen kummallakin puolella tai parent-directory-fsyncin aikana ratkeaa actual tavujen perusteella yksiselitteisesti. Ennen commit pointia tehtävillä staging/activation-operaatioilla molemmat haarat ovat rollback, commit pointin jälkeen tehtävillä forward-cleanupeilla molemmat ovat finish-forward ja rollback-directionissa molemmat ovat rollback.

SQLite-commitin crash-ikkuna ratkaistaan aina exclusive fencen, scheduler-pausen ja uuden `BEGIN IMMEDIATE` -transactionin alla. Manifesti sisältää koko `loop_schedule_state`-rowsetin exact before- ja after-projektiot, myös muuttumattomat rivit ja puuttuvat affected-rivit. Recovery luokittelee actual rowsetin vain näin:

- **no-op:** manifestin before- ja after-projektiot ovat byte-identtiset ja actual vastaa tätä yhtä projektiota;
- **all-before:** actual rowset vastaa byte-for-byte manifestin before-projektiota;
- **all-after:** actual rowset vastaa byte-for-byte manifestin after-projektiota; tai
- **mixed:** kaikki muut tilat, myös osittainen CAS, ylimääräinen/puuttuva rivi tai kenttäarvo, joka ei vastaa projektiota.

Luokittelu testaa no-op-ehdon ensin. Jos before ja after ovat samat, arvoa ei saa kutsua yhtä aikaa all-beforeksi ja all-afteriksi: exact actual on aina no-op ja muu actual mixed. Kun projektiot eroavat, all-before ja all-after ovat toisensa poissulkevia.

Forward-recoveryssa config commit pointin jälkeen all-before tarkoittaa, ettei DB-commit säilynyt: recovery tekee kaikki before→after-CAS:t ja commitoi ne yhtenä transactionina. All-after hyväksytään jo commitatuksi ilman uutta patchia. Rollback-recoveryssa all-after tekee kaikki after→before-CAS:t ja commitin; all-before hyväksytään jo palautetuksi. No-op hyväksyy DB-osuuden valmiiksi sekä forward- että rollback-suunnassa tekemättä CAS:ia tai seinäkellolukua. Mixed rollbackaa recovery-transactionin ja vaatii manuaalirecoveryn. Config commit pointia ennen sallitaan vain all-before tai no-op ja file-rollback. Näitä sääntöjä ei ohiteta journal-vaiheen perusteella, joten crash juuri ennen tai jälkeen `COMMIT`:in tuottaa yksiselitteisen tuloksen. Shared-lock-osallistujia ei vapauteta ennen kuin file-recovery, rowset-luokittelu/päivitys, reload ja uusi durable journal-recordi ovat valmistuneet.

## Plan, backup ja journal

Apply luo local state rootiin migration-hakemiston, esimerkiksi:

```text
.git/ballet/migrations/execution-composition/<source-hash>/
```

Hakemisto on moodilla `0700`, backup-tiedostot `0600`. Manifesti sisältää:

- migration- ja target-schema-version;
- `sourceHash`- ja `targetHash`-arvot;
- jokaisen luetun lähteen pathin, moden, byte lengthin ja SHA-256:n;
- jokaisen luotavan, korvattavan ja poistettavan pathin;
- alkuperäisen `.ballet/project.json`-tiedoston tavut;
- kaikki käsitellyt `.codex/agents/*.toml`-tavut;
- target-collision-tiedostojen alkuperäiset tavut;
- local settings -tavut, jos cleanup koskee niitä;
- schedule state -backupin, jos reset hyväksytään.

Recovery-manifesti on immutable ja tarkalleen tätä muotoa:

```ts
interface RecoveryFileActionV1 {
  targetPath: string;
  action: "create" | "replace" | "delete";
  before: FileContentStateV1 | null;
  after: FileContentStateV1 | null;
  backupPath: string | null;
  afterImagePath: string | null;
  stagingPath: string;
  stagingWritePath: string;
}

interface RecoveryManifestV1 {
  format: "ballet-execution-composition-recovery-v1";
  migrationId: string;
  sourceManifest: SourceManifestV1;
  targetManifest: TargetManifestV1;
  fileActions: RecoveryFileActionV1[];
  scheduleBefore: ScheduleStateRowV1[];
  scheduleAfter: ScheduleStateRowV1[];
}
```

`migrationId` on literal `execution-composition-` + `sourceHash`. `fileActions` kattaa kaikki luotavat, korvattavat ja poistettavat filet, jokainen `targetPath` esiintyy enintään kerran, ja lista lajitellaan `targetPath`, sitten `action`, UTF-8 byte -järjestyksessä. `scheduleBefore` on source manifestin koko rowset ja `scheduleAfter` on sama koko rowset schedule-patchien jälkeen, molemmat aiemmin määritellyssä järjestyksessä.

File-actionin image/path-invarianssit ovat:

- non-null `before` ↔ non-null `backupPath`; backup on migration-hakemistoon suhteutettu `before/<SHA-256(UTF8(targetPath))>.bin`;
- non-null `after` ↔ non-null `afterImagePath`;
- after-image on migration-hakemistoon suhteutettu `after/<SHA-256(UTF8(targetPath))>.bin`;
- jokaisella actionilla on directionista riippumatta staging targetin destination-parentissa sijaitsevassa repo-relative sibling-pathissa `.ballet-migrate-<sourceHash>-<SHA-256(UTF8(targetPath))>.tmp`;
- staging-write on samassa parentissa sijaitseva exact `stagingPath + ".writing"`;
- create-actionilla before/backup ovat null, delete-actionilla after/after-image ovat null ja replace-actionilla before/backup/after/after-image ovat non-null.

Kaikkien actionien staging- ja staging-write-pathien pitää olla koko manifestissa keskenään uniikkeja ja eri kuin yksikään target-, backup- tai after-image-path. Full target-path-hashin collision eri `targetPath`-arvoilla on blocking hash collision.

Backup ja after-image tallentavat exact raw-tavut tiedostomoodilla `0600`; niiden manifestoidut `before.mode`/`after.mode` kertovat targetin palautettavan moodin. Kaikki backupit ja after-imaget kirjoitetaan, fsyncataan ja luetaan takaisin hash/size-validointiin **ennen** ensimmäistä `prepared`-recordia. Samassa exclusive fencessä juuri ennen sequence 1:n `prepared`-recordia jokaisen manifestoidun staging- ja staging-write-pathin pitää puuttua `lstat`-tarkistuksessa. Yksikin olemassa oleva path tai keskinäinen collision estää applyn koskematta siihen. Vasta durable `prepared`-recordi todistaa näiden exact pathien migration-omistajuuden; prefix-recoverya ei saa käyttää ilman tätä recordia.

Manifesti kirjoitetaan kerran `manifest.json`-tiedostoksi moodilla `0600`, tavuina `canonicalJsonV1(recoveryManifest)` + yksi LF. `manifestSha256` on canonical JSON -tavujen hash ilman EOF-LF:ää. Manifestia ei muuteta journal-vaiheen mukana; phase kuuluu vain journal-recordiin.

Finish-forward ei regeneroi after-sisältöä domain-objekteista. Jos actual target on before ja branch vaatii finish-forwardin, recovery validoi immutable after-imagen exact hashin/koon ja käyttää vain manifestin staging-polkuja. Rollback käyttää vastaavasti vain immutable backupia ja before-statea.

`installStagingV1(action, imageKind)` toimii exclusive fencen alla. `imageKind: "after"` on sallittu vain non-null after/after-imagelle ja valitsee niiden bytes/hash/size/mode-arvot. `imageKind: "before"` on sallittu vain non-null before/backupille ja valitsee niiden arvot. Algoritmi on kummallekin sama:

1. Jos `stagingPath` on olemassa, sen pitää olla regular non-symlink-file valitun staten exact hashilla, koolla ja modella **ja** `stagingWritePath`in pitää puuttua; tällöin se on valmis. Molempien samanaikainen olemassaolo on ristiriita.
2. Jos `stagingPath` puuttuu, tarkista exact `stagingWritePath`. Puuttuva scratch sallitaan. Olemassa oleva regular non-symlink-scratch sallitaan vain durable prepared/rolling-back-journalin todistamalla migration-omistajuudella, jos sen raw-tavut ovat valitun immutable imagen 0…N tavun täsmällinen prefiksi ja sen mode on `0600` tai exact selected mode; muu sisältö/mode on ristiriita ja vaatii manuaalirecoveryn.
3. Sallitun partial scratchin tapauksessa unlinkkaa vain exact manifest-owned `stagingWritePath` ja fsyncaa parent. Luo sama path uudelleen `O_CREAT | O_EXCL | O_NOFOLLOW` -lipuilla ja moodilla `0600`.
4. Kirjoita valitun imagen kaikki tavut, fsyncaa, lue takaisin hash/size-validointiin, aseta exact selected mode ja fsyncaa uudelleen.
5. Kirjoita durable stage-install-next-operation, renamea `stagingWritePath` atomisesti `stagingPath`iin, fsyncaa destination-parent ja validoi installed staging.

Crash scratch-writen, kumman tahansa fsyncin, chmodalun, renamen tai parent-fsyncin kohdalla jättää vain poissa olevan, validin prefiksin tai kokonaisen installed stagingin, joten sama algoritmi on idempotentti. Kun staging on valmis, target create/replace käyttää omaa durable next-operation-recordiaan, renameaa stagingin targetiksi, fsyncaa parentin ja validoi selected hashin/moden sekä molempien staging-polkujen poissaolon. Puuttuva/korruptoitunut selected image, eri sisältö installed `stagingPath`issa, stagingin ja scratchin samanaikainen olemassaolo, selected targetin rinnalle jäänyt staging-polku tai actual target, joka ei ole before/after, johtaa manuaalirecoveryyn.

Forward create/replace käyttää `imageKind: "after"`; forward delete ei tarvitse stagingia. Rollback palauttaa forward delete/replace -actionin `imageKind: "before"` -installerilla ja atomisella staging→target-renamella; forward create rollbackataan journalisoidulla delete-operaatiolla. Rollback ei koskaan kirjoita backup-tavuja suoraan targetiin. Näin sekä commit pointin jälkeinen local-settings-finish-forward että Agent TOMLien ja project/local-configin rollback ovat palautettavissa ilman filename-päättelyä tai torn writea.

### Forwardista rollbackiin vaihtaminen ennen commit pointia

Forward-recovery, joka valitsee config commit pointia ennen rollbackin, ei syötä olemassa olevaa after-stagingia before-installerille. Exclusive recovery-owner kirjoittaa ensin durable `direction: "rollback"`, `phase: "rollback_discarding"`, `nextOperation: null` -recordin. Sen jälkeen `discardForwardStagingV1` käy file-actionit manifestijärjestyksessä:

1. Molempien staging-polkujen puuttuminen on no-op.
2. Jos vain `stagingPath` on olemassa, actionilla pitää olla non-null after-state ja tiedoston pitää vastata exact after hash/size/modea. Recovery kirjoittaa durable delete-next-operationin actual staging-hashilla, unlinkkaa vain tämän manifest-owned pathin ja fsyncaa parentin.
3. Jos vain `stagingWritePath` on olemassa, actionilla pitää olla non-null after-image ja scratchin pitää olla sen validi 0…N-tavuprefiksi sallitulla scratch-modella. Recovery kirjoittaa durable delete-next-operationin scratchin exact actual raw hashilla, unlinkkaa vain tämän pathin ja fsyncaa parentin.
4. Molempien samanaikainen olemassaolo, staging delete-actionille, väärä hash/prefiksi/mode tai muu file type pysäyttää manuaalirecoveryyn koskematta ristiriitaan.

Delete-next-operationin molemmat action-haarat ovat rollback. Crash ennen/jälkeen journal-writea, unlinkia tai parent-fsynciä ratkeaa actual presence/hashilla, joten cleanup on idempotentti. `rollback_discarding`-recovery hyväksyy stagingissä/scratchissa vain actionin exact after-imagen tai sen sallitun prefiksin ja jatkaa samaa cleanupia; before-imageä ei vielä asenneta. Vasta kun kaikki käyttämättömät forward-stagingit ja scratchit puuttuvat, recovery kirjoittaa durable `phase: "rolling_back"`, `nextOperation: null` -recordin ja ajaa varsinaiset file-actionien before-palautukset. Jo targetiksi renameattu forward-create poistetaan rollbackissa ja jo targetiksi renameattu forward-replace palautetaan backupista; vielä käyttämätön staging ei siten sekoitu before-imageen.

Jokainen manifesti- ja datawrite fsyncataan ennen seuraavaa vaihetta. Backup validoidaan lukemalla hashit takaisin ennen stagingia.

## Atominen aktivointi

1. Ota exclusive mutation fence ja scheduler-pause; kirjoita/fsyncaa immutable manifesti, kaikki backupit ja after-imaget ja validoi ne takaisin. Tarkista kaikkien staging/staging-write-pathien keskinäinen uniikkius ja poissaolo uudelleen. Kirjoita vasta sitten durable `prepared`-journal.
2. Asenna kaikkien forward create/replace -actionien instruction-, canonical v9 project config- ja optional local-settings-sibling-tempit exact staging-polkuihin `installStagingV1(action, "after")` -protokollalla.
3. Validoi staging kokonaisuutena target-skeemalla ja laske `targetHash` uudelleen actual temp-tavuista/modeista sekä manifestoiduista DB/cleanup-patcheista.
4. Avaa SQLite `BEGIN IMMEDIATE`; lue file-source, koko schedule-rowset ja non-terminal tila uudelleen. Vertaa `sourceHash`/rowsettiä planin before-arvoihin ja keskeytä ilman target-aktivointia, jos jokin muuttui.
5. Kirjoita/fsyncaa `instructions_activating`; aktivoi tai reuseaa jokainen instruction manifestijärjestyksessä ja fsyncaa affected parent jokaisen renamen jälkeen.
6. Kirjoita/fsyncaa `config_committing`; korvaa `.ballet/project.json` authoring-mallin commit pointina, fsyncaa `.ballet/` ja kirjoita/fsyncaa `config_committed`.
7. Tee jokainen schedule before→after-CAS avoimessa DB-transactionissa. Korvaa local settings optional sibling-tempillä ja fsyncaa `.git/ballet/`.
8. Reload-aa v9 config sekä instruction-catalog ja varmista, että actual target-file-hashit vastaavat manifestia.
9. Kirjoita/fsyncaa `state_cleanup`; poista migrationin käsittelemät `.codex/agents/*.toml` yksitellen journal-säännöllä, fsyncaa parent ja validoi final v9 reload, kaikkien manifestoitujen staging/staging-write-polkujen poissaolo sekä koko post-state/`targetHash`.
10. Kirjoita durable `db-commit`-next-operation ja commitoi SQLite-transaction. Luokittele rowset välittömästi all-afteriksi tai byte-identtisessä before/after-tapauksessa no-opiksi, kirjoita durable `committed`, fsyncaa migration-directory, vapauta scheduler-pause ja exclusive fence.

Crash ennen config commit pointia palauttaa lähteet backupista. Crash commit pointin jälkeen jatkaa manifestin tarkkaa cleanupia; se ei tulkitse osittaista tilaa heuristisesti.

## Rollback

Rollback on sallittu vain, kun:

- current target-hash vastaa migration-manifestia;
- yhtään v9-mallilla käynnistettyä Root Runia ei ole; ja
- käyttäjä ei ole muuttanut migrationin luomia tiedostoja.

Uusi eksplisiittinen rollback-pyyntö terminalista `committed`-tilasta ottaa saman mutation fencen exclusive-tilassa, pausettaa schedulerin ja odottaa kaikkien shared-operaatioiden päättymisen. Sen jälkeen se avaa SQLite `BEGIN IMMEDIATE` -transactionin ja tarkistaa **lukon ja transactionin sisällä uudelleen** current target-hashin, v9 Root Run -ehdon, jokaisen manifestoidun target-tiedoston tavu/hash/mode-arvon, local settingsin, kaikkien staging/staging-write-pathien poissaolon sekä koko schedule-rowsetin. Rowsetin pitää olla all-after tai no-op. Mixed tai pre-existing staging-path estää automaation koskematta ristiriitatiedostoon. Vasta durable `rolling_back`-recordi uudistaa migrationin omistajuuden exact staging-polkuihin.

Keskeytyneen rollbackin recovery tunnistetaan uusimman validin journal-recordin `direction: "rollback"`- ja unfinished-vaiheesta. Se **ei** aja uuden rollbackin absence-precheckiä. `rollback_discarding` jatkaa yllä olevaa exact after-staging-cleanupia; `rolling_back` validoi olemassa olevan stagingin/scratchin uusimman next-operationin, valitun before-imagen ja `installStagingV1`-sääntöjen mukaan, koska manifest-owned before-staging tai validi partial scratch voi olla odotettu tila. Ristiriita failaa suljetusti. Rowset saa tässä jatkossa olla all-after, all-before tai no-op, mutta mixed estää.

Kun ehdot täsmäävät, rollback kirjoittaa uuden `direction: "rollback"`, `phase: "rolling_back"` -recordin ennen ensimmäistä mutaatiota. Se käy forward-file-actionit täsmälleen käänteisessä manifestijärjestyksessä: create palautetaan journalisoidulla target-deletellä, replace ja delete asentavat `installStagingV1(action, "before")` -protokollalla backup-imagen ja tekevät omalla durable next-operationilla atomisen staging→target-replacen/createn sekä parent-fsyncin. Jokaisen operaation jälkeen actual before-hash/mode ja staging-polkujen poissaolo validoidaan. Näin rollback palauttaa alkuperäiset tavut, modet ja local staten sekä poistaa vain manifestissa migrationin luomiksi merkityt tiedostot.

Schedule-state palautetaan yhden transactionin after→before-CAS:eilla; jokaisen CAS:n pitää osua täsmälleen yhteen manifestin riviin null-safe-semanticsilla. Ennen DB-commitia kirjoitetaan durable `db-commit`-recordi. Commitin jälkeen rowset luokitellaan all-beforeksi tai no-opiksi, v8 reload ja kaikkien staging-polkujen poissaolo validoidaan ja durable `rolled_back` kirjoitetaan ennen scheduler-pausen ja exclusive fencen vapauttamista.

Crash kesken rollbackin käyttää samaa exclusive-owner-, kaksislotti-journal- ja whole-rowset-protokollaa: all-after jatkaa after→before-transactionin, all-before jatkaa file-recoveryn loppuun, no-op ohittaa DB-patchin ja mixed pysähtyy. Uusi Root Run, scheduler tick tai writer ei siten pääse ehtotarkistuksen ja palautuksen väliin. Käyttäjän myöhempää muutosta ei ylikirjoiteta; ristiriita pysähtyy manuaaliseen recovery-raporttiin.

Backup-retention ja rollback-komennon elinkaari ovat avoimia päätöksiä.

## Idempotenssi

- Sama v8 source tuottaa byte-for-byte saman planin ja v9 targetin.
- Map insertion order, locale, koneen hostname, kellonaika ja Git-status eivät muuta ID:itä.
- Loop- ja nodejärjestys säilyy.
- Target-version uudelleenajo on validoiva no-op.
- Sama existing target-instruction reuseataan vain byte-identtisenä.
- Mixed v8/v9 on blocking error.
- Source-hash tarkistetaan uudelleen juuri ennen commit pointia.
- Journal recovery suoritetaan loppuun ennen uutta migration-yritystä.

## Nykyisen repositoryn odotettu dry-run

Nykytilan read-only-inventory antaa:

- 9 legacy-Agentia;
- 13 Agent- tai Scheduled-Stepiä;
- 5 uniikkia runtime-tuplea;
- 9 generoitavaa Project-primary instructionia;
- 0 valittua Project-skilliä; ja
- yksi orphan-empty local settings -avain `dev-deploy-agent`, jonka poistaminen tuottaa yllä määritellyn `0600`-tiedoston.

Lisäksi dry-run tuottaa yhden `unaddressable_instruction`-warningin nykyisestä `loop-engineer-minimal.md`-tiedostosta ja jättää sen tavut muuttumattomiksi.

Deduplikointiryhmät:

| Runtime tuple | Legacy-Agentit |
|---|---|
| codex / gpt-5.6-sol / medium / network off | architecture-agent, roadmap-agent, ui-design-agent |
| codex / gpt-5.6-terra / medium / network on | acceptance-test-agent, release-agent |
| codex / gpt-5.6-luna / medium / network off | implementation-plan-agent, test-plan-agent |
| codex / gpt-5.6-terra / medium / network off | implementation-agent |
| codex / gpt-5.6-luna / medium / network on | milestone-issues-agent |

Kaikki 13 Stepiä saavat profile-, primary instruction- ja tyhjän skill-listan. Nykyiset Loopit, task descriptionit, schedule, Transitionit ja appearance säilyvät.

Dry-runin pitää lisäksi raportoida Agentin avatar- ja muu ei-execution-metadata, local settings -cleanup sekä kaikki ihmisen hyväksyntää odottavat valinnat. Apply ei ole sallittu ennen niiden ratkaisua.

## Migrationin valmis lopputulos

Migration-implementaatio on hyväksyttävissä vasta, kun:

- jokainen executable Step viittaa validiin profileen ja täsmälleen yhteen primary instructioniin;
- jokainen `skillIds`-lista on validi, uniikki ja canonical;
- sama runtime-tuple esiintyy tasan yhtenä profilena;
- yhtään top-level Agent runtime -omistajuutta tai Step `agentId` -viitettä ei jää kohdemalliin;
- execution profileissa ei ole kuuden sallitun kentän lisäksi muuta dataa;
- invalid source jättää kaikki lähdetavut muuttumatta;
- toinen ajo on no-op;
- fault-injection todistaa crash recoveryn ja sallitun rollbackin;
- historiallinen Run-evidenssi säilyy tavutasolla muuttumattomana;
- uusi Run snapshottaa instructionit ja skillsit tarkkoine hash- ja versiotietoineen; ja
- nykyrepositoryn fixture tuottaa odotetut 5 profilea, 9 instructionia ja 13 Step-mappingia.
