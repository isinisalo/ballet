# Execution composition — prompt contract V1

Tila: hyväksytty V1-sopimus ja production-toteutuksen dokumentaatio.

## Tavoite

Ballet muodostaa jokaiselle Agent- ja Scheduled-Stepin execution-yritykselle yhden deterministisen Ballet-owned promptin. Sama Root Run snapshot, Step-konteksti ja composition-versio tuottavat täsmälleen samat UTF-8-tavut riippumatta UI:n valintajärjestyksestä, localesta tai tiedostojärjestelmän enumeration-järjestyksestä.

ExecutionProfile ei renderöidy prompttiin runtime-asetusten kuvauksena. Provider, model, reasoning effort ja network access enforcedaan provider-suorituksen konfiguraationa.

## Auktoriteetti

Promptin instruction-auktoriteetti on korkeimmasta matalimpaan:

1. Balletin pakollinen System instruction;
2. Stepin Project-primary instruction;
3. Stepille eksplisiittisesti valitut Project-skillsit; ja
4. Stepin task envelope.

Structured output schema on Balletin runtime-sopimus, jonka mukaan providerin outcome validoidaan. Alempi kerros ei voi laajentaa ylemmän kerroksen tool- tai permission-rajaa.

## Viisi sectionia

`compositionVersion: 1` renderöi promptin aina tässä järjestyksessä:

1. System instruction;
2. primary instruction;
3. skillsit ID:n mukaisessa järjestyksessä;
4. Step task envelope; ja
5. structured output schema.

Sectioneilla on selkeät versionoidut alku- ja loppuotsikot:

```text
<<< BALLET EXECUTION COMPOSITION V1 · SYSTEM · system:execution-contract-v1 >>>
<system body>
<<< END BALLET SYSTEM >>>

<<< BALLET EXECUTION COMPOSITION V1 · PRIMARY · project:<instruction-id> >>>
<primary instruction body>
<<< END BALLET PRIMARY >>>

<<< BALLET EXECUTION COMPOSITION V1 · SKILL · project:<skill-id> >>>
<SKILL.md body>
<<< END BALLET SKILL >>>

<<< BALLET EXECUTION COMPOSITION V1 · TASK-ENVELOPE · v1 >>>
<task envelope>
<<< END BALLET TASK-ENVELOPE >>>

<<< BALLET EXECUTION COMPOSITION V1 · OUTPUT-SCHEMA · v1 >>>
<structured output schema>
<<< END BALLET OUTPUT-SCHEMA >>>
```

Jokainen valittu skill saa oman `SKILL`-sectioninsa. Tyhjä skills-lista ei tuota placeholder-sectionia. Renderöijä käyttää yhtä määriteltyä LF-erotinta ja UTF-8:aa ilman BOMia. Se ei rakenna yleistä canonical JSON -frameworkia; task envelope ja output schema käyttävät omia suljettuja, versionoituja serialisointifunktioitaan.

## System instruction

Ballet lisää täsmälleen yhden read-only System-resurssin:

```text
system:execution-contract-v1
```

Se ei ole käyttäjän valittavissa, muokattavissa tai poistettavissa. System instruction sisältää vain:

- instruction-auktoriteetin;
- vaatimuksen noudattaa tool- ja permission-rajoja;
- salaisuuksien käsittelyrajan;
- structured outcome -sopimuksen;
- kiellon palauttaa raakaa hidden chain-of-thoughtia; sekä
- vaatimuksen raportoida ajetut tarkistukset ja artifact-viitteet.

Se ei sisällä roadmap-, milestone-, issue-, katselmointi-, acceptance-, staging-, release-, deploy- tai Ballet-repositoryn erityismenettelyä. Read-only kuvaa instructionin authoring-oikeutta, ei Run-workspacen kirjoitusoikeutta.

## Primary instruction

- Stepillä on täsmälleen yksi `project:<id>`-viite.
- Viite ratkaistaan `.ballet/instructions/**/*.md`-tiedoston eksplisiittisestä frontmatter-ID:stä.
- System instruction ei täytä primary instructionin paikkaa.
- Missing, invalidi tai duplicate ID estää koko Root Runin, jos se vaikuttaa reachable compositioniin.
- Selectable Built-in-primary instructionit ja additional instructions eivät kuulu V1:een.

Yhden primary instructionin execution-body saa olla enintään 128 KiB. Sisältöä ei typistetä.

## Skills

- `skillIds` on set-semanttinen lista.
- Duplicate ID on validointivirhe; sitä ei deduplikoida hiljaisesti.
- Vain Stepille eksplisiittisesti valitut Project-skillsit composedaan.
- ID johdetaan `.agents/skills/`-juureen suhteutetusta lowercase kebab-case -hakemistopolusta.
- Skillsit järjestetään origin-scoped ID:n nousevaan UTF-8 byte -järjestykseen.
- UI:n klikkausjärjestys ja tiedostojärjestelmän enumeration eivät vaikuta prompttiin.
- V1 käyttää vain valitun skillin `SKILL.md`-tiedostoa.

Yksi skill saa olla enintään 128 KiB. Skill ei saa V1-executionissa riippua snapshotoimattomasta scriptistä, assetista tai muusta tiedostosta. Selectable Built-in-skillsit ja ambient skill discovery eivät kuulu Balletin muodostamaan V1-prompttiin.

## Task envelope

