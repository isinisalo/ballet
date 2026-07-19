# Execution composition — ehdotettu prompt-sopimus

Tila: ihmisen tarkistettava ehdotus. Sopimus kuvaa Balletin hallitseman V1-compositionin; se ei muuta nykyistä provider-integraatiota.

## Tavoite

Samasta Run-snapshotista ja `compositionVersion`-arvosta pitää muodostua tavutasolla sama instruction bundle riippumatta UI:n klikkausjärjestyksestä, koneen localesta tai siitä, montako muuta Stepiä käyttää samaa execution profilea.

Composition erottaa:

- Balletin pakollisen execution contractin;
- Stepin yhden primary instructionin;
- Stepille valitut skillsit;
- Stepin dynaamisen task- ja Run-kontekstin; sekä
- provider-adapterin enforcement- ja output schema -sopimuksen.

## Auktoriteettijärjestys

Korkeimmasta matalimpaan:

1. Runtime enforcement ja validoitu output schema.
2. Ballet System execution contract.
3. Stepin primary instruction.
4. Stepin skillsit.
5. Step task envelope, Run input, recent history ja resume-vastaus.

Alempi kerros ei voi laajentaa ylemmän kerroksen oikeuksia eikä kumota sen pysäytysehtoa. Skillien keskinäinen lajittelujärjestys vakauttaa bundle-tavut, mutta ei muodosta `last one wins` -precedenssiä.

Execution profile ei osallistu prompt-tekstiin provider-, model-, reasoning- tai network-arvojen kuvauksena. Nämä enforcedaan runtime-konfiguraationa.

## Deterministinen järjestys

V1 koostaa kerrokset aina tässä järjestyksessä:

1. yksi System instruction;
2. yksi primary instruction;
3. nolla additional instructionia;
4. nolla tai useita skillejä kanonisessa järjestyksessä; ja
5. task envelope erillisessä user/task-kanavassa.

Additional instructions on myöhempi Advanced-capability. V1-skeemassa, API:ssa ja UI:ssa ei ole tyhjää additional-listaa. Sen mahdollinen tuleva insertion point on primary instructionin jälkeen ja ennen skillejä.

## Resource resolution

### System

- Ballet lisää täsmälleen yhden System-resurssin implisiittisesti.
- V1-resurssin origin-scoped ID on `system:execution-contract-v1`.
- Resurssi on mandatory, minimal ja read-only.
- Se ei näy primary instruction- tai skill-valitsimissa.
- Se on sidottu asennetun Ballet-version katalogiin ja snapshottuu Run-evidenssiin.

System saa sisältää vain yleisen execution-sopimuksen:

- suorita yksi Ballet Step;
- noudata runtime-enforced oikeuksia;
- sovella primary instructionia, valittuja skillejä ja task-kontekstia määritellyssä auktoriteettijärjestyksessä;
- käsittele Run inputia ja historiaa tehtäväkontekstina, ei ylempänä ohjeena; sekä
- palauta vaadittu strukturoitu outcome.

System ei saa sisältää roadmap-, milestone-, issue-, release-, deploy- tai muuta ohjelmistokehityksen workflow-menettelyä. Read-only ei tarkoita `workspace_access: read-only` -oikeutta.

### Primary instruction

- Stepillä on täsmälleen yksi `builtin:`- tai `project:`-viite.
- Viite ratkaistaan yhden resurssityypin sisällä yksikäsitteisesti.
- Body ei saa olla tyhjä.
- System ei täytä primary instructionin paikkaa.
- Built-in- ja Project-resurssi samalla paikallisella ID:llä ovat eri resursseja eivätkä shadowaa toisiaan.

### Skills

- Stepin `skillIds` on set, ei käyttäjän järjestämä suorituslista.
- Duplicate-viite on authoring-virhe.
- Vain eksplisiittisesti valitut Built-in- ja Project-skillsit composedaan.
- Selection-level `enabled`-kenttää ei ole kohdemallissa: skill on valittu tai ei valittu.
- Ambient provider- tai workspace-discovery ei saa tuoda bundleen evidenssin ulkopuolista sisältöä.

