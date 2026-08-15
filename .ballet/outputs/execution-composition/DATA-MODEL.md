# Execution composition — strict v9 data model

Tila: hyväksytty V1-sopimus ja production-toteutuksen dokumentaatio.

## Omistajuus

Balletin execution-mallissa vastuut ovat yksiselitteiset:

1. `ExecutionProfile` kertoo, miten provider-suoritus ajetaan.
2. Agent- tai Scheduled-Step kertoo, mitä tehdään ja millä Project-resursseilla.
3. Root Run snapshottaa koko saavutettavan execution-suunnitelman ennen ensimmäistä tehtävää.
4. `StepRun.result` on ainoa Transition engineä ohjaava tulos.

Top-level Agentia, `agentId`-viitettä tai standalone Agent Runia ei ole. `agent` säilyy Step-tyypin nimenä. V1 ei lisää Role-, Preset-, Policy-, Recipe-, Template-, Template Pack- tai workspace-access-entityä.

## Project config v9

`.ballet/project.json` on strict schema, jonka ylätason kentät ovat täsmälleen:

```ts
interface ProjectConfigV9 {
  version: 9;
  executionProfiles: ExecutionProfile[];
  loops: Loop[];
}
```

V8-konfiguraatiota, top-level `agents`-mapia ja tuntemattomia kenttiä ei hyväksytä runtime-yhteensopivuuskerroksen kautta. `executionProfiles` tallennetaan ID:n mukaiseen deterministiseen järjestykseen. Loopien ja nodejen käyttäjän määrittämä järjestys säilyy.

## ExecutionProfile

```ts
interface ExecutionProfile {
  id: string;
  name: string;
  provider: "codex" | "copilot";
  model: string;
  reasoningEffort: string;
  networkAccess: boolean;
}
```

Säännöt:

- `id` on yksikäsitteinen lowercase kebab-case.
- `name` on non-empty käyttäjälle näkyvä nimi.
- Identity ja kaikki viitteet perustuvat ID:hen, eivät nimeen.
- Profiili sisältää täsmälleen yllä olevat kuusi kenttää.
- Profiili ei sisällä instructioneita, skills-valintoja, taskia, Transitioneita, appearancea, workspace accessia tai machine-local polkuja.

## Stepit ja terminaalit

Agent- ja Scheduled-Step omistavat execution compositionin:

```ts
interface ExecutableStepComposition {
  description: string;
  executionProfileId: string;
  primaryInstructionId: string;
  skillIds: string[];
  on: {
    approved: TransitionTarget;
    rejected: TransitionTarget;
  };
}
```

Niiden invarianssit:

- `description` on non-empty task description.
- `executionProfileId` ratkaisee täsmälleen yhteen profileen.
- `primaryInstructionId` ratkaisee täsmälleen yhteen Project-primary instructioniin.
- `skillIds` on set-semanttinen lista uniikkeja Project-skill-ID:itä ja tallennetaan ID:n mukaiseen järjestykseen.
- `approved` ja `rejected` ovat ainoat Transitionit.
- Nykyinen Step type-, schedule-, `nodeStyle`- ja `nodeSize`-data säilyy.
- Scheduled-Step käyttää samaa compositionia kuin Agent-Step ja omistaa lisäksi schedulensa.

Human-Step omistaa non-empty task descriptionin, `approved`- ja `rejected`-Transitionit sekä appearance-datan. Se ei sisällä execution profile-, primary instruction- tai skill-kenttiä.

Terminal-node omistaa vain nykyisen terminaali- ja appearance-datansa. Se ei sisällä execution compositionia, schedulea tai lähteviä Transitioneita.

## TransitionTarget

Molempien domain-tulosten target voi olla:

- saman Loopin executable node;
- saman Loopin terminal-node; tai
- toinen Loop.

Sama sääntö koskee Agent-, Human- ja Scheduled-Stepiä. Runtime state ei muodosta Transitionia. Käyttäjän syklisiä Looppeja ei estetä workflow-oletuksen perusteella; yleinen runtime safety limit rajaa virheellisen loputtoman ketjun.

## System instruction

V1:ssä on täsmälleen yksi pakollinen System instruction:

```text
system:execution-contract-v1
```

Se on Balletin omistama, read-only, aina mukana eikä käyttäjän valittavissa tai muokattavissa. Sen sisältö on rajattu:

- instruction-auktoriteettiin;
- tool- ja permission-rajojen noudattamiseen;
- salaisuuksien käsittelyrajaan;
- structured outcome -sopimukseen;
- kieltoon palauttaa raakaa hidden chain-of-thoughtia; sekä
- vaatimukseen raportoida ajetut tarkistukset ja artifact-viitteet.

System instruction ei sisällä roadmap-, milestone-, issue-, katselmointi-, acceptance-, staging-, release-, deploy- tai Ballet-repositoryn erityismenettelyä.

## Project primary instructions

Valittavat primary instructionit ovat tiedostoissa:

```text
.ballet/instructions/**/*.md
```

Valittavan tiedoston frontmatter sisältää vähintään:

```yaml
---
id: reviewer
title: Reviewer
---
```

Runtime-viite on `project:reviewer`. Identity tulee frontmatterin ID:stä, ei tiedostopolusta. Puuttuva ID jättää tiedoston tavalliseksi project-dokumentiksi, jota ei tarjota valitsimessa. Invalidi tai duplicate eksplisiittinen ID estää Runin. Stepillä on täsmälleen yksi Project-primary instruction; selectable Built-in-instructionit ja additional instructions eivät kuulu V1:een.