Task envelope on versionoitu, Step-kohtainen section. Se sisältää vähintään:

```ts
interface TaskEnvelopeV1 {
  version: 1;
  loopId: string;
  stepId: string;
  task: string;
  runInput: string;
  recentSteps: unknown[];
  resume?: {
    question: string;
    context: string;
    response: string;
  };
}
```

`loopId`, `stepId` ja non-empty task description tulevat immutablelta Root Run snapshotilta. Run input, persisted recent history ja mahdollinen `needs_input`-resume-vastaus ratkaistaan yrityksen alussa tallennetusta Run-datasta. Envelope serialisoidaan sen oman version määrittelemässä kiinteässä kenttäjärjestyksessä; object insertion orderia tai yleistä custom canonical JSON -kirjastoa ei käytetä sopimuksena.

`approvedTarget` ja `rejectedTarget` eivät kuulu prompttiin providerin kontrolliohjeina. Provider palauttaa vain validoidun domain-resultin, ja runtime ratkaisee targetin immutablelta Step-snapshotilta.

## Output schema

Output schema on viides prompt-section ja provider-validoinnin runtime-sopimus. Evidenssin V1-version arvo on:

```text
1
```

Outcome-muodot:

- `completed` vaatii `result: approved | rejected`;
- `needs_input` vaatii kysymyksen ja kontekstin eikä saa sisältää resultia;
- `blocked` ja `failed` eivät saa sisältää resultia; ja
- runtime cancel ei tuota outcome-resultia.

Structured outcome raportoi yhteenvedon lisäksi ajetut tarkistukset ja artifact-viitteet System-sopimuksen mukaisesti. Providerille annettujen schema-tavujen versio ja SHA-256 tallennetaan evidenssiin.

## Exact prompt ja hashing

Kun kaikki viisi sectionia on renderöity, Ballet:

1. validoi koko promptin UTF-8-tavut;
2. tarkistaa 512 KiB kokonaisrajan;
3. laskee `promptSha256`-arvon täsmälleen provider-suoritukseen välitettävistä tavuista; ja
4. tallentaa exact promptin yhteen evidence-kenttään.

Prompttia ei serialisoida tai järjestetä uudelleen provider-adapterissa. Instruction-, skill- tai prompt-ylitys on näkyvä preflight-virhe; mitään sisältöä ei typistetä hiljaisesti.

## Resource evidence

Root Run snapshottaa jokaisesta käytetystä lähteestä:

- kindin;
- originin (`system` tai `project`);
- origin-scoped ID:n;
- Project-resurssin repository-relative POSIX-pathin; ja
- raw-lähdetiedoston SHA-256:n.

Lisäksi Step-evidenssi sisältää composition-version, Step ID:n, koko ExecutionProfile-snapshotin, exact promptin ja sen SHA-256:n sekä output-schema-version ja schema SHA-256:n. Resurssien execution-sisältö säilyy Root Run snapshotissa yhdessä paikassa; sitä ei monisteta uudelleen jokaiseen evidence-rakenteeseen.

SHA-256-arvot ovat lowercase hex -muodossa. Source-hash lasketaan raw-lähdetiedoston tavuista; prompt-hash täsmälleen executioniin välitetyistä UTF-8-tavuista.

## Evidenssin väitteen raja

Balletin evidence todistaa Balletin muodostaman exact promptin ja valitut runtime-asetukset. Se ei väitä todistavansa providerin koko sisäistä, ambient- tai palveluntarjoajan itsensä lisäämää kontekstia. Providerin julkaisema reasoning-yhteenveto voidaan näyttää; raakaa hidden chain-of-thoughtia ei tallenneta tai renderöidä.

## Root Run snapshot

Kaikki reachable compositionit ratkaistaan atomisesti ennen ensimmäistä queue-operaatiota. Sama snapshot toimii myöhemmissä Stepeissä, `needs_input`-resumessa, sykleissä ja cross-Loop-handoffissa. Repositoryn, checkoutin tai Run-worktreen myöhempi instruction-, skill-, config- tai theme-muutos vaikuttaa vasta seuraavaan Root Runiin.

## Persisted StepResult

Completed-outcomen Transition valitaan vasta seuraavasti:

1. validoi outcome;
2. persistoi `StepRun.status = completed`;
3. persistoi kanoninen `StepRun.result`;
4. lue Step Run takaisin storesta; ja
5. valitse Approved- tai Rejected-target vain takaisin luetusta resultista.

Provider outcome säilyy evidenssinä, ei toisena kontrollilähteenä. `needs_input`, technical `blocked`, `failed` ja `cancelled` eivät aktivoi Transitionia.

## Fail-closed

Root Run ei käynnisty, jos reachable compositionissa on esimerkiksi:

- puuttuva tai unavailable ExecutionProfile;
- missing, invalidi tai duplicate Project instruction ID;
- missing tai invalidi Project skill;
- duplicate skill ID;
- snapshot-resoluution aikana muuttuva lähde;
- lähde- tai prompt-hash mismatch;
- 128 KiB resource-rajan tai 512 KiB prompt-rajan ylitys; tai
- legacy `agentReadOnlyRoots` machine-local settingsissä.

Virhe kertoo exact resurssin tai settings-kentän ja korjausohjeen. Fallbackia, hiljaista dedupea, truncationia tai v8-yhteensopivuuspolkua ei ole.