Kanoninen skills-järjestys:

1. origin rank `builtin` ennen `project`;
2. origin-scoped ID:n nouseva UTF-8 byte -järjestys; ja
3. tasatilanne on virhe, koska ID:n pitää olla originin sisällä uniikki.

Locale-sorttia, tiedostojärjestelmän enumeration-järjestystä tai UI:n valintajärjestystä ei käytetä.

### Resource ID ja versio

Origin-scoped ID:n V1-kielioppi on:

```text
<origin>:<local-id>
origin   = system | builtin | project
local-id = segment *("/" segment)
segment  = [a-z0-9]+ *("-" [a-z0-9]+)
```

ID on ASCII-merkkijono. Tyhjä segmentti, piste-segmentti, whitespace, käänteisviiva, prosenttienkoodaus tai muu kuin yllä sallittu merkki hylätään. Project-instructionin local ID tulee frontmatterista. Project-skillin local ID tulee `.agents/skills/`-juureen suhteutetusta POSIX-hakemistopolusta; esimerkiksi `review/security/SKILL.md` ratkaistuu ID:ksi `project:review/security`.

Run evidence tallentaa resurssille sekä version että tarkat tavut:

- Project: `sourceVersion = project/<projectSnapshotHash>`;
- System/Built-in: `sourceVersion = ballet/<balletVersion>/catalog/<catalogVersion>`; ja
- `sourceSha256` lasketaan alkuperäisen lähdetiedoston tavuista, `contentSha256` normalisoidun execution-bodyn UTF-8-tavuista.

`projectSnapshotHash` on Root Runin immutable configuration snapshot -manifestin hash. V1-manifesti sisältää kaikki regular, non-symlink-filet juurista `.ballet/` ja `.agents/skills/` entryinä `{ path, mode, size, sha256 }`; path on repository-relative POSIX, mode nelinumeroinen lowercase octal, size tavumäärä ja hash raw-tavujen lowercase SHA-256. Entryt lajitellaan pathin UTF-8-tavuilla, manifesti serialisoidaan `canonicalJsonV1`:llä ja sen UTF-8-tavut hashataan lowercase SHA-256:lla. Legacy `.codex/agents/` ei kuulu V1-snapshotjuuriin migrationin jälkeen.

## Canonical JSON V1

Task-envelope, migration-manifestit ja muut tässä paketissa `canonicalJsonV1`-nimellä kuvatut arvot serialisoidaan yhdellä suljetulla algoritmilla:

1. sallitut arvot ovat object, array, string, boolean, null ja turvallisen kokonaislukualueen `[-9007199254740991, 9007199254740991]` kokonaisluvut;
2. object-avaimet lajitellaan rekursiivisesti niiden validoitujen Unicode-merkkijonojen UTF-8-tavujen nousevaan leksikografiseen järjestykseen;
3. array-järjestys säilyy;
4. kokonaisluvut renderöidään base-10-muodossa ilman plusmerkkiä, etunollia tai arvoa `-0`;
5. stringissä U+0022 renderöidään tavuina `\"` ja U+005C tavuina `\\`; U+0008/U+0009/U+000A/U+000C/U+000D muotoihin `\b`/`\t`/`\n`/`\f`/`\r` ja muut U+0000–U+001F-merkit lowercase `\u00xx` -muotoon; kauttaviivaa tai muita Unicode-skalaarimerkkejä ei escapeta;
6. lone surrogate, liukuluku, `undefined`, `NaN` ja ääretön arvo hylätään; ja
7. tulos on compact UTF-8 ilman BOMia, merkityksetöntä whitespacea tai loppu-LF:ää.

Hash lasketaan näistä tulostavuista lowercase SHA-256:lla. Algoritmin nimi ja säännöt ovat version osa; niitä ei saa muuttaa saman version sisällä.

## Tekstin normalisointi

