# Execution composition — v9 UI contract

Tila: hyväksytty V1-suunnitelma ja production-käyttöliittymän dokumentaatio.

## Käyttäjän tavoite

Käyttäjä ymmärtää yhdestä Node editorista:

- mitä Step tekee;
- millä nimetyllä ExecutionProfilella se ajetaan;
- mikä yksi Project-primary instruction ohjaa työtä;
- mitkä optional Project-skillsit ovat mukana; ja
- mihin Approved- ja Rejected-tulokset johtavat.

Runtime-arvot muokataan ExecutionProfile-editorissa, eivät Node editorissa. Agent collectionia, Agent editoria, avatar-authoringia, Agent live-status-entityä tai standalone Agent Run -pintaa ei ole.

## Configure-navigation

Configure sisältää v9 execution -mallille:

- `Execution Profiles`;
- `Instructions`;
- `Skills`; ja
- nykyisen Loop/Node-editorin.

ExecutionProfile-authoring käyttää yhtä selkeää reittiä:

```text
/execution-profiles
```

Yleistä Settings-frameworkia ei rakenneta. Run käyttää Overview'ta ja Loop-kohteita; `/run/agents/...`-reittejä tai standalone Agent Run -toimintoa ei ole.

## Execution Profiles

Collection näyttää jokaisesta profilesta nimen, ID:n, providerin, modelin, reasoning effortin, network accessin ja validointitilan. ID disambiguoi samannimiset profilet.

Editorissa ovat vain:

1. Name;
2. Provider;
3. Model;
4. Reasoning effort; ja
5. Network access.

Editor käyttää explicit Savea ja näyttää dirty-, pending-, valid- ja error-tilat. `id` on lowercase kebab-case technical identity. Profiilissa ei näytetä instruction-, skill-, task-, Transition-, appearance-, workspace access- tai machine-local path -kontrolleja.

## Project Instructions

Instructions-collection löytää `.ballet/instructions/**/*.md`-tiedostot. Jokainen rivi tai kortti näyttää:

- `title`-arvon;
- `project:<id>`-viitteen, jos validi;
- repository-relative pathin; ja
- validointitilan.

Tiedosto ilman frontmatter-ID:tä näkyy tavallisena project-dokumenttina mutta ei primary instruction -valitsimessa. Invalidi tai duplicate eksplisiittinen ID näkyy blocking-virheenä. System instruction ei ole tässä collectionissa muokattavana eikä selectable Built-in-ryhmää tai Clone-to-project-toimintoa ole.

## Project Skills

Skills-collection löytää `.agents/skills/**/SKILL.md`-tiedostot. Jokainen item näyttää:

- titlen tai namen;
- path-derived `project:<relative-directory>`-ID:n;
- repository-relative pathin; ja
- validointitilan.

Invalidi path-segmentti näkyy blocking-virheenä. V1:ssä ei ole Built-in-skill-ryhmää, registryä, clone-to-projectia tai skill-hakemiston tukitiedostojen snapshot-UI:ta.

## Node editorin rakenne

Agent- ja Scheduled-Step näyttävät pääkentät täsmälleen tässä järjestyksessä:

1. Task description;
2. Execution profile;
3. Primary instruction;
4. Skills;
5. Approved target;
6. Rejected target;
7. Appearance, oletuksena suljettu; ja
8. Advanced, oletuksena suljettu.

Desktopissa task, molemmat required resource-valinnat ja molemmat Transitionit pysyvät ymmärrettävinä ilman pitkää provider-asetus- tai runtime-error-transition-listaa.

### Task description

- Non-empty textarea.
- Kuvaa tämän Stepin konkreettisen tehtävän.
- Virhe näkyy suoraan kontrollin alla.

### Execution profile

- Required single select.
- Option näyttää ensisijaisesti ihmisen antaman nimen ja tarvittaessa ID:n.
- Missing tai unavailable profile säilyy näkyvänä exact blocking reasonin kanssa.
- Provideria, modelia, reasoning effortia tai network accessia ei muokata tässä.
- Uudelle Stepille ei valita ensimmäistä profilea hiljaisesti.

### Primary instruction

- Required single select.
- Sisältää vain validit Project-resurssit.
- Option näyttää titlen, `project:<id>`-viitteen ja relative pathin.
- Fixed System baseline ei ole optiona, koska se on aina mukana.
- Uudelle Stepille ei valita instructionia hiljaisesti.

### Skills

- Optional keyboard-accessible multi-select.
- Sisältää vain validit Project-skillsit.
- Valitut arvot näkyvät removable chippeinä.
- Chipit ja preview järjestetään origin-scoped ID:n mukaan.
- Duplicatea ei voi muodostaa UI:ssa eikä hyväksyä API:ssa.
- Drag-reorderia ei ole, koska klikkausjärjestys ei vaikuta compositioniin.

### Transitions

`Approved target` ja `Rejected target` ovat samassa fieldsetissä. Kummallakin on yksi required select. Molemmat voivat valita:

- saman Loopin executable noden;
- saman Loopin terminaalin; tai
- toisen Loopin.

Sama valikoima koskee Agent-, Human- ja Scheduled-Stepiä. Runtime failure, technical blocked, cancelled ja needs-input eivät näy lisä-Transitioneina eivätkä muuta valittua targetia.

### Appearance

Oletuksena suljettu disclosure sisältää vain:

