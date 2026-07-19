# Execution composition — Node editor -suunnitelma

Tila: ihmisen tarkistettava UI-ehdotus. Production-koodia tai `DESIGN.md`:ää ei ole muutettu.

## Käyttäjän tavoite

Käyttäjä ymmärtää yhdestä näkymästä:

- mitä valittu Step tekee;
- millä nimetyllä execution profilella se ajetaan;
- mikä yksi primary instruction ohjaa työtä;
- mitkä optional skillsit ovat mukana; ja
- mihin `Approved`- ja `Rejected`-tulokset johtavat.

Node editor ei edellytä sanojen runtime, provider, model, reasoning effort, policy, sandbox tai CLI tuntemusta. Näitä arvoja ei muokata eikä näytetä editorin pääosassa.

## Säilytettävä workspace-rakenne

Nykyinen valitun Loopin visual boundary säilyy:

- desktopissa Canvas ja sheet ovat 50/50-jaossa;
- sheetissä vasen preview ja oikea Node editor käyttävät nykyistä noin 3:2-jakoa;
- kapeassa containerissa preview ja editor pinoutuvat;
- mobiilissa sheet käyttää koko ruutua ja 40 px kontrolleja; sekä
- Loop tallennetaan yhdellä eksplisiittisellä `Save loop` -toiminnolla, ei kenttäkohtaisella autosavella.

Nykyinen Agent instruction preview korvataan Step composition preview'lla. Canvasin renderer-, graph geometry-, route-, node artwork- ja edge-rakennetta ei muuteta tämän ominaisuuden sivuvaikutuksena.

## Yksinkertainen Node editor

```text
┌─────────────────────── Loop canvas ───────────────────────┐
│                                                           │
│                 [ selected Step node ]                    │
│                                                           │
└───────────────────────────────────────────────────────────┘
┌────────────── Step instructions ──────────────┬────────── Node editor ──────────┐
│ System baseline · always applied · read-only │ data-model · Agent Step         │
│                                              │                                  │
│ Primary instruction                         │ Task description                 │
│ Architecture                                │ [ Derive the project data...   ] │
│ project:architecture                        │                                  │
│ [rendered Markdown preview]                  │ Execution profile                │
│                                              │ [ Focused local             ▾ ] │
│ Skills · 2                                  │ How this Step runs.              │
│ project:ballet-blueprint                     │                                  │
│ builtin:structured-review                    │ Primary instruction              │
│ [rendered summaries in canonical order]      │ [ Architecture             ▾ ] │
│                                              │ Exactly one instruction.         │
│                                              │                                  │
│                                              │ Skills                           │
│                                              │ [Blueprint ×] [Review ×] [ + ] │
│                                              │ Optional capabilities.           │
│                                              │                                  │
│                                              │ Transitions                      │
│                                              │ Approved target [ ui-design  ▾ ] │
│                                              │ Rejected target [ blocked    ▾ ] │
│                                              │                                  │
│                                              │ ▸ Appearance                     │
│                                              │ ▸ Advanced                       │
│                                              │                                  │
│                                              │ Remove from loop                 │
└──────────────────────────────────────────────┴──────────────────────────────────┘
```

Molemmat disclosuret ovat oletuksena suljettuja. Ne eivät ole tyhjiä tulevaisuusplaceholder-kontrolleja:

- `Appearance` sisältää nykyiset `Node style`- ja `Node size` -kentät.
- `Advanced` sisältää nykyisen Node ID:n, Step typen, Scheduled-Stepin schedule-kentät tarvittaessa sekä read-only composition-ID:t ja kanonisen järjestyksen.

Additional instructions- tai `workspace_access`-kontrollia ei renderöidä V1:ssä.

## Pääkentät ja copy

| Järjestys | Label | Kontrolli | Käyttäjälle näkyvä selite | Validointi |
|---:|---|---|---|---|
| 1 | `Task description` | Textarea | Mitä tämä Step tuottaa tai ratkaisee | Ehdotuksessa non-empty; enintään nykyinen sallittu pituus |
| 2 | `Execution profile` | Required single select | `How this Step runs.` | Yksi olemassa oleva, runnable profile |
| 3 | `Primary instruction` | Required single select | `Exactly one instruction defines the Step's role and working method.` | Yksi Built-in tai Project |
| 4 | `Skills` | Optional multi-select | `Optional capabilities used by this Step.` | Nolla tai useita uniikkeja Built-in/Project-valintoja |
| 5 | `Approved target` | Required single select | Tulos on hyväksytty | Yksi sallittu target |
| 6 | `Rejected target` | Required single select | Tulos tarvitsee muun polun | Yksi sallittu target |

Editorin otsikko näyttää Node ID:n ja käyttäjäystävällisen Step kindin. ID ja type muokataan Advanced-osiossa, jotta compositionin pääpolku pysyy tiiviinä.

## Execution profile single select