Jokaisen executioniin käytettävän bodyn normalisointi V1:ssä:

1. lähde validoidaan UTF-8:ksi;
2. mahdollinen UTF-8 BOM poistetaan;
3. CRLF ja CR muunnetaan LF:ksi;
4. muuta trimmausta, whitespace-normalisointia tai Unicode-normalisointia ei tehdä; ja
5. body ei saa olla tyhjä normalisoinnin jälkeen.

Raw source bytes ja normalisoitu execution body hashataan erikseen. Näin frontmatter- tai rivinvaihtomuutos voidaan erottaa executioniin vaikuttavasta body-muutoksesta.

## Canonical instruction bundle

`compositionVersion: 1` renderöi Balletin hallitseman developer/system-bundlen length-prefixed-rakenteena. Jokainen osa on täsmälleen:

```text
@@BALLET-COMPOSITION/1 <kind> <origin-scoped-id> <body-utf8-byte-length>\n
<normalized-body-bytes>\n
```

Renderöintisäännöt:

- osat ovat järjestyksessä `system`, `primary`, sitten nolla tai useita `skill`-osia canonical skills -järjestyksessä;
- header on ASCIIa, välimerkkinä yksi U+0020-välilyönti ja lopussa yksi LF;
- `<kind>` on kirjaimellisesti `system`, `primary` tai `skill`;
- `<origin-scoped-id>` validoidaan ennen renderöintiä whitespacea kieltävällä ID-kieliopilla, eikä sitä escapeta;
- `<body-utf8-byte-length>` on normalisoidun bodyn UTF-8-tavumäärä base-10-muodossa ilman etunollia;
- headeria seuraa täsmälleen ilmoitettu määrä body-tavuja ja niiden jälkeen yksi osan erotteleva LF;
- bodyn omat nolla, yksi tai useampi loppu-LF säilyvät ja kuuluvat ilmoitettuun pituuteen;
- puuttuvasta skills-listasta ei renderöidä placeholderia; ja
- bundle päättyy aina viimeisen osan erottelevaan LF:ään ja hashataan näistä täsmällisistä tavuista lowercase SHA-256:lla.

Pituus tekee bodyn sisältämät headerin kaltaiset rivit ja loppu-LF:t yksiselitteisiksi. Parseri ei etsi bodysta markeria, vaan lukee ilmoitetun tavumäärän.

Provider-adapteri välittää canonical bundlen korkeimpaan tuettuun Balletin hallitsemaan system/developer instruction -kanavaan. Adapteri ei saa järjestää osia uudelleen. Jos provider ei pysty säilyttämään sopimusta tai disabloimaan evidenssin ulkopuolista ambient compositionia, preflight estää executionin tai determinismilupaus on rajattava uudella päätöksellä.

## Task envelope

Task- ja Run-konteksti ei kuulu instruction bundleen. Se välitetään erillisenä versionoituna user/task-envelope-na:

```json
{
  "version": 1,
  "current": {
    "loop_id": "change-review",
    "step_id": "review-change",
    "description": "Tarkista ehdotettu muutos ja tuota perusteltu päätös."
  },
  "run_input": "...",
  "recent_steps": []
}
```

V1-objectissa ovat täsmälleen avaimet `version`, `current`, `run_input` ja `recent_steps`; unknown key hylätään. `current.loop_id`, `current.step_id` ja `current.description` tulevat immutablelta `StepControlSnapshot`-rakenteelta. Raw Run input valitaan nullish-precedencellä `currentStep.input`, sitten nykyisen Loop Runin `input`, sitten tyhjä string. Recent-historia muodostetaan saman Root Runin execution plan -järjestyksessä olevien Loop Runien `stepRuns`-arrayista; nykyinen `stepRunId` suljetaan pois.

Resume lisää `current.resume`-objektin, jossa ovat täsmälleen avaimet `question`, `context` ja `response`. Question/context tulevat persisted, validoidusta `needs_input`-outcomesta ja response nykyisen StepRunin persisted response inputista ilman tekstin normalisointia. Objekti on mukana vain resume-yrityksessä, jossa kaikki kolme arvoa ovat olemassa.