## Project skills

Valittavat skillsit ovat tiedostoissa:

```text
.agents/skills/**/SKILL.md
```

Runtime-ID johdetaan `.agents/skills/`-juureen suhteutetusta hakemistopolusta. Esimerkiksi:

```text
.agents/skills/review/security/SKILL.md -> project:review/security
```

Jokainen segmentti on lowercase kebab-case. Duplicate skill -viite ja invalidi path ovat virheitä. V1 snapshottaa vain valitun `SKILL.md`-tiedoston, eikä V1-skill saa executionissa riippua snapshotoimattomasta scriptistä, assetista tai muusta tiedostosta. Selectable Built-in-skillsit, registry ja clone-to-project eivät kuulu V1:een.

## Machine-local settings

V9:n execution-mallin ainoa checkout-kohtainen lukujuurikenttä on:

```ts
interface LocalSettingsV9 {
  readOnlyRoots: string[];
}
```

Provider-komentojen olemassa olevat konekohtaiset asetukset säilyvät oman local settings -sopimuksensa osana. `agentReadOnlyRoots` ei kuulu v9 execution-malliin. Jos legacy-kenttä havaitaan `.git/ballet/settings.json`-tiedostossa, Run estyy ja käyttöliittymä näyttää tarkan remediation-ohjeen. Ballet ei hävitä, yhdistä tai siirrä arvoja hiljaisesti.

## Root Run snapshot

Root Run ratkaisee samasta käynnistyslähtötilasta atomisesti kaikki käynnistyskohdasta saavutettavat:

- Loopit, Stepit ja Transitionit;
- ExecutionProfilet;
- System instructionin;
- Project-primary instructionit;
- valitut Project-skillsit; sekä
- teeman.

Resoluutio on all-or-nothing ennen ensimmäisen execution taskin queueamista. Puuttuva, invalidi, duplicate tai liian suuri reachable-resurssi estää koko Runin. Sama immutable snapshot palvelee myöhempiä Steppejä, `needs_input`-resumea, syklejä ja cross-Loop-handoffeja. Checkoutin tai Run-worktreen myöhempi muutos vaikuttaa vasta seuraavaan Root Runiin.

Resurssin sisältö tallennetaan snapshotissa yhteen kanoniseen paikkaan executionia varten. Evidenssirakenteisiin ei kopioida samaa täyttä sisältöä uudelleen.

## Composition- ja attempt-evidence

Run-evidenssi sisältää vähintään:

```ts
interface ResourceEvidence {
  kind: "system" | "primary" | "skill";
  origin: "system" | "project";
  id: string;
  relativePath?: string;
  sourceSha256: string;
}

interface StepCompositionEvidence {
  compositionVersion: 1;
  stepId: string;
  executionProfile: ExecutionProfile;
  resources: ResourceEvidence[];
  prompt: string;
  promptSha256: string;
  outputSchemaVersion: 1;
  outputSchemaSha256: string;
}
```

`sourceSha256` lasketaan täsmälleen käytetyn lähdetiedoston raw-tavuista. `promptSha256` lasketaan täsmälleen provider-suoritukseen välitetyn Ballet-owned promptin UTF-8-tavuista. Project-resurssilla tallennetaan repository-relative POSIX-path. Output schemasta tallennetaan executioniin käytetty versio ja tarkkojen schema-tavujen SHA-256.

Balletin evidenssi todistaa Balletin muodostaman promptin. Se ei väitä todistavansa providerin koko sisäistä tai ambient-kontekstia.

## Kokorajat

- yksi Project-primary instruction: enintään 128 KiB;
- yksi Project-skill: enintään 128 KiB; ja
- koko Balletin muodostama prompt: enintään 512 KiB.

Ylitys estää Runin näkyvällä preflight-virheellä. Instruction- tai skill-sisältöä ei typistetä hiljaisesti.

## StepResult ja runtime state

```ts
type StepResult = "approved" | "rejected";
```

| Tapahtuma | Step status | StepResult | Transition |
|---|---|---|---|
| Validoitu completed outcome | `completed` | `approved` tai `rejected` | vastaava target |
| Human-vastaus | `completed` | `approved` tai `rejected` | vastaava target |
| Needs input | `needs_input` | ei arvoa | ei Transitionia; sama Step pausettuu |
| Technical blocked | `blocked` | ei arvoa | ei Transitionia |
| Runtime/provider failure | `failed` | ei arvoa | ei Transitionia |
| Cancel | `cancelled` | ei arvoa | ei StepResultia tai Transitionia |

Providerin completed-outcome käsitellään tässä järjestyksessä:

1. validoi outcome;
2. tallenna Step Runin status `completed`;
3. tallenna kanoninen `StepRun.result`;
4. lue tallennettu Step Run takaisin storesta; ja
5. valitse Transition vain takaisin luetun `StepRun.result`-kentän perusteella.

Outcome-payload säilyy evidenssinä, ei kontrollilähteenä. Invalidi persisted status/result-yhdistelmä on integrity error.

## Pre-release conversion

Repositoryn v8-aineisto muunnetaan suoraan tracked v9 -tiedostoiksi. Runtime ei sisällä v8-readeria, dual-writea, startup-migrationia, migration CLI:tä, journalia, backup/rollback-kehystä tai historiallisten pre-release Runien compatibility-projektiota. Konversion tarkka tulos on dokumentoitu `MIGRATION-PLAN.md`:ssä.
