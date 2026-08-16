# GPT-5.6 Sol -promptit: Balletin asennettavat Loop-moduulit

## Tavoite

Muuta Balletin Loop Engineering siten, että:

- yksi **Loop Module** sisältää täsmälleen yhden uudelleenkäytettävän Loop-kokonaisuuden;
- Loop voidaan tuoda, tarkastaa, asentaa, poistaa ja viedä tiedostona;
- käyttäjä voi lisätä Looppinsa yksinkertaisesta Loop Librarysta tai luoda tyhjän Loopin;
- esimerkiksi arc42-metodin kuusi aktiviteettia näkyvät kuutena itsenäisenä asennettavana laatikkona;
- asennettu Loop materialisoituu nykyiseksi project-local `ProjectLoop`-määrittelyksi;
- nykyinen strict-v10 runtime, Root Run snapshot, Work/Validation, State, repair ja continuation säilyvät;
- ulkoista pakettia ei ratkaista tai ladata Runin aikana;
- käyttöliittymä pysyy yhtenäisenä, selkeänä ja helposti lähestyttävänä.

## Suositeltu perusratkaisu

V1:ssa moduuli on **authoring- ja install-time-käsite**, ei uusi runtime-suoritusentity.

```text
.ballet/loop-library/*.ballet-loop.json
                │
                ▼
       Inspect + install plan
                │
                ▼
  Materialisoitu project-local sisältö
  ├─ .ballet/project.json        ProjectLoop
  ├─ .ballet/instructions/**     module-owned instructions
  ├─ .agents/skills/**           module-owned skills
  └─ .ballet/loop-modules/installed.json
                │
                ▼
       Nykyinen strict-v10 runtime
```

V1-rajaus:

- yksi paketti = yksi Loop;
- yksi UTF-8 JSON-tiedosto, esimerkiksi `clarify-requirements.ballet-loop.json`;
- ei remote marketplacea;
- ei automaattista päivitystä;
- ei suoritettavaa JavaScriptiä, shelliä tai binäärejä paketissa;
- ei ExecutionProfilejen pakkaamista;
- ei projektien ulkopuolista live-linkkiä;
- ei runtime-muutosta ulkoisen moduulin ratkaisemiseksi.

Module Package sisältää Loop-templaten, module-local instructionit ja skillsit, profile-slotit, yhteensopivuustiedot, State-contractin sekä `requires`/`provides`-capabilityt. Installer muuntaa paikalliset tunnisteet projektin globaalisti yksilöllisiksi ID:iksi.

---

# Mallin ajotapa

Käytä ensisijaisesti:

```text
model: gpt-5.6-sol
reasoning effort: medium baseline
network access: off
```

Käytä network-on-profiilia vain auditointipromptissa, kun agentti lukee annettuja virallisia lähteitä. Kokeile `high`-tasoa vain arkkitehtuuripromptissa, jos paikallinen provider ilmoittaa sen tuetuksi ja tulosta verrataan samaan tehtävään `medium`-tasolla.

Nykyinen Balletin ExecutionProfile ei mallinna Responses API:n `reasoning.mode`-kenttää. Älä väitä pro-moden olevan käytössä, ellei sitä toteuteta erillisenä, tarkoituksellisena ominaisuutena.

---

# Yhteinen työskentelysopimus

Liitä tämä jokaisen vaihepromptin alkuun, jos ajat promptit erillisissä keskusteluissa.