Envelope V1 säilyttää nykyisen kokorajan semantiikan version osana:

- `run_input = truncateMiddleV1(rawInput, 20000, "\n[... RUN_INPUT TRUNCATED ...]\n")`;
- `recent_steps` sisältää enintään kolme muuta terminaalista, completion-timestampin saanutta StepRunia;
- ehdokkaat lajitellaan validoidun `completedAt`-ajan epoch-millisekuntien mukaan laskevasti, tasatilanteessa Root execution planin nollapohjaisen Loop execution -indeksin ja sen `stepRuns`-arrayn nollapohjaisen indeksin mukaan laskevasti; lajittelun jälkeen tarkastellaan vain ensimmäistä kolmea;
- ehdokkaita lisätään, kunnes seuraavan lisäyksen jälkeinen `recent_steps`-arrayn `canonicalJsonV1` ylittäisi 8192 UTF-8-tavua; ylittävää ehdokasta ja sen jälkeisiä ei lisätä; ja
- kaikki alla kuvatut kentät ja kompaktiosäännöt kuuluvat task-envelope-versioon ja saavat muuttua vain uudessa versiossa.

`truncateMiddleV1(value, max, marker)` mittaa ECMAScript-stringin UTF-16 code uniteina. Jos `value.length <= max`, tulos on muuttumaton. Muuten `available = max - marker.length`, `headLength = ceil(available / 2)` ja `tailLength = floor(available / 2)`. Alku on `value.slice(0, headLength)` ja loppu `value.slice(value.length - tailLength)`. Jos alku päättyy high surrogateen, se poistetaan; jos loppu alkaa low surrogateella, se poistetaan. Tulos on `head + marker + tail`. Negatiivinen `available` ei esiinny V1:n vakioilla.

History-entry V1 sisältää täsmälleen:

```ts
interface HistoryEntryV1 {
  loop_id: string;
  step_id: string;
  type: "agent" | "human" | "scheduled";
  status: "completed" | "blocked" | "failed" | "cancelled";
  result?: "approved" | "rejected";
  human_response?: string;
  outcome?: CompactOutcomeV1;
  error?: string;
}
```

`result` otetaan vain tallennetusta canonical `StepRun.result`-kentästä. `human_response` on mukana vain Human-Stepillä, jolla on non-empty response input. `outcome` on mukana vain, jos validoitu persisted outcome on olemassa, ja `error` vain non-empty errorista.

`compactTextV1(value, max)` korvaa ECMAScript 2025:n regexin `/\s+/g` jokaisen matchin yhdellä U+0020-välilyönnillä, tekee ECMAScript `trim()`-operaation ja kutsuu `truncateMiddleV1`-funktiota markerilla ` [... TRUNCATED ...] `. `human_response`, outcome summary ja error käyttävät max-arvoa 180; check name 60 ja optional check details 100.

`CompactOutcomeV1`- ja check-rakenteet ovat:

```ts
interface CompactCheckV1 {
  name: string;
  status: "passed" | "failed" | "skipped";
  details?: string;
}

interface CompactOutcomeV1 {
  state: "completed" | "needs_input" | "blocked" | "failed";
  result?: "approved" | "rejected";
  summary: string;
  checks?: CompactCheckV1[];
  artifact_refs?: Record<string, string | string[]>;
}
```

`result` on mukana täsmälleen `state === "completed"` -tapauksessa; needs-inputin `question`/`context` eivät kuulu history-outcomeen. `summary = compactTextV1(outcome.summary, 180)` on aina mukana, myös tyhjänä stringinä. Checkit stable-sortataan statuksella `failed`, `skipped`, `passed`, saman statuksen alkuperäinen array-järjestys säilyy, ja ensimmäiset kolme mapataan. `name` on aina mukana, `details` vain kun raw details on non-empty string. `checks` on mukana vain, jos mapped array ei ole tyhjä.