- Trigger näyttää ihmisen nimeämän profilen `name`-arvon.
- ID voidaan näyttää toissijaisena Geist-rivinä tai vain silloin, kun nimet ovat samat.
- Provideria, modelia, reasoning effortia tai network accessia ei luetella Node editorissa.
- Option näkyvä availability-tila on `Available` tai tarkka blocking reason; runtime-termejä ei tarvita onnistuneen valinnan ymmärtämiseen.
- Puuttuva valinta näyttää inline-virheen `Select an execution profile.`
- Uusi Step alkaa tyhjällä required-valinnalla. Ensimmäistä profilea ei valita hiljaisesti.
- Node editor ei luo tai muokkaa profilea eikä sisällä linkkiä uuteen settings-sivuun. Profilejen authoring-surface on avoin päätös.

## Primary instruction single select

- System-baseline ei ole optiona, koska se on aina mukana.
- Vaihtoehdot ryhmitellään näkyvillä tekstiryhmillä `Built-in` ja `Project`.
- Option näyttää titlen ja toissijaisena origin-scoped ID:n.
- Origin ei välity vain värillä.
- Tyhjä tila näyttää `No instructions available` ja suoran syyn, miksi Loopia ei voi tallentaa runnable-muotoon.
- Puuttuva valinta näyttää inline-virheen `Select one primary instruction.`
- Built-in-resurssin `Clone` kuuluu Instruction-kokoelman authoring-näkymään, ei selectiin.

## Skills multi-select

V1 tarvitsee yhden saavutettavan multi-select-käytännön. Repossa ei ole valmista multi-select- tai Checkbox-primitiiviä, joten toteutuksessa käytetään nykyisten shadcn/Base UI -käytäntöjen mukaista yleistä `components/ui`-primitiveä ja domain-kohtaista `StepSkillsField`-koostetta.

Käyttäytyminen:

- suljettu trigger näyttää valintojen määrän tai `No skills selected`;
- popover ryhmittelee optionit `Built-in`- ja `Project`-otsikoiden alle;
- jokainen option ilmoittaa valintatilan tekstinä ja accessibility-statena;
- valitut skillsit näkyvät removable chippeinä;
- remove-painikkeen nimi on esimerkiksi `Remove Blueprint skill`;
- chipit näytetään aina canonical origin/ID -järjestyksessä;
- drag-reorderia ei ole, koska valintajärjestys ei vaikuta compositioniin; ja
- duplicate-valintaa ei voi muodostaa UI:ssa eikä hyväksyä API:ssa.

Semanttisesti mahdollisesti ristiriitaiset skillsit voivat näyttää non-blocking-varoituksen. UI ei väitä pystyvänsä automaattisesti todistamaan skillien yhteensopivuutta.

## Transitions

`Approved target` ja `Rejected target` ovat samassa `Transitions`-fieldsetissä nykyisen käytännön mukaisesti.

- Kummallakin tuloksella on täsmälleen yksi select.
- Optionit ryhmitellään `Node`, `Loop` ja `End Loop` -ryhmiin nykyisen target-mallin mukaan.
- `Approved` käyttää Secondary/Emerald-signaalia vain semanttiseen hyväksyntään.
- `Rejected` käyttää muted-signaalia; sitä ei esitetä runtime errorina.
- Runtime failure, blocked, cancelled ja needs-input eivät muuta valittua targetia tai aktivoi tulosedgeä.
- Field label ja Canvas edge käyttävät samoja termejä `Approved` ja `Rejected`.

## Step composition preview

Vasen preview vastaa kysymykseen “mitä executioniin todella composedaan” ilman, että käyttäjä avaa tiedostoja erikseen.

Järjestys:

1. staattinen `System baseline · always applied · read-only` -rivi;
2. primary instructionin title, origin, ID ja rendered Markdown;
3. valitut skillsit canonical järjestyksessä, jokaisesta title, origin, ID ja tiivis rendered content; sekä
4. read-only composition version ja bundle-status teknisessä footerissa.

Systemin koko body voidaan avata read-only disclosureen, mutta sitä ei voi muokata tai poistaa. Task description ei toistu preview'n instruction-sisältönä; se näkyy editorissa ja Run task envelope -preview'ssa erillisenä datana.

Preview päivittyy draftista ennen tallennusta. Invalidi valinta näyttää affected-kohdassa syyn eikä fallback-sisältöä.

## Advanced ja Appearance

### Appearance, default closed

- `Node style`
- `Node size`

Nykyiset catalogit, tokenit ja Canvas-renderöinti säilyvät. Execution profile ei omista appearancea.

### Advanced, default closed

- `Node ID`
- `Step type`
- Scheduled-Stepille nykyiset schedule-kentät
- read-only `Execution profile ID`
- read-only primary- ja skill-ID:t
- read-only `Composition order: System → Primary → Skills → Task`

Kun type vaihtuu Human-Stepiksi, execution profile-, primary instruction- ja skill-kentät poistuvat DOM:sta eivätkä jää disabled-placeholder-kontrolleiksi. Takaisin agentti- tai Scheduled-Stepiksi vaihto vaatii uudet eksplisiittiset required-valinnat, ellei editorin saman draft-session aiempien arvojen säilytys hyväksytä erikseen.

## Eri node-tyypit

### Agent Step

Näyttää koko pääeditorin ja Step composition preview'n.

### Scheduled Step