```text
Olet `isinisalo/ballet`-repositoryn päävastuullinen ohjelmistoarkkitehti ja toteuttava repository-agentti.

Auktoriteetti
- Saat tehdä pyydetyt repositoryn sisäiset muutokset ja ajaa relevantit ei-tuhoavat validoinnit.
- Älä pushaa, mergeä, tagaa, julkaise, deployaa tai tee muuta ulkoista kirjoitusta.
- Älä muuta hyväksytyn Goalin tai ADR:n semanttista päätöstä hiljaa. Tee uusi ADR tai merkitse vanha päätös osittain superseded-tilaan eksplisiittisesti.
- Älä palauta hidden chain-of-thoughtia. Palauta päätökset, evidenssi, diff-raja, tarkistukset ja avoimet kysymykset.
- Kysy ihmiseltä vain, kun WHAT/WHY, hyväksymismitta, oikeusraja, yhteensopivuuspolitiikka tai muu korkean vaikutuksen päätös ei ratkea kanonisista lähteistä.

Lue ennen muutoksia
1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `DESIGN.md`, jos muutat käyttöliittymää
4. `.ballet/project.json`
5. relevantit `.ballet/goals/**`, `.ballet/adr/**` ja `.ballet/arc42/**`
6. `shared/domain/automation.ts`
7. `shared/api/workspace-schemas.ts`
8. `shared/api/workspace-contracts.ts`
9. `backend/project-config/ProjectConfigurationRepository.ts`
10. `backend/automation/automationRepository.ts`
11. `backend/services/AutomationService.ts`
12. `backend/store.ts`
13. `backend/documents/projectResourceCatalog.ts`
14. `frontend/src/workspace/automation/AutomationView.tsx`
15. `frontend/src/workspace/automation/loops/AllLoopsCanvas.tsx`
16. `frontend/src/workspace/automation/loops/LoopOverviewCard.tsx`
17. `frontend/src/workspace/automation/loops/LoopEditor.tsx`
18. `frontend/src/workspace/automation/loops/LoopDefinitionEditor.tsx`
19. `frontend/src/workspace/automation/loops/loopEditorState.ts`
20. `package.json` ja nykyiset relevantit testit

Viralliset lähteet
- arc42 method: `https://arc42.org/method/`
- Ballet repository: `https://github.com/isinisalo/ballet`
- GPT-5.6 guidance: `https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6`

Projektin ja platformin raja
- Moduulien paketointi, katalogi, installointi ja export ovat geneerisiä platform-ominaisuuksia.
- arc42-moduulien nimet, tehtävät, instructionit, skillsit ja suositellut yhteydet ovat dataa, eivät platform-koodiin kovakoodattavaa logiikkaa.
- Runtime ei saa tuntea arc42:ta, module ID:tä, katalogikategoriaa tai pakettilähdettä.
- Asennuksen jälkeen runtime lukee vain nykyisiä materialisoituja project-local Loop-, instruction- ja skill-resursseja.
- Älä tee laajaa refaktorointia ilman tämän ominaisuuden osoittamaa tarvetta.

Valmis työ
- Muutos on valmis vasta, kun domain, schema, backend, UI, dokumentaatio ja testit ovat keskenään yhdenmukaiset.
- Raportoi jokainen ajettu tarkistus. Jos tarkistusta ei voitu ajaa, ilmoita tarkka komento, este ja vaikutus.
```

---

# Pääpromptti: toteuta ominaisuus kokonaisuutena

```text
Toteuta Balletiin asennettavat ja vietävät yhden Loopin moduulit.

Tuotevisio
Loop Engineeringissä yksittäinen Loop on käyttäjälle yksi ymmärrettävä toiminnallinen laatikko. Käyttäjä voi painaa `Add Loop`, valita valmiin moduulin Loop Librarysta, tuoda paikallisen `.ballet-loop.json`-tiedoston tai luoda tyhjän Loopin. Loopin sisäiset Work Loop Nodet, Work/Validation-rakenne, State ja Edget avautuvat vasta, kun käyttäjä avaa Loopin yksityiskohtaisen editorin.

Arkkitehtuuripäätös
- `LoopModulePackageV1` on portable authoring artifact.
- `ProjectLoop` säilyy runtime-määrittelynä.
- Asennus materialisoi paketin sisällön `.ballet/project.json`-, `.ballet/instructions/**`- ja `.agents/skills/**`-resursseiksi.
- `.ballet/loop-modules/installed.json` sisältää vain provenance- ja ownership-metadatan.
- Runtime snapshottaa materialisoidun projektin nykyiseen tapaan eikä ratkaise ulkoisia module packageja.
- `.ballet/loop-library/` sisältää versionhallittavia asennettavia paketteja.
- Paketissa on täsmälleen yksi Loop eikä projektitason Orchestratoria tai valmiita `loopEdges`-yhteyksiä.
- Paketti saa kuvata `requires`, `provides` ja `recommendedConnections`, mutta käyttäjä omistaa projektin varsinaisen flow- ja repair-graafin.
- ExecutionProfilet eivät kuulu pakettiin. Paketti määrittelee profile-slotit, jotka mapataan olemassa oleviin project-local ExecutionProfileihin installoinnissa.
- Ensimmäinen versio ei sisällä remote registryä, marketplacea, automaattista päivitystä tai paketissa suoritettavaa koodia.

Tee ensin päätökset
1. Luo initiative `installable-loop-modules`.
2. Luo seuraava vapaa Goal.
3. Luo seuraava vapaa ADR, joka:
   - laajentaa tai osittain supersedoi ADR-014:n V1-rajausta;
   - säilyttää copy-to-project- ja no-live-runtime-dependency-periaatteen;
   - lukitsee yhden Loopin package-formaatin;
   - erottaa Module Packagen, Installed Loopin ja Loop Runin;
   - lukitsee profile-slot-, resource-namespace-, state-contract- ja capability-mallin;
   - rajaa remote registryn ja automaattiset päivitykset ulos V1:stä;
   - kuvaa importin trust- ja approval-rajan.
4. Päivitä relevantit arc42-osiot ja initiative BRIEF/PLAN.

Toteuta domain
- Lisää geneeriset `LoopModulePackageV1`, manifest-, resource-, profile-slot-, state-contract-, capability-, provenance-, install-plan- ja conflict-tyypit.
- Lisää strict Zod-skeemat ja selkeät virhekoodit.
- Pidä package format erillään strict-v10 `ProjectLoop`-skeemasta.
- Package käyttää module-local avaimia. Installer materialisoi loop-, node-, edge-, instruction- ja skill-ID:t deterministisesti project-validiksi ja globaalisti yksilölliseksi.
- Paketti ei saa sisältää absoluuttisia polkuja, symlinkkejä, binäärejä, salaisuuksia, runtime-historiaa tai `.git/ballet`-dataa.
- Paketin sisältö on yksi UTF-8 JSON-envelope. Enforceoi koko-, merkkijono-, resurssi- ja lukumäärärajat.

Toteuta install/export-palvelut
- Listaa `.ballet/loop-library/*.ballet-loop.json` packageina.
- Tarkasta tuotu package ilman kirjoituksia.
- Muodosta install plan, joka sisältää:
  - materialisoitavan Loopin;
  - kirjoitettavat resource-polut;
  - ID-remappingin;
  - profile-slot-mappingit ja ehdokkaat;
  - permission- ja network-yhteensopivuuden;
  - State-contract-yhteensopivuuden;
  - ID-, resource- ja ownership-konfliktit;
  - exact diff summaryn.
- Käyttäjän vahvistama install revalidoi planin nykyistä project statea vasten ennen commitia.
- Kirjoita module-owned resource-tiedostot turvallisesti ja `.ballet/project.json` viimeisenä atomisesti. Epäonnistuminen ei saa jättää configia viittaamaan puuttuvaan resurssiin.
- Hyödynnä nykyistä project-config mutation queuea.
- Estä install, export, update, adopt ja remove, jos relevantilla Loopilla on aktiivinen Run.
- Exporttaa valittu Loop ja sen transitiivisesti viittaamat project instructionit ja skillsit.
- Muunna ExecutionProfile-viitteet package profile-sloteiksi.
- Älä exporttaa ExecutionProfileja tai machine-local asetuksia.
- Tuota kanoninen serialisointi ja SHA-256.
- Tallenna provenance. Laske `exact | modified | missing-resources` nykyisestä sisällöstä, älä luota pelkkään tallennettuun statuskenttään.
- Salli nykyisen custom Loopin `Export as module`.
- Salli package-importissa `Install as new Loop`; älä ylikirjoita olemassa olevaa Loopia oletuksena.
- Uninstall/remove saa poistaa module-owned resursseja vain, jos mikään muu composition ei viittaa niihin.

Toteuta API
Lisää selkeät DTO:t ja endpointit vähintään:
- module libraryn listaus;
- package inspection;
- install plan;
- install commit;
- Loop export;
- provenance/status;
- provenance-aware remove.

Endpointit eivät saa lukea mielivaltaista palvelinpolkua. Selain lukee paikallisen import-tiedoston ja lähettää JSON-sisällön backendille.

Toteuta yksinkertainen UI
- Säilytä nykyinen Automation/Loops-navigaatio; älä lisää marketplacea uutena pääalueena.
- `Add Loop` avaa yhden selkeän Loop Library -dialogin tai sheetin.
- Dialogissa on:
  - hakukenttä;
  - pienet kategoriat/tägit vain, jos niillä on sisältöä;
  - valmiiden moduulien kortit;
  - `Import file`;
  - `Create blank Loop`.
- Moduulikortti näyttää yhden laatikon:
  - käyttäjäystävällinen title;
  - enintään kahden rivin description;
  - version ja kategorian;
  - olennaiset permission/network-badget;
  - `Add`.
- Älä näytä moduulikortissa sisäisiä Work Loop Nodeja.
- Install preview näytetään vain, kun mapping, conflict, permission tai State-contract vaatii käyttäjän päätöksen. Yksiselitteinen turvallinen install saa valmistua yhdellä vahvistuksella.
- Profile-slot mapping käyttää olemassa olevia ExecutionProfileja ja ehdottaa vain yhteensopivia vaihtoehtoja.
- Advanced metadata on progressiivisesti paljastettava, ei oletusnäkymän lomakeseinä.
- Installed Loop -kortti näyttää module title/version/provenance-statuksen ja komennot `Open`, `Export` ja `Remove`.
- Nykyinen LoopEditor säilyy Loopin sisäisenä advanced editorina.
- Päivitä `DESIGN.md`, jos All Loops -kortin informaatioarkkitehtuuri muuttuu.
- Toteuta keyboard-, focus-, aria-, narrow viewport- ja validation-käyttäytyminen.

Toteuta arc42 starter library
Luo `.ballet/loop-library/arc42/`-hakemistoon yksi package kutakin nykyistä arc42-aktiviteettia kohti:
- Clarify requirements
- Design structures
- Design cross-cutting concepts
- Communicate and document
- Accompany implementation
- Analyze and evaluate
- Continuous learning

Jokainen package:
- sisältää täsmälleen yhden Loopin;
- on itsenäisesti asennettava;
- käyttää `arc42-method-state`-State-contractia;
- kuvaa hard `requires` vain todellisille preconditioneille;
- käyttää soft `recommendedConnections`-suhteita arc42:n keskinäiseen palautteeseen;
- sisältää module-local instructionit ja skillsit;
- ei sisällä project-global loopEdgejä;
- ei muuta nykyistä asennettua arc42-graafia automaattisesti.

Migraatio
- Nykyiset Loopit säilyvät toimivina custom Loopeina.
- Älä tee project config version 11 -migraatiota vain provenancea varten.
- Lisää current projectin seitsemälle arc42-Loopille package-exportit libraryyn.
- Voit `adopt`-toiminnolla liittää nykyisen Loopin provenanceen vain, jos materialisoitu sisältö vastaa packagea hash- ja semantic-checkillä.
- Älä muuta nykyisten arc42-Loopien runtime-semanttiikkaa tämän migraation sivuvaikutuksena.
- Päivitä README, AGENTS, ARCHITECTURE ja initiative EVIDENCE/REVIEW.

Turvallisuus
- Imported instructions ja skills ovat suoritukseen vaikuttavaa epäluotettua prompttisisältöä. Näytä lähde, hash, permission summary ja muuttuvat tiedostot ennen installia.
- Network-required packagea ei saa mapata network-off-profiiliin.
- Network-forbidden packagea ei saa hiljaa mapata network-on-profiiliin.
- External writes ovat V1-paketissa aina false; muu arvo on invalid.
- Estä duplicate IDs, invalid UTF-8, oversized content, unknown fields ja schema downgrade.
- Ei remote fetchiä, script hooksia tai post-install-komentoja.
- Export ei sisällä salaisuuksia, credentialeja, local statea, absolute rootsia tai console historya.

Testit
Lisää unit-, service-, API-, UI- ja release smoke -testit vähintään:
1. valid package round-trip;
2. malformed/oversized/unknown-field package;
3. loop/node/edge/resource-ID remapping;
4. profile-slot mapping;
5. permission mismatch;
6. instruction/skill conflict;
7. install failure cleanup;
8. active-run conflict;
9. export closure;
10. provenance exact/modified;
11. import -> install -> export semantic round-trip;
12. remove without deleting shared resources;
13. Loop Library keyboard and responsive behavior;
14. empty project -> install two arc42 modules -> create flow edge -> preflight;
15. packaged release contains and lists project library packages when fixture provides them.

Aja
- `npm run validate:arc42`
- `npm run test`
- `npm run lint`
- `npm run build`
- `git diff --check`
- `npx @google/design.md lint DESIGN.md`, jos DESIGN.md muuttui
- release smoke, jos build/package-sisältö muuttui

Lopputulos
Raportoi:
1. uusi domain-malli;
2. package-skeema;
3. install/export-transaktiot;
4. UI-polku;
5. module/provenance/source-of-truth-sopimus;
6. arc42 starter module -lista;
7. migraatio;
8. security boundaries;
9. ajetut checkit;
10. avoimet päätökset ja seuraava pienin tuotantokelpoinen inkrementti.
```

---

# Vaihe 1: arkkitehtuurianalyysi, Goal ja ADR

```text
Suunnittele asennettavat yhden Loopin moduulit nykyisen Ballet-arkkitehtuurin päälle. Älä toteuta vielä backendia tai käyttöliittymää.

Nykytilan oletukset on todistettava lähdekoodista:
- strict-v10 `ProjectAutomationConfig` sisältää Loopit inline-rakenteena;
- Loop käyttää project-local instruction-, skill- ja ExecutionProfile-viitteitä;
- Root Run snapshottaa materialisoidun projektin;
- All Loops -UI näyttää nykyiset Loopit ja luo tyhjän Loopin;
- ADR-014 rajasi template packin, katalogin ja clone-to-projectin pois V1:stä;
- arc42 6+1 Loop -malli on jo käytössä.

Tavoitepäätös
Suosittele mallia, jossa `Loop Module` on install-time package ja `ProjectLoop` säilyy runtime-määrittelynä. Perustele tämä vaihtoehto vähintään seuraavia vaihtoehtoja vasten:
A. runtime ratkaisee ulkoisen package-viitteen;
B. project.json v11 sisältää inline module entityt;
C. package materialisoidaan project-local resursseiksi ja provenance tallennetaan erikseen;
D. remote registry + live updates.

Valitse ratkaisu laatutavoitteilla:
- ymmärrettävyys;
- turvallisuus;
- versionhallittavuus;
- determinismi;
- import/export-portabiliteetti;
- yksinkertainen UI;
- backward compatibility;
- pieni runtime-riski.

Luo:
- `.ballet/arc42/initiatives/installable-loop-modules/BRIEF.md`
- `.ballet/arc42/initiatives/installable-loop-modules/PLAN.md`
- seuraava vapaa Goal
- seuraava vapaa ADR
- tarvittavat päivitykset arc42-osioihin 1, 2, 3, 4, 5, 8, 9, 10 ja 11

ADR:n pitää lukita:
- yksi package = yksi Loop;
- install-time materialization;
- no live dependency;
- package format versioning;
- profile-slot-malli;
- instruction/skill-resurssien omistus ja namespacing;
- globally unique node/edge ID -remapping;
- State-contract;
- capability metadata;
- provenance;
- local library + file import;
- remote registry ja auto-update ulos V1:stä;
- trust/approval boundary;
- nykyisen strict-v10 runtimen säilyminen.

Laadi myös:
- C4-/building-block-muutos;
- merkittävät runtime-skenaariot: inspect, install, export, remove;
- security/threat analysis;
- failure matrix;
- migration strategy;
- viipaloitu toteutusjärjestys.

Pysäytä `needs_input`-tilaan vain, jos käyttäjän päätös tarvitaan esimerkiksi package-formaatin, remote registryn, update-politiikan tai signed package -vaatimuksen osalta. Muussa tapauksessa valitse pienin turvallinen V1 ja merkitse myöhemmät vaihtoehdot non-goaleiksi.

Aja:
- `npm run validate:arc42`
- `git diff --check`

Älä muuta runtimea, project.json-skeemaa tai UI-koodia tässä vaiheessa.
```

---

# Vaihe 2: package-domain ja strict skeemat

```text
Toteuta hyväksytyn ADR:n mukainen `LoopModulePackageV1`-domain ja strict skeemat. Älä tee vielä tiedostokirjoituksia tai UI:ta.

Luo tarkoituksenmukaiset tiedostot, esimerkiksi:
- `shared/domain/loopModules.ts`
- `shared/api/loop-module-schemas.ts`
- tarvittavat exportit `shared/api/workspace-contracts.ts`-barreliin
- fixturet ja testit

V1 package on yksi UTF-8 JSON-envelope:

{
  "formatVersion": 1,
  "module": {
    "id": "lowercase-kebab-case",
    "version": "semver",
    "title": "Human-readable title",
    "description": "Short description",
    "category": "optional-category",
    "tags": [],
    "compatibility": {
      "projectConfigVersion": 10,
      "minimumBalletVersion": "..."
    },
    "stateContract": {
      "id": "...",
      "version": 1
    },
    "capabilities": {
      "requires": [],
      "provides": []
    },
    "permissions": {
      "network": "forbidden | optional | required",
      "externalWrites": false
    },
    "profileSlots": []
  },
  "loop": {},
  "resources": {
    "instructions": [],
    "skills": []
  },
  "recommendedConnections": [],
  "readme": "optional Markdown"
}

Tarkenna skeema repositoryn tarpeisiin, mutta säilytä nämä invariantit:
- täsmälleen yksi Loop;
- package-loop käyttää module-local avaimia eikä project resource ID:itä;
- node- ja edge-avaimet ovat vain package-local;
- profile-slot on looginen vaatimus, ei ExecutionProfile ID;
- instruction/skill reference käyttää package resource keytä;
- package ei sisällä Orchestratoria, project-global LoopEdgejä, ExecutionProfileja, provider credentialeja tai machine-local statea;
- unknown fields hylätään;
- kaikki teksti on rajattu;
- package-, resource-, node- ja edge-määrille on rajat;
- total encoded byte size on rajattu;
- JSON-depth on rajattu;
- `externalWrites` voi olla V1:ssa vain false;
- compatibility tarkistaa project config version 10;
- semver validoidaan ilman uuden raskaan dependency-paketin lisäämistä, ellei nykyinen dependency ole perusteltu;
- canonical serialization ja SHA-256 ovat deterministisiä.

Määrittele:
- `LoopModulePackageV1`
- `LoopModuleManifestV1`
- `LoopModuleLoopTemplateV1`
- `LoopModuleProfileSlotV1`
- `LoopModuleResourceV1`
- `LoopModuleStateContractV1`
- `LoopModuleCapabilitiesV1`
- `LoopModuleInstallPlan`
- `LoopModuleInstallConflict`
- `InstalledLoopModuleRecordV1`
- `LoopModuleStatus`

ID-materialization:
- Installer saa valitun project Loop ID:n.
- Se tuottaa deterministiset globaalisti yksilölliset project node- ja edge-ID:t.
- Se tuottaa project-valid instruction-ID:t nykyisen `project:<kebab-case>`-säännön mukaisesti.
- Se tuottaa skill-polut nykyisen `project:<kebab/path>`-säännön mukaisesti.
- Remappingin pitää päivittää kaikki sisäiset target- ja resource-viitteet.
- Collision ei saa johtaa hiljaiseen overwriteen.

State:
- Package sisältää Loopin initial Staten.
- Manifest sisältää State-contract identityn/version.
- Package schema ei väitä nykyisen runtimen validoivan täydellistä JSON Schemaa, ellei sellainen myös toteuteta.
- V1-yhteensopivuus voidaan lukita exact contract ID + major version -sääntöön.

Testaa:
- valid package;
- unknown field;
- invalid semver;
- duplicate local key;
- missing resource;
- invalid profile-slot reference;
- invalid internal edge;
- oversized package;
- JSON-depth;
- externalWrites true;
- canonical hash stability;
- materialized ID determinism and collision reporting.

Aja:
- `npm run test`
- `npm run lint`
- `npm run build`
- `git diff --check`
```

---

# Vaihe 3: backend inspect, install, export ja provenance

```text
Toteuta Loop Module -backend hyväksytyn domainin päälle. Älä muuta WorkLoopEngineä, Root Run snapshotia tai runtime database -skeemaa.

Luo geneeriset palvelut:
- project library repository;
- package inspector;
- install planner;
- installer;
- exporter;
- provenance repository;
- status calculator;
- provenance-aware remover.

Project-local polut:
- package library: `.ballet/loop-library/**/*.ballet-loop.json`
- installation provenance: `.ballet/loop-modules/installed.json`
- materialisoidut instructions: `.ballet/instructions/loop-modules/<module-id>/...`
- materialisoidut skills: `.agents/skills/loop-modules/<module-id>/<resource-key>/SKILL.md`

Instruction-ID:n pitää silti olla nykyisen frontmatter-säännön mukainen yksittäinen kebab-case ID. Käytä determinististä prefixiä, esimerkiksi `loopmod-<module-id>-<resource-key>`, ja varmista pituus/collisionit.

Install plan
Planin pitää palauttaa:
- package metadata ja hash;
- valittu project loop ID;
- loop/node/edge ID mapping;
- instruction/skill mapping;
- profile-slot requirements;
- yhteensopivat nykyiset ExecutionProfile-ehdokkaat;
- network/permission findings;
- State-contract findings suhteessa valittuihin connection-targeteihin;
- kaikki tiedostot, jotka luodaan tai muutetaan;
- config-diff summary;
- blockers, warnings ja required approvals;
- plan fingerprint.

Install commit
- Ota vastaan plan fingerprint ja valitut profile mappings.
- Lataa nykyinen project config uudelleen.
- Revalidoi package, library source/hash, mappings, resources, active runs ja conflict state.
- Älä luota clientin lähettämään materialisoituun ProjectLoopiin.
- Käytä project-config mutation queuea.
- Stageaa resource-sisällöt turvallisiin temporary-tiedostoihin.
- Älä seuraa symlinkkejä.
- Kirjoita resource-tiedostot ja project config siten, ettei config koskaan jää viittaamaan puuttuvaan resurssiin.
- Kirjoita provenance vasta onnistuneen materialisoinnin osana.
- Epäonnistuminen ennen config commitia siivoaa temporaryt ja uudet orphan-resurssit.
- Crash-skenaarion orphan-resurssit ovat korkeintaan referoimattomia; lisää deterministic cleanup/check.
- Estä overwrite oletuksena.

Exporter
- Valitse nykyinen ProjectLoop.
- Laske kaikkien Work-, Validation- ja mahdollisten scheduled-nodejen käyttämät instructionit ja skillsit.
- Varmista resurssien validius.
- Johda profile-slotit ExecutionProfilejen capabilityistä; älä pakkaa ExecutionProfileja.
- Muunna project IDs module-local keys -muotoon.
- Älä sisällytä project-global LoopEdgejä; muuta ne korkeintaan recommended capability metadataan vain käyttäjän eksplisiittisellä valinnalla.
- Tuota deterministic JSON ja SHA-256.
- Exportatun paketin uudelleenasennus tyhjään projektiin tuottaa semanttisesti saman Loopin mappingin jälkeen.

Provenance
Tallenna vähintään:
- module ID/version;
- installed project loop ID;
- source kind: `project-library | file-import | exported`;
- package SHA-256;
- materialisoidut instruction-ID:t ja skill-ID:t;
- install-time semantic hash.

Laske status:
- `exact`: semantic hash vastaa;
- `modified`: Loop tai module-owned resource poikkeaa;
- `missing-resources`: viitattu resource puuttuu;
- `unknown`: provenance on invalid.

Remove
- Käytä nykyisiä active-run- ja reference-checkejä.
- Poista Loop ja siihen liittyvät LoopEdget nykyisen semantiikan mukaisesti vasta vahvistetussa operationissa.
- Poista module-owned resource vain, jos mikään muu composition ei viittaa siihen.
- Custom Loopin nykyinen delete säilyy.
- Modified module vaatii vahvemman confirmation-tekstin.

API
Suunnittele pienet, selkeät endpointit esimerkiksi:
- `GET /api/loop-modules`
- `POST /api/loop-modules/inspect`
- `POST /api/loop-modules/install-plan`
- `POST /api/loop-modules/install`
- `POST /api/loops/:loopId/export-module`
- `GET /api/loop-modules/installations`
- `DELETE /api/loop-modules/installations/:loopId`

Selain lähettää importoidun JSON-sisällön; backend ei ota mielivaltaista filesystem-pathia.

Lisää AppDataan vain UI:n tarvitsema tiivis library/installations-projektio. Älä lähetä kaikkien packagejen koko resource-sisältöä workspace snapshotissa.

Testit:
- library scan;
- invalid/symlinked library file;
- inspect no writes;
- conflict plan;
- stale plan fingerprint;
- profile mapping;
- network mismatch;
- install happy path;
- cleanup failure;
- active run;
- export closure;
- semantic round-trip;
- provenance status;
- safe remove;
- concurrent project config mutations.

Aja:
- `npm run test`
- `npm run lint`
- `npm run build`
- `git diff --check`
```