Artifact-avaimet lajitellaan ensin UTF-8 byte -järjestykseen. Hyväksytään enintään neljä scalar-arvoa; arrayn vain string-tyyppiset itemit tarkastellaan lähdejärjestyksessä ja jokainen säilytetty item kuluttaa yhden paikan. Avaimen pitää täsmätä `[a-z0-9_]{1,32}`. String trimataan, sen pitää olla 1–160 UTF-16 code unitia eikä se saa sisältää CR-, LF- tai NUL-merkkiä. `git_sha|commit_sha` hyväksyy 7–64 hex-merkkiä. `branch` hyväksyy Git-refin `[A-Za-z0-9][A-Za-z0-9._/-]{0,99}`, joka ei sisällä `..`, `//` tai `@{` eikä pääty `/`, `.`, tai `.lock`. Path-avain on yksi arvoista `changed_files`, `artifact_path`, `file`, `files`, `file_path`, `path`, `paths`, `document`, `document_path`, `report`, `report_path`, `task`, `tasks`, `design`, `design_path`; arvon pitää täsmätä Unicode-regexiin `^[\p{L}\p{N}._@+/-]+$`, olla relative POSIX path ja olla alkamatta `/`- tai `~`-merkillä, drive-prefixillä tai URI-skeemalla. Tyhjä, `.`- tai `..`-segmentti sekä `.git`-juuri hylätään.

Jos raw artifact-arvo on string, hyväksytty trimmed arvo tallennetaan stringinä. Jos arvo on array, hyväksytyt itemit tallennetaan arrayna, vaikka niitä jäisi vain yksi; tyhjäksi suodattunut array ja muut value-tyypit jätetään pois. Käsittely pysähtyy, kun neljä arvoa on säilytetty. `artifact_refs` on mukana vain, jos lopullisessa mapissa on vähintään yksi key; muuten se jätetään pois. Canonical JSON lajittelee lopulliset map-avaimet uudelleen samalla UTF-8-säännöllä.

`approvedTarget` ja `rejectedTarget` eivät kuulu prompttiin kontrolliohjeina. Agentti tai ihminen palauttaa vain `approved | rejected`-resultin; runtime ratkaisee snapshotatusta Stepistä oikean kohteen.

Task envelope serialisoidaan `canonicalJsonV1`-algoritmilla. Hashataan ja evidenssiin tallennetaan täsmälleen providerille annetut UTF-8-tavut sekä envelope-versio; provider-adapteri ei saa serialisoida arvoa uudelleen.

## Output schema ja StepResult

Output schema on runtime-sopimus, ei skill tai primary instruction. Adapteri pyytää strukturoitua outcomea ja validoi sen ennen persistenceä.

V1:n `outputSchemaVersion` on `ballet-step-outcome/1` ja viittaa Balletin mukana toimitettuun immutableen JSON Schema -artifactiin. Artifactin schema-object serialisoidaan `canonicalJsonV1`:llä ilman loppu-LF:ää; `outputSchemaSha256` lasketaan näistä täsmällisistä UTF-8-lähdetavuista. Evidenssi tallentaa version, tavut, hashin ja `providerAdapterVersion`-arvon; providerille generoitu natiivi schema saa olla vain tämän versionoidun sopimuksen semanttisesti testattu projektio.

Strict V1-outcomen yhteiset kentät ovat `summary` (string, enintään 20 000 UTF-16 code unitia), optional `artifacts` (string-keyed JSON-value record) ja required `checks` (enintään 500 strict itemiä). Checkissä on trimmaamisen jälkeen 1–500 merkin `name`, `status: passed | failed | skipped` ja optional enintään 4000 merkin `details`.

- completed outcome vaatii `result: approved | rejected`;
- needs-input outcome vaatii question/contextin eikä saa resultia;
- blocked tai failed outcome ei saa resultia; ja
- runtime failure tai cancel ei luo outcome-resultia.

Validoitu result kirjoitetaan kanoniseen `StepRun.result`-kenttään. Outcome-payload säilyy evidenssinä, mutta Transition engine ei lue siitä toista kontrolliarvoa.