- Node style; ja
- Node size.

Appearance kuuluu Stepille. ExecutionProfile ei omista node artworkia.

### Advanced

Oletuksena suljettu disclosure sisältää:

- Node ID;
- Step type;
- Scheduled-Stepin schedule-kentät tarvittaessa; ja
- read-only execution profile-, primary instruction- ja skill-ID:t.

Additional instructions-, workspace access-, policy- tai future-placeholder-kontrolleja ei renderöidä.

## Eri node-tyypit

### Agent Step

Näyttää koko execution composition -editorin ja Step composition preview'n.

### Scheduled Step

Näyttää saman compositionin kuin Agent Step. Schedule on Advanced-osiossa; seuraava execution-aika ja schedule-status voidaan näyttää header-metadatana.

### Human Step

Näyttää vain:

- Task descriptionin;
- Approved targetin;
- Rejected targetin;
- Appearancen; ja
- Advanced-osion.

Execution profile-, primary instruction- ja skill-kontrollit eivät jää disabled-placeholder-arvoina DOM:iin.

### Terminal node

Näyttää nykyisen description- ja appearance-editorin. Execution compositionia, schedulea tai Transition-kontrolleja ei renderöidä. Editor voi näyttää read-only tekstin:

```text
Terminal nodes have no transitions.
```

## Step composition preview

Nykyinen Agent instruction preview korvataan Step composition preview'lla. Preview näyttää tässä järjestyksessä:

1. `System baseline · always applied · read-only`;
2. Project-primary instructionin titlen, originin, ID:n, pathin ja rendered bodyn;
3. valitut Project-skillsit canonical ID -järjestyksessä, jokaisesta origin, ID, path ja rendered body;
4. composition validityn; ja
5. composition-version sekä read-only resource-ID:t.

System instructionin body voidaan näyttää read-only disclosurella, mutta sitä ei voi muokata tai poistaa. Preview ei näytä providerin raw-tapahtumia, ambient-kontekstia tai hidden reasoningia. Invalidi draft näyttää exact affected-resurssin eikä substituoi fallbackia.

## Run snapshot -näkymä

Run-näkymä näyttää immutable Step compositionista vähintään:

- composition-version;
- Step ID:n;
- ExecutionProfile-snapshotin;
- resource origin/ID/path/source SHA-256 -tiedot;
- exact prompt SHA-256:n; ja
- output-schema-version ja SHA-256:n.

Exact prompt voidaan avata read-only-evidenssinä. UI kertoo, että evidence todistaa Balletin muodostaman promptin, ei providerin koko sisäistä tai ambient-kontekstia.

## Blocking-tilat

| Tila | UI-käyttäytyminen |
|---|---|
| No profiles | Blocking Alert; executable Stepiä ei muuteta Humaniksi |
| Missing profile | Exact ID ja korjausohje; Run estyy |
| Unavailable profile | Valinta säilyy, provider-specific blocking reason näkyy |
| No valid instructions | Primary-kentän blocking empty state |
| Missing/invalid instruction | Exact ID/path ja validation reason |
| No skills | Sallittu `No skills selected` -tila |
| Missing/invalid skill | Exact ID/path ja blocking reason |
| Resource too large | Exact resource ja 128 KiB raja |
| Prompt too large | 512 KiB blocking preflight |
| Legacy local setting | `agentReadOnlyRoots`-path ja exact remediation; arvoja ei poisteta |
| Save failure | Yksi form-wide destructive Alert sekä affected field errors |

Disabled Save ei korvaa näkyvää validation messagea.

## Saavutettavuus

- Jokaisella kontrollilla on ohjelmallinen label.
- Helper- ja error-tekstit yhdistetään `aria-describedby`-viitteillä.
- Invalidi kontrolli käyttää `aria-invalid="true"`.
- Transitionit käyttävät `fieldset`/`legend`-rakennetta.
- Multi-select, chip removal ja disclosuret toimivat näppäimistöllä.
- Chip-remove-painikkeilla on yksilöllinen accessible name.
- Origin, availability, Approved ja Rejected eivät välity vain värillä.
- Focus palautuu popoverin sulkeutuessa triggeriin.
- Mobiilissa input-fontti on vähintään 16 px ja kontrolli vähintään 40 px.

## Design-sopimus

UI käyttää `DESIGN.md`-frontmatterin väri-, typografia-, spacing-, control- ja radius-tokeneita. Muutos ei lisää uutta palettia, gradienttia, shape-kieltä tai typografiaa.

- Primary ilmaisee focus- ja selection-tilan.
- Secondary ilmaisee Approved- ja successful-tilan.
- Tertiary ilmaisee waiting- ja attention-tilan.
- Error ilmaisee blocking validationin sekä failed/blocked Run-tilan.
- Geist näyttää ID:t, pathit, hashit ja Transition-targetit.
- Inter näyttää labelit, selitteet ja instruction-sisällön.

## V1:n ulkopuolella

Tässä mallissa ei rakenneta:

- Agent collectionia tai editoria;
- avatar-authoringia;
- standalone Agent Runia;
- yleistä Settings-frameworkia;
- Built-in instruction- tai skill-katalogia;
- clone-to-project-toimintoa;
- template packia, registryä tai marketplacea;
- additional instructions -UI:ta;
- workspace access -UI:ta; tai
- workflow-kohtaista platform-UI:ta.