---

# Vaihe 4: yksinkertainen Loop Library -käyttöliittymä

```text
Toteuta Loop Module -käyttöliittymä nykyiseen Automation/Loops-workspaceen. Lue `DESIGN.md` ennen muutoksia.

Tuotetavoite
Käyttäjä näkee asennetun Loopin yhtenä toiminnallisena laatikkona. Sisäiset Work Loop Nodet ja Work/Validation-yksityiskohdat näkyvät vasta Loopin editorissa. Käyttäjän ei tarvitse ymmärtää package-skeemaa lisätäkseen valmiin Loopin.

Pidä navigaatio yksinkertaisena
- Säilytä nykyinen `Automation > Loops` -paikka.
- Älä lisää uutta päävalikon marketplacea.
- Muuta `Add loop` avaamaan `Loop Library` -dialogi tai responsive sheet.
- Tarjoa samassa näkymässä:
  1. valmis library module;
  2. `Import file`;
  3. `Create blank Loop`.

Loop Library
- Hakukenttä titleen, descriptioniin, tagiin ja capabilityyn.
- Kategoriafilteri vain, jos kategorioita on enemmän kuin yksi.
- Moduulikortti on yksi selkeä laatikko:
  - title;
  - description enintään kaksi riviä;
  - version;
  - category;
  - tarvittaessa Network- tai Human approval -badge;
  - `Add`.
- Tekninen module ID, hash, resource count, profile slots ja capability-lista ovat `Details`-alueessa.
- Älä renderöi package-resurssien Markdownia oletuslistassa.
- Älä näytä internal Work Loop Nodeja library cardissa.

Install-polku
- Klikkaus `Add` pyytää backendiltä install planin.
- Jos kaikki mappingit ratkeavat yksiselitteisesti eikä warningeja ole, näytä tiivis confirm:
  - Loop title;
  - project Loop ID;
  - valittu profile mapping;
  - luotavat resource-määrät;
  - `Install`.
- Jos mapping tai conflict vaatii valinnan, avaa yksi review-form:
  - Loop ID/alias;
  - profile-slot mapping;
  - exact conflict;
  - permission/network summary;
  - changed files;
  - Install/Cancel.
- Pidä harvoin tarvittavat valinnat `Advanced`-disclosure-alueessa.
- Älä käytä monivaiheista wizardia ilman todistettua tarvetta.
- Import file käyttää native file inputia, hyväksyy vain sovitun extension/MIME-kokonaisuuden ja näyttää serverin inspect-tuloksen ennen installia.
- Virhe näkyy täsmällisesti relevantin cardin/formin yhteydessä.

Installed Loops
Muuta All Loops -kortin informaatioarkkitehtuuria:
- yksi kortti = yksi Loop;
- title ensisijaiseksi, tekninen loop ID metadataan;
- lyhyt kuvaus;
- source badge: `Custom | Module`;
- module version ja status `Exact | Modified`;
- flow/repair-yhteyksien lukumäärä tai tiivis yhteenveto;
- `Open`;
- overflow tai compact actionit: `Export`, `Remove`.
- Älä listaa kaikkia Work Loop Nodeja overview-kortissa.
- Loop Editorissä saa näyttää nykyisen canvas + inspector -rakenteen.

Kompositio
- Installed module card voi näyttää `Provides` ja `Needs` vain tiiviinä suggestionina.
- Älä luo LoopEdgeä automaattisesti ilman käyttäjän hyväksyntää.
- Kun käyttäjä muokkaa LoopEdgeä, näytä State-contract-incompatibility warning.
- `recommendedConnections` on ehdotus, ei pakotettu workflow.
- arc42-moduleja ei saa pakottaa kiinteään vesiputousjärjestykseen.

Saavutettavuus ja responsiivisuus
- Dialogilla on focus trap, otsikko, description ja palautuva fokus.
- Search ja cards toimivat näppäimistöllä.
- Card actionit ovat yksiselitteisesti nimettyjä.
- Mobile sheetissä primary action pysyy saavutettavana.
- Loading, empty, error ja stale plan -tilat toteutetaan.
- Save/install-pending estää duplicate submissionin.
- Älä lisää dekoratiivisia gradientteja, uusia paletteja tai uutta shape-kieltä.

Päivitä:
- `DESIGN.md`, koska overview-kortin sisältö muuttuu;
- UI-testit;
- relevantit routing/data hooks;
- README:n Loop Engineering -käyttöohje.

Tee UI-todennus:
1. tyhjä library;
2. seitsemän arc42-modulea;
3. search;
4. safe one-click install;
5. profile mapping;
6. conflict;
7. invalid import;
8. installed modified status;
9. export;
10. remove;
11. keyboard navigation;
12. narrow viewport.

Aja:
- `npm run test`
- `npm run lint`
- `npm run build`
- `npx @google/design.md lint DESIGN.md`
- `git diff --check`
```