## Root Run snapshot

Hyväksytty snapshot-raja on Root Runin alku. Seuraava tarkka resoluutiojärjestys sekä hash- ja evidenssidetaljit ovat edelleen toteutusehdotus:

1. resolve kaikki reachable Stepit samasta project snapshotista;
2. validoi jokainen profile ja resurssiviite;
3. lue System-, primary- ja skill-lähteet;
4. muodosta per-resource raw- ja content-hashit;
5. järjestä skillsit kanonisesti;
6. renderöi per-Step bundle ja bundle-hash;
7. tallenna immutable execution plan; ja
8. queuea ensimmäinen tehtävä vasta koko suunnitelman onnistuttua.

Resume, retry ja cross-Loop-handoff käyttävät samaa snapshotia. Runin aikana repositoryssä muuttunut instruction tai skill vaikuttaa vasta seuraavaan Root Runiin.

Root Runin staattinen per-Step-snapshot sisältää Stepin `loopId`/`stepId`/type/description/targetit, koko execution profilen, project snapshot -hashin ja jokaisesta resurssista vähintään:

```text
kind
origin
id
sourcePath, jos Project
sourceVersion
sourceSha256
content
contentSha256
```

Staattinen snapshot sisältää lisäksi `compositionVersion`-arvon, canonical skill-ID -listan, bundlen ja sen hashin sekä koko Step-snapshotin hashin. `snapshotSha256` on lowercase SHA-256 `canonicalJsonV1`-tavuista, jotka muodostetaan kaikista `StepCompositionSnapshot`-kentistä paitsi itse `snapshotSha256`-kentästä; `skills` on canonical skills -järjestyksessä.

Task envelope ei ole tiedossa Root Runin alussa: Run input, recent history ja resume-vastaus muodostavat jokaiselle execution-yritykselle oman dynaamisen evidenssin. ExecutionAttemptEvidence tallentaa `loopId`/`stepId`/attempt-arvot, viittauksen staattisen composition-snapshotin hashiin, task envelope -version/tavut/hashin, output schema -version/tavut/hashin ja provider-adapterin version. Näin retry ja resume käyttävät samoja composition-tavuja, mutta niiden aidosti muuttuva task-konteksti on erikseen todennettavissa.

## Fail-closed-tilanteet

Root Run ei käynnisty, jos:

- profile-, primary- tai skill-viite puuttuu tai on epäyksikäsitteinen;
- origin tai resource kind on väärä;
- valittu lähde ei parseudu, pakenee sallittua juurta, on symlink-riskinen tai sisältää invalidia UTF-8:aa;
- normalisoitu body on tyhjä;
- duplicate skill löytyy;
- lähde muuttuu snapshot-resoluution aikana;
- raw-, content- tai bundle-hash ei täsmää;
- yksittäinen resurssi tai koko bundle ylittää hyväksytyn kokorajan;
- Built-in-versiota ei ole saatavilla; tai
- provider ei täytä vaadittua instruction-kanavan tai ambient-discoveryn sopimusta.

Instruction- ja skill-sisältöä ei typistetä. Semanttista skill-ristiriitaa ei ratkaista automaattisella `last one wins` -säännöllä; authoring voi varoittaa ja suoritus voi palauttaa blocked-outcomen.

## Avoimet toteutusparametrit

Root Runin atominen snapshotraja on hyväksytty arkkitehtuuripäätös. Tämä dokumentti käyttää edelleen paketin proposal-tason oletuksia skill-setin kanonisesta järjestyksestä, origin-scoped ID:stä, Project-resurssien versiosta, canonical JSON/bundle -tavuista ja vain valitun `SKILL.md`-tiedoston V1-snapshotista. Kokorajat, Built-in-version pinnaus ja providerien ambient-discovery-kyky ovat myös vielä päätettäviä. Avoimet toteutusparametrit on koottu `OPEN-DECISIONS.md`:ään.