Näyttää saman execution compositionin kuin Agent Step. Schedule on Advanced-osiossa, mutta seuraava suoritus ja schedule-status voidaan näyttää otsikon metadata-rivillä.

### Human Step

Näyttää Task descriptionin ja molemmat Transitionit. Preview kertoo `Human operator` eikä näytä tyhjiä profile-, instruction- tai skill-kontrolleja.

### Terminal node

Säilyttää nykyisen suppean editorin: lukittu ID/type, description ja Appearance. Execution compositionia, schedulea tai Transition-kontrolleja ei renderöidä.

## Tilat ja virheet

| Tila | UI-käyttäytyminen |
|---|---|
| Loading catalogs | Kenttien layout säilyy; selkeä loading-state, ei tyhjää option-listaa |
| No profiles | Blocking Alert ja `No execution profiles available`; ei hiljaista Human-muunnosta |
| No instructions | Blocking inline-state primary-kentässä |
| No skills | Sallittu tyhjä tila `No skills selected` |
| Missing saved ref | Kenttä näyttää puuttuvan ID:n ja blocking-virheen; mitään muuta resurssia ei substituoida |
| Unavailable profile | Valinta säilyy näkyvänä, blocking reason näytetään; Run ei käynnisty |
| Dirty draft | Nykyinen explicit Save loop, dirty-indikaatio ja navigointivaroitus |
| Save pending | Estä duplicate submit; säilytä arvot |
| Save failure | Yksi form-wide destructive Alert ja kenttäkohtaiset virheet |
| Locked Run snapshot | Kaikki arvot read-only; näytä snapshot-ID:t ja hashit Run-sheetissä |

Save-painikkeen disabled-tila ei korvaa näkyvää validation messagea.

## Saavutettavuus

- Jokaisella kontrollilla on ohjelmallinen label.
- Helper ja error yhdistetään `aria-describedby`-viitteillä.
- Invalidi kontrolli saa `aria-invalid="true"`.
- Transitions käyttää `fieldset`/`legend`-rakennetta.
- Multi-select on kokonaan näppäimistökäyttöinen ja ilmoittaa valintojen määrän sekä option tilan.
- Chip-remove-painikkeilla on yksilölliset accessible nimet.
- Collapsible-triggerit ilmoittavat `aria-expanded`-tilan.
- Origin, availability, Approved ja Rejected eivät välity yksin värillä.
- Focus palautuu popoverin sulkeutuessa triggeriin.
- Mobiilissa input-fontti on vähintään 16 px ja kontrolli vähintään 40 px.

## DESIGN.md-tokenien käyttö

Suunnitelma ei lisää uutta palettia, typografiaa, radius- tai shape-kieltä.

- workspace base: `surface-container-lowest` / `#0c0e11`
- panelit: `surface` / `#111316`
- nested header/disclosure: `surface-container-low` / `#1a1c1f`
- popover: `surface-container` / `#1e2023`
- hover/selected: `surface-container-high` / `#282a2d`
- teksti: `on-surface` / `#e2e2e6`
- muted teksti: `on-surface-variant` / `#c1c6d7`
- border: `outline-variant` / `#414755`
- focus/selection: `primary` / `#adc6ff`
- Approved: `secondary` / `#4edea3`
- attention: `tertiary` / `#ffb95f`
- blocking error: `error` / `#ffb4ab`

Inter säilyy käyttöliittymätekstissä ja Geist ID:issä, poluissa, Transition-targeteissa sekä composition-metadatassa. Desktop-formit käyttävät 28 px / 12 px densityä, 88 px label-saraketta ja 4 px spacing-yksikköä. Kontrollit käyttävät 4 px ja panelit 8 px radius-sääntöä.

## Toteutusrajat

Tässä scopessa ei rakenneta:

- settings-sivua;
- execution profile -editoria Node sheetin sisään;
- template packia tai Recipe-editoria;
- additional instructions -UI:ta;
- workspace access -UI:ta;
- uutta Canvas-rendereriä tai graph geometrya; tai
- production-koodia.

Nykyinen `DESIGN.md` määrää Agentin omistamaan Execution-asetukset ja sitoo Agent-avatarin sekä reasoning glown Canvas-nodeen. Jos proposed-malli hyväksytään, varsinainen implementation-goal joutuu päivittämään `DESIGN.md`:n nämä rajatut kohdat ennen UI-koodia. Tätä tiedostoa ei muuteta nykyisen goalin sallituissa poluissa.

## Ihmisen tarkistuspisteet

- Onko `Execution profile` käyttäjälle hyväksyttävä termi, kun sen sisäisiä runtime-arvoja ei näytetä Node editorissa?
- Hyväksytäänkö tyhjä required-valinta uuden Stepin turvalliseksi oletukseksi?
- Hyväksytäänkö Node ID:n ja Step typen sijoitus Advanced-osioon?
- Missä execution profilet luodaan ja muokataan ilman settings-sivua?
- Mitä Agent-avatarille, reasoning glow'lle, Agent-statusille ja agenttikohtaisille Run-reiteille tapahtuu?

Nämä ja muut päätökset ovat `OPEN-DECISIONS.md`:ssä.