---

# Vaihe 5: arc42-aktiviteetit erillisiksi starter moduleiksi

```text
Luo current projectin seitsemästä arc42-Loopista erilliset yhden Loopin package-artifactit `.ballet/loop-library/arc42/`-hakemistoon.

Moduulit:
1. `arc42-clarify-requirements`
2. `arc42-design-structures`
3. `arc42-design-concepts`
4. `arc42-communicate-document`
5. `arc42-accompany-implementation`
6. `arc42-analyze-evaluate`
7. `arc42-continuous-learning`

Käyttäjäystävälliset titlet:
- Clarify requirements
- Design structures
- Design cross-cutting concepts
- Communicate and document
- Accompany implementation
- Analyze and evaluate
- Continuous learning

Periaatteet
- Yksi package sisältää täsmälleen yhden Loopin.
- Nykyisen asennetun Loopin semantiikka ei muutu exportissa.
- Package on self-contained instructionien ja skillsien osalta.
- Package ei sisällä project-global flow- tai repair-LoopEdgejä.
- Package ei sisällä project Orchestratoria.
- Package ei sisällä ExecutionProfileja.
- Kaikki käyttävät `arc42-method-state` contractia version 1.
- Package resources ovat module-local key -avaruudessa.
- Installer namespaceaa ne project-resursseiksi.

Capabilityt
Johda vakaa, ymmärrettävä capability vocabulary. Erota:
- hard `requires`;
- `provides`;
- soft `recommendedConnections`.

Älä tee hard dependencyä vain nykyisen default flown perusteella. arc42-aktiviteetit ovat iteratiivisia ja keskinäisiä.

Esimerkkisuunta:
- clarify provides requirements/quality-scenarios;
- structures may require clarified intent and provides building-block/runtime/deployment design;
- concepts may require quality goals and provides crosscutting concepts/decision proposals;
- communicate provides reviewed documentation/handoff;
- implementation requires approved bounded intent and provides implementation/conformance evidence;
- evaluate requires evidence and provides findings/risks/improvements;
- learning provides material research findings and may recommend several targets.

Permissions
- Kaikki oletuksena network forbidden.
- Continuous learning saa kuvata network required vain research-slotissa, jos nykyinen Loop aidosti tarvitsee sitä.
- External writes false kaikissa.
- Human approval requirements kuvataan metadataan, mutta package ei ohita Human Nodea.

Readme
Jokaisen package-readmen pitää kertoa:
- tarkoitus;
- milloin Loop kannattaa asentaa;
- hard prerequisites;
- provided capabilities;
- State contract;
- profile slots;
- network/approval requirements;
- mitä tiedostoja Loop tyypillisesti muuttaa;
- ettei package luo yhteyksiä automaattisesti.

Current project
- Lisää package-provenance current projectin olemassa oleviin arc42-Looppeihin vain, jos semantic equality voidaan todistaa.
- Älä poista tai uudelleenasenna nykyisiä Looppeja pelkästään provenancea varten.
- Library packagejen pitää läpäistä sama inspector kuin file import.
- Lisää validatoriin library packages -tarkistus.
- Päivitä arc42 section 4/5/8/9/10, initiative EVIDENCE ja README.

Testaa vähintään:
- kaikki seitsemän packagea validoituvat;
- jokaisessa on yksi Loop;
- State-contract on sama;
- ei project-global LoopEdgejä;
- ei hardcoded ExecutionProfile-ID:tä;
- resources resolvoituvat;
- export -> inspect -> install fixtureen;
- kahden tai useamman arc42-moduulin resource namespacing ei törmää;
- recommended connections eivät luo Edges automaattisesti.

Aja:
- `npm run validate:arc42`
- `npm run test`
- `npm run lint`
- `npm run build`
- `git diff --check`
```

---

# Vaihe 6: migraatio, adopt, remove ja yhteensopivuus

```text
Viimeistele backward compatibility ja nykyisten Loopien migraatiopolku.

Nykyiset Loopit
- Kaikki ennen ominaisuutta luodut Loopit ovat `Custom`.
- Niitä ei tarvitse muuttaa tai paketoida voidakseen ajaa.
- Ne voi exportata moduleksi.
- `Adopt module provenance` on sallittu vain, kun nykyinen Loop ja package ovat materialisoinnin jälkeen semanttisesti samat.
- Adopt ei saa kirjoittaa Loopin tehtäviä, Statea, nodeja tai edgejä.
- Adopt kirjoittaa vain provenance-metadatan.

ID-yhteensopivuus
Nykyinen project schema vaatii globaalisti yksilölliset:
- Loop ID:t;
- node ID:t;
- edge ID:t;
- project instruction ID:t;
- skill ID:t.

Varmista, että install:
- käyttää käyttäjän hyväksymää Loop ID:tä;
- remappaa kaikki package-local node/edge ID:t;
- päivittää startNodeId:n ja sisäiset edge-targetit;
- generoi instruction/skill-ID:t;
- ei muuta muiden Loopien ID:itä;
- ei nimeä olemassa olevia resursseja uudelleen.

State-contract
- Provenance-derived Loops saavat State-contract-metadatan.
- Custom Loops ovat `untyped`, ellei käyttäjä lisää contractia erillisellä toiminnolla.
- Älä estä olemassa olevaa custom connectionia jälkikäteen.
- Uutta module-to-module flow/repair-yhteyttä luotaessa exact contract ID + compatible major version on V1:n safe default.
- Incompatibility näyttää blockerin tai explicit override -vaatimuksen ADR:n mukaan.
- Override on projektin päätös ja tallennettava evidenssi; älä piilota sitä warningin taakse.

Remove
- Erota `Remove Loop` ja mahdollinen `Remove module-owned resources`.
- Näytä ennen vahvistusta:
  - poistuva Loop;
  - poistuvat LoopEdget;
  - module-owned instructionit/skillsit;
  - resurssit, joita ei voida poistaa muiden viitteiden vuoksi;
  - modified status;
  - active-run blocker.
- Älä poista shared resourcea.
- Älä jätä provenance-recordia poistuneelle Loopille.
- Jos resource cleanup epäonnistuu config commitin jälkeen, raportoi orphan resource selkeästi ja tarjoa deterministic cleanup; runtime config ei saa viitata puuttuvaan resurssiin.

Update-politiikka
- V1 ei tee automaattista päivitystä.
- Sama module ID + uusi version voidaan:
  - asentaa uutena Loopina;
  - inspectoida vertailuna;
  - jättää update-toiminto myöhempään vaiheeseen.
- Älä tee hidden replacementia.
- Modified installed Loop ei saa päivittyä ilman explicit diff reviewta.

Dokumentoi:
- Custom vs Module;
- exact vs modified;
- export;
- import;
- adopt;
- remove;
- update non-goal;
- State-contract warning;
- Git diff ja source of truth.

Lisää migration- ja regression-testit. Nykyisen strict-v10 fixture-projektin pitää latautua muuttumattomana ilman provenance-tiedostoa.

Aja:
- `npm run validate:arc42`
- `npm run test`
- `npm run lint`
- `npm run build`
- `git diff --check`
```

---

# Vaihe 7: security review ja fail-closed-validointi

```text
Tee asennettavien Loop-moduulien erillinen security- ja robustness-katselmointi. Korjaa löydökset tämän ominaisuuden rajassa.

Threat model
Arvioi vähintään:
- malicious instruction/skill prompt content;
- schema smuggling ja unknown fields;
- oversized/deep JSON;
- duplicate keys ja ambiguous canonicalization;
- ID collision;
- resource overwrite;
- symlink/path traversal;
- stale install plan / TOCTOU;
- active run conflict;
- network permission escalation;
- external write capability;
- package hash mismatch;
- provenance spoofing;
- orphan resource;
- partial install;
- export of secrets/local state;
- denial of service library scanning;
- malicious Markdown rendering;
- cross-loop State incompatibility.

V1-säännöt
- package on dataa, ei koodia;
- ei scripts/hooks;
- ei remote fetchiä;
- ei absolute/relative package-supplied filesystem paths;
- backend generoi kaikki materialized paths;
- strict Zod schema;
- bounded package/resource sizes;
- bounded counts and depth;
- canonical hash;
- plan fingerprint;
- commit-time revalidation;
- active-run lock;
- externalWrites false;
- permission compatibility;
- imported prompt resources näkyvät review summaryssä;
- export allowlistaa vain Loopin definitionin ja viitatut project resources;
- `.git/ballet`, credentials, environment, console, absolute roots ja provider stores eivät koskaan kuulu exporttiin.

Trust UX
- Näytä source kind, module ID/version, SHA-256 ja network requirement.
- Imported file on `Untrusted local package` ennen installia.
- Project library package on `Project library`.
- Älä käytä “Verified” sanaa ilman kryptografisesti määriteltyä ja toteutettua verificationia.
- V1 ei väitä package signingia.
- Human approval tarvitaan permission mismatch overrideen, State-contract overrideen, replacementiin ja modified Loopin poistoon.

Lisää structured security error codes ja testit jokaiselle blockerille.

Tarkasta myös:
- API ei ota server filesystem pathia;
- content disposition ja filename exportissa ovat turvallisia;
- imported Markdown ei saa injektoida raw HTML:ää tavalla, jota nykyinen renderer ei jo turvallisesti käsittele;
- library scan ei seuraa symlinkkejä;
- invalid package ei estä koko WorkspaceData-latausta: raportoi item-level issue ja jatka muiden packagejen listausta;
- package content ei päädy runtime prompttiin ennen installia ja explicit mappingia.

Aja:
- kaikki module-testit;
- `npm run test`
- `npm run lint`
- `npm run build`
- `git diff --check`

Palauta severity-järjestyksessä:
- finding;
- evidence;
- impact;
- fix;
- regression test;
- residual risk.
```

---

# Vaihe 8: end-to-end-pilotti ja release smoke

```text
Pilotoi asennettavat Loop-moduulit nykyisessä Ballet-repositoryssä ja viimeistele tuotantokelpoinen V1.

Pilot-fixture
Luo tai laajenna fixture, jossa:
- strict-v10 project;
- vähintään kaksi yhteensopivaa ExecutionProfilea;
- tyhjä automation tai yksi custom Loop;
- project libraryssa vähintään `Clarify requirements` ja `Design structures`.

Todennettavat skenaariot
1. Workspace latautuu ilman provenance-tiedostoa.
2. Loop Library listaa validit package-kortit ja item-level invalid package -virheen.
3. Käyttäjä asentaa Clarify-moduulin.
4. Yksiselitteinen profile-slot auto-mapataan turvallisesti.
5. Installer kirjoittaa Loopin, instructionit, skillsit ja provenance-metadatan.
6. Workspace reload näyttää installed/exact-statuksen.
7. Käyttäjä asentaa Structures-moduulin eri resource namespaceen.
8. Käyttäjä hyväksyy flow-yhteyden Clarify -> Structures.
9. State-contract-yhteensopivuus läpäisee.
10. Root Run preflight ratkaisee materialisoidut resources nykyisellä strict-v10 snapshotilla.
11. Clarify exportataan packageksi.
12. Export inspectoidaan ja asennetaan tyhjään fixtureen eri Loop ID:llä.
13. Semantic round-trip läpäisee.
14. Installed Loopin taskia muutetaan; status muuttuu `modified`.
15. Modified Loopin remove näyttää vahvistuksen.
16. Shared resourcea ei poisteta.
17. Active Run estää edit/install/remove-konfliktin.
18. Invalid, oversized ja permission-mismatch package failaa ilman project-mutaatioita.
19. Git status sisältää vain odotetut project-local muutokset.
20. Ballet restartin jälkeen installed Loops ja provenance latautuvat.

UI acceptance
- Add Loop -polku löytyy ilman dokumentaatiota.
- Valmiin Loopin voi asentaa turvallisessa happy pathissa enintään kahdella päätöksellä: Add + Confirm.
- Technical metadata ei hallitse oletusnäkymää.
- Yksi card vastaa yhtä Loopia.
- Blank Loop on edelleen saatavilla.
- Import file on saatavilla samasta dialogista.
- Keyboard ja narrow viewport toimivat.
- Existing LoopEditor toimii muuttumattomalla runtime-semanttiikalla.

Packaging
Jos Balletin release bundle tarvitsee muutoksia module-library-tukeen:
- varmista, että platformin geneerinen code on bundleissa;
- project-local `.ballet/loop-library` tulee fixture-projektista, ei pakotettuna arc42-workflowna jokaiseen asennukseen;
- release smoke todentaa module API:n ja yhden install-planin;
- älä tee arc42-moduleista platformin piilotettuja defaultteja.

Dokumentaatio
Päivitä:
- README: Add, Import, Export, Custom vs Module;
- AGENTS: module boundaries ja testit;
- ARCHITECTURE/arc42 relevantit osiot;
- initiative EVIDENCE ja REVIEW;
- METHOD-HEALTH baseline.

Aja:
- `npm run validate:arc42`
- `npm run test`
- `npm run lint`
- `npm run build`
- `git diff --check`
- `npx @google/design.md lint DESIGN.md`, jos DESIGN.md muuttui
- packaged release smoke, jos release sisältö muuttui

Raportoi:
- oikeasti ajetut E2E-skenaariot;
- fixturet;
- UI acceptance;
- install/export semantic equality;
- runtime regression status;
- package security status;
- check results;
- residual risks;
- V2-ehdotukset erikseen, ilman että toteutat remote registryä tai auto-updatea.
```

---

# Lopulliset hyväksymiskriteerit

Ominaisuus on valmis, kun:

- yksi package sisältää täsmälleen yhden Loopin;
- package voidaan inspectoida ilman kirjoituksia;
- install materialisoi nykyisen strict-v10 ProjectLoopin ja resurssit;
- runtime ei ratkaise ulkoista packagea;
- ExecutionProfilet mapataan sloteista eikä niitä pakata;
- node-, edge-, instruction- ja skill-ID:t remapataan turvallisesti;
- yksi Loop näkyy UI:ssa yhtenä laatikkona;
- Add Loop tarjoaa Libraryn, Import filen ja Blank Loopin;
- happy path on lyhyt;
- konfliktit ja permissionit näkyvät ennen kirjoitusta;
- nykyiset custom Loopit toimivat ilman migraatiota;
- export on deterministic ja ei sisällä local statea tai salaisuuksia;
- provenance kertoo exact/modified-statuksen;
- remove ei poista jaettua resourcea;
- arc42-aktiviteetit ovat seitsemän erillistä asennettavaa module packagea;
- package ei pakota arc42:n kiinteää suoritusjärjestystä;
- State-contract tukee turvallista kompositiota;
- remote registry, auto-update, scripts ja live dependency eivät kuulu V1:een;
- project/platform-raja säilyy;
- nykyinen Root Run snapshot ja runtime-semanttiikka läpäisevät regression-testit;
- dokumentaatio, arc42 ja DESIGN.md vastaavat toteutusta;
- kaikki ilmoitetut tarkistukset on oikeasti ajettu.
