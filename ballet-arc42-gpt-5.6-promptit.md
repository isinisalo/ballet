# GPT-5.6 prompttipaketti: Ballet + arc42 -ohjelmistokehitysautomaatio

## Käyttötapa

Tämä paketti on tarkoitettu ajettavaksi `isinisalo/ballet`-repositorion juuressa GPT-5.6/Codex-agentilla.

Suositeltu järjestys:

1. Käytä ensin **Pääprompttia**, jos haluat toteuttaa muutoksen yhtenä kokonaisuutena.
2. Käytä **vaiheistettuja promptteja 1–6**, jos haluat pienemmät, helpommin katselmoitavat muutokset.
3. Käytä lopun **operointipromptteja** uuden kehitysaloitteen käynnistämiseen ja menetelmän jatkuvaan parantamiseen.

Mallijako:

- `gpt-5.6-sol`, reasoning `medium` tai mitatusti perusteltu `high`: arkkitehtuurin määrittely, ristiriitojen ratkaisu, arviointi ja migraation kokonaisvastuu.
- `gpt-5.6-terra`, reasoning `medium`: toteutus, dokumenttien mekaaninen päivitys ja konformanssikatselmointi.
- `gpt-5.6-luna`, reasoning `medium` tai `low`: deterministinen validointi, indeksien ylläpito ja suurivolyymiset tarkistukset.
- Älä nosta reasoning-tasoa automaattisesti. Säilytä nykyinen `medium` vertailutasona ja lisää uusi profiili vain, jos Balletin provider-capability ilmoittaa sen tuetuksi ja eval osoittaa mitattavan hyödyn.

---

# Tavoitearkkitehtuuri

## arc42 Template

Kanoninen, versionhallittu arkkitehtuuritieto:

```text
ARCHITECTURE.md
.ballet/
  arc42/
    README.md
    STATUS.md
    TRACEABILITY.md
    METHOD-HEALTH.md
    STATE-CONTRACT.md
    01-introduction-and-goals.md
    02-constraints.md
    03-context-and-scope.md
    04-solution-strategy.md
    05-building-block-view.md
    06-runtime-view.md
    07-deployment-view.md
    08-crosscutting-concepts.md
    09-architecture-decisions.md
    10-quality-requirements.md
    11-risks-and-technical-debt.md
    12-glossary.md
    initiatives/
      TEMPLATE/
        BRIEF.md
        PLAN.md
        EVIDENCE.md
        REVIEW.md
    migration/
      ASSESSMENT.md
      CONTENT-MAP.md
      DECISIONS.md
```

Periaatteet:

- `ARCHITECTURE.md` on ihmisen ja agentin yhteinen aloituspiste.
- `.ballet/arc42/01...12` on kanoninen arc42-rakenne.
- `.ballet/adr/` säilyy yksittäisten ADR:ien kanonisena sijaintina; arc42-osio 9 on indeksi ja yhteenveto, ei ADR:ien kopio.
- `.ballet/goals/` säilyy hyväksyttyjen tuotetavoitteiden kanonisena lähteenä; arc42-osio 1 viittaa niihin.
- Aloitekohtainen työ tallennetaan `.ballet/arc42/initiatives/<initiative-id>/`.
- Balletin Run UI, SQLite ja State-revisiot ovat käynnissä olevan suorituksen runtime-totuus. `STATUS.md` sisältää vain pysyvän projektitason handoffin eikä yritä kopioida jokaista runtime-tapahtumaa.
- Faktat, päätökset, oletukset, hypoteesit, havainnot ja avoimet kysymykset erotetaan toisistaan.
- Dokumentteja päivitetään inkrementaalisesti. Vain muutoksen kannalta olennaisia osia muutetaan.
- Jokaisella jäljitettävällä kohteella on vakaa tunniste, esimerkiksi `QG-001`, `QS-001`, `BB-001`, `RS-001`, `CC-001`, `RISK-001` ja `OQ-001`.
- Tunnisteita ei kierrätetä.

## arc42 Method Ballet-loopeina

Pakolliset Loopit:

1. `arc42-clarify-requirements`
2. `arc42-design-structures`
3. `arc42-design-concepts`
4. `arc42-communicate-document`
5. `arc42-accompany-implementation`
6. `arc42-analyze-evaluate`
7. `arc42-continuous-learning`

Oletus-flow:

```text
arc42-clarify-requirements
  -> arc42-design-structures
  -> arc42-design-concepts
  -> arc42-communicate-document
  -> arc42-accompany-implementation
  -> arc42-analyze-evaluate
  -> completed
```

Tämä on oletuspolku, ei vesiputousrajoite. Validation voi pyytää Orchestrator-korjausta aiempaan tai rinnakkaiseen aktiviteettiin. Repair-targetin valmistuttua runtime palaa alkuperäiseen Validation Nodeen persisted continuationin avulla.

`arc42-continuous-learning` on erillinen ajastettava Root Loop. Se ei tee ulkoisia kirjoituksia. Se arvioi teknologia-, riippuvuus-, laatu-, prosessi- ja arkkitehtuurisignaaleja ja reitittää materiaalisen havainnon tarvittavaan arc42-aktiviteettiin repair-edgellä.

Nykyinen `release-validation` säilytetään tukilooppina, ellei analyysi osoita sen olevan tarpeeton. Sitä ei kytketä automaattisesti jokaiseen kehitysajoon. Release-, deploy- ja muut ulkoiset kirjoitukset vaativat eksplisiittisen ihmisluvan.

## Yhteinen State

Kaikkien arc42-loopien ja mahdollisuuksien mukaan `release-validation`-loopin tulee käyttää samaa yhteensopivaa initial State -rakennetta, jotta mikä tahansa Loop voidaan käynnistää Root Loopina ja repair-kutsu voi jakaa saman kanonisen Staten.

Vähimmäissopimus:

```json
{
  "methodVersion": 1,
  "initiative": {
    "id": null,
    "title": null,
    "sourceRefs": [],
    "status": "uninitialized",
    "scope": [],
    "nonGoals": []
  },
  "architecture": {
    "documentRoot": ".ballet/arc42",
    "affectedSectionIds": [],
    "qualityScenarioIds": [],
    "adrIds": [],
    "buildingBlockIds": [],
    "riskIds": [],
    "openQuestionIds": []
  },
  "delivery": {
    "planPath": null,
    "changedFiles": [],
    "checks": [],
    "evidencePaths": []
  },
  "release": {
    "version": null,
    "deployment": null,
    "verification": null
  },
  "evaluation": {
    "findings": [],
    "improvementIds": []
  },
  "handoff": {
    "fromLoopId": null,
    "toLoopId": null,
    "summary": null
  }
}
```

Nodejen pitää tuottaa rajattu JSON Patch silloin, kun artifact-polku, tunniste, check tai handoff muuttuu. Dokumentit sisältävät pitkäikäisen projektitiedon; State sisältää kyseisen Root Runin ohjaus- ja evidenssitiedon.

---

# Pääpromptti: toteuta koko muutos

```text
Olet tämän repositoryn päävastuullinen ohjelmistoarkkitehti ja toteuttava repository-agentti.

Tavoite
Muuta nykyinen Ballet-projektin oma kehitysautomaatio arc42-tyyliseksi jatkuvaksi ohjelmistokehitysmenetelmäksi. arc42 Template määrittelee versionhallittavan arkkitehtuuritiedon rakenteen. Ballet Loopit toteuttavat arc42 Methodin, jossa vaatimusten selventäminen, rakenteiden suunnittelu, läpileikkaavien konseptien suunnittelu, kommunikointi ja dokumentointi, toteutuksen tukeminen sekä arkkitehtuurin analysointi ja arviointi muodostavat jatkuvan palautesilmukan.

Työskentelyoikeus
- Tee kaikki pyydetyt repositoryn sisäiset muutokset ja aja relevantit ei-tuhoavat validoinnit ilman erillistä lupaa.
- Älä pushaa, mergeä, julkaise, deployaa, luo releasea tai tee muuta ulkoista kirjoitusta.
- Älä muuta hyväksyttyjen Goalien tai ADR:ien semanttista päätöstä ilman, että käyttäjän tässä promptissa antama päätös yksiselitteisesti valtuuttaa muutoksen.
- Luo uusi Goal ja ADR tämän käyttäjän valtuuttamasta arc42-automaatiosta käyttäen seuraavia vapaita tunnisteita. Älä ylikirjoita olemassa olevaa tunnistetta.
- Muutokset loop-topologiaan, execution permissioneihin, verkko-oikeuksiin, release/deploy-toimintaan tai hyväksyttyyn WHAT/WHY-päätökseen ovat aina katselmoitavia ja jäljitettäviä.
- Pidä kaikki project-workflow-kohtainen logiikka `.ballet/project.json`-, `.ballet/instructions/**`, `.agents/skills/**`- ja `.ballet/arc42/**`-resursseissa. Älä kovakoodaa arc42- tai toimitusworkflow-tunnisteita `backend/`, `frontend/` tai `shared/`-platform-koodiin.
- Muuta platform-koodia vain, jos projektikohtainen toteutus ja testit osoittavat aidon geneerisen primitiivin puuttuvan. Dokumentoi tällainen tarve ennen toteutusta ADR:llä ja pidä ratkaisu täysin domain-neutraalina.

Lue ensin
1. `AGENTS.md`
2. `README.md`
3. `DESIGN.md`, jos muutat käyttöliittymää
4. `.ballet/project.json`
5. `.ballet/goals/summary.md` ja kaikki `.ballet/goals/*.md`
6. kaikki `.ballet/adr/*.md`, erityisesti ADR-012, ADR-013, ADR-014 ja ADR-015
7. kaikki `.ballet/instructions/*.md`
8. `.ballet/outputs/**`
9. `.fixture-ballet-project/**`
10. `shared/api/workspace-schemas.ts`
11. `shared/api/work-schedule-schema.ts`
12. `backend/documents/projectResourceCatalog.ts`
13. `package.json`

Käytä lähteinä
- arc42:n virallista menetelmäkuvausta: https://arc42.org/method
- arc42:n virallista 12-osioista dokumentointirakennetta: https://docs.arc42.org/home/
- GPT-5.6:n virallista malliohjetta: https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6

Jos verkko ei ole käytettävissä, käytä tässä promptissa määriteltyä tavoitetta ja merkitse lähteiden verkkotarkistus tekemättömäksi. Älä arvaa verkosta muuttuvia tietoja.

Arkkitehtuuripäätös
- Template = `.ballet/arc42/`-hakemiston kanoninen, versionhallittu arkkitehtuuritieto.
- Method = Balletin Work Loop-, Work/Validation-, State-, Edge-, LoopEdge- ja Orchestrator-primitiiiveillä toteutettu jatkuva toimintamalli.
- Oletus-flow saa olla lineaarinen, mutta menetelmä ei ole vesiputous: jokaisen aktiviteetin Validation voi pyytää korjausta relevanttiin arc42-Loopiin.
- Repair-reitti on capability-pohjainen. Malli ei saa valita continuationia tai paluukohdetta.
- Dokumentit tukevat sekä ihmistä että agentteja vakain tunnistein, eksplisiittisin statuksin, lähdeviittein, avoimin kysymyksin, traceabilityllä ja aloitekohtaisella handoffilla.
- Runtime UI ja State-revisiot ovat käynnissä olevan työn toteumatotuus. Markdown-dokumentit ovat pitkäikäinen projektitotuus.
- Menetelmän pitää parantaa itseään evidenssin perusteella, ei mallin mieltymyksen perusteella.

Toteuta seuraavat deliverables

A. Migraatioanalyysi
Luo:
- `.ballet/arc42/migration/ASSESSMENT.md`
- `.ballet/arc42/migration/CONTENT-MAP.md`
- `.ballet/arc42/migration/DECISIONS.md`

Niiden pitää:
- inventoida nykyiset Goal-, ADR-, ROADMAP-, DATA-MODEL-, C4-, UI-, milestone-, implementation-, test-, acceptance- ja release-artifactit;
- mapata kukin sisältö arc42-osioon, aloitekohtaiseen artifactiin, ADR:ään tai poistettavaan duplikaattiin;
- tunnistaa ristiriidat, puuttuvat päätökset ja legacy;
- erottaa säilytettävä projektitieto runtime-evidenssistä;
- määrittää turvallinen poisto- tai supersede-järjestys.

B. Päätökset ja aloituspiste
- Luo seuraava vapaa Goal, jonka päätös on: Ballet-projekti käyttää arc42 Templatea arkkitehtuuritiedon rakenteena ja Ballet-loopeja arc42 Methodin jatkuvana toteutuksena; ihmisen ja agenttien pitää nähdä sama tavoite, nykytila, evidenssi, avoimet kysymykset ja seuraava hyväksytty toiminto.
- Luo seuraava vapaa ADR, joka lukitsee:
  - arc42-dokumenttien kanoniset polut;
  - 6+1 Loop -mallin;
  - yhteisen State-sopimuksen;
  - flow- ja repair-semanttiikan;
  - ihmishyväksynnän rajat;
  - jatkuvan oppimisen ja menetelmäterveyden;
  - olemassa olevien Goalien ja ADR:ien säilymisen kanonisina lähteinä.
- Päivitä Goal-yhteenveto ja arc42-osio 9:n indeksi.

C. arc42-dokumenttirakenne
Luo:
- `ARCHITECTURE.md`
- `.ballet/arc42/README.md`
- `.ballet/arc42/STATUS.md`
- `.ballet/arc42/TRACEABILITY.md`
- `.ballet/arc42/METHOD-HEALTH.md`
- `.ballet/arc42/STATE-CONTRACT.md`
- 12 arc42-osiota tiedostoihin `01...12`
- `.ballet/arc42/initiatives/TEMPLATE/{BRIEF,PLAN,EVIDENCE,REVIEW}.md`

Käytä yhdenmukaista frontmatteria:
- vakaa `id`
- `title`
- `status`: `draft | review | accepted | superseded`
- `createdAt`
- `updatedAt`
- `version`
- `tags`
- arc42-osiotiedostoissa `arc42Section`

Sisältösopimus:
- Jokainen tiedosto kertoo tarkoituksen, statuksen, kanoniset lähteet, relevantit päätökset, evidenssin, avoimet kysymykset ja seuraavan katselmointiperusteen.
- Erota `Fact`, `Decision`, `Assumption`, `Hypothesis`, `Finding` ja `Open question`.
- Käytä vakaita tunnisteita ja linkkejä.
- `TRACEABILITY.md` jäljittää vähintään:
  `Goal/Requirement -> Quality Scenario -> ADR/Concept -> Building Block -> Runtime/Deployment Scenario -> Test/Monitor -> Evidence -> Status`.
- Laatuskenaariot ovat spesifejä ja mitattavia. Käytä kenttiä:
  `ID, source, stimulus, environment, affected artifact, expected response, measurable response criterion, priority, evidence, status`.
- Building block -kuvaukset sisältävät vastuun, rajapinnat, laatumerkityksen, lähdekoodisijainnin, toteutetut vaatimukset ja avoimet riskit silloin, kun ne ovat relevantteja.
- Dokumentoi vain tärkeät, riskialttiit, monimutkaiset tai muuten arkkitehtonisesti merkittävät runtime-skenaariot.
- `09-architecture-decisions.md` viittaa `.ballet/adr/`-tiedostoihin eikä kopioi niiden sisältöä.
- `STATUS.md` sisältää pysyvän projektitason tilanteen ja handoffin, ei Balletin runtime-lokin kopiota.
- Säilytä teksti tiiviinä. Älä luo 12 tyhjää seremoniallista tiedostoa: siirrä nykyinen todennettava sisältö oikeisiin osioihin ja merkitse puuttuva tieto eksplisiittisesti.

D. Ballet Loopit
Korvaa nykyinen blueprint/milestone/delivery-ketju seuraavilla project-local Loopeilla:
1. `arc42-clarify-requirements`
2. `arc42-design-structures`
3. `arc42-design-concepts`
4. `arc42-communicate-document`
5. `arc42-accompany-implementation`
6. `arc42-analyze-evaluate`
7. `arc42-continuous-learning`

Säilytä `release-validation` tukilooppina, mutta:
- älä ketjuta sitä automaattisesti jokaiseen kehitysajoon;
- pidä release/deploy ulkoisina kirjoituksina, jotka vaativat eksplisiittisen ihmisluvan;
- lisää tarvittavat repair-reitit dokumentaatio-, toteutus- ja arviointilooppeihin.

Oletus-flow:
`clarify -> structures -> concepts -> communicate -> implementation -> evaluate -> completed`.

Määritä jokaiselle Loopille 2–4 ymmärrettävää Work Loop Nodea. Jokainen Node muodostaa yhden tavoitteen, työn ja validoinnin. Älä tee yhdestä Nodesta koko projektin kattavaa monoliittia.

Vähimmäisvastuut:

`arc42-clarify-requirements`
- muodosta tai päivitä aloite-BRIEF;
- selvennä tavoitteet, sidosryhmät, scope/non-goals, rajoitteet ja context;
- määritä top-laatutavoitteet ja mitattavat laatuskenaariot;
- pyydä ihmiseltä päätös, jos WHAT/WHY, prioriteetti tai hyväksymismitta puuttuu.

`arc42-design-structures`
- päivitä solution strategy;
- suunnittele Building Block View;
- päivitä olennaiset Runtime View- ja Deployment View -skenaariot;
- mapita building blockit lähdekoodihakemistoihin ja rajapintoihin.

`arc42-design-concepts`
- suunnittele quality-driven cross-cutting concepts;
- linkitä konseptit laatuskenaarioihin ja building blockeihin;
- luo ADR-ehdotus vain arkkitehtonisesti merkittävästä päätöksestä;
- hyväksyttyä ADR:ää ei muuteta hiljaa.

`arc42-communicate-document`
- synkronoi indeksit, traceability, glossary, status ja aloitekohtainen handoff;
- tuota katselmointiyhteenveto, jossa näkyvät muutokset, päätökset, oletukset, riskit ja avoimet kysymykset;
- älä duplikoi kanonista sisältöä.

`arc42-accompany-implementation`
- laadi aloitekohtainen toteutussuunnitelma, joka viittaa QS-, ADR-, BB-, runtime- ja testitunnisteisiin;
- toteuta rajattu koodi ja testit;
- vertaa diffiä suunniteltuun arkkitehtuuriin;
- jos toteutus paljastaa paremman ratkaisun, päivitä arkkitehtuuri tai pyydä repair-loop; älä piilota drift-havaintoa;
- kerää acceptance- ja conformance-evidenssi.

`arc42-analyze-evaluate`
- arvioi toteuma mitattavia laatuskenaarioita vasten;
- analysoi riskit, technical debt, architecture drift ja päätösten ajantasaisuus;
- päivitä `11-risks-and-technical-debt.md`, `TRACEABILITY.md`, aloite-REVIEW ja `METHOD-HEALTH.md`;
- johda vain evidenssiin perustuvat parannustoimet;
- reititä puute tarvittavaan arc42-aktiviteettiin.

`arc42-continuous-learning`
- aloitusnode saa olla scheduled vain, jos strict-v10-skeema ja provider-capability tukevat sitä;
- käytä oletuksena viikoittaista aikataulua maanantaisin klo 09:00 `Europe/Helsinki`; aseta `startsOn` seuraavaan toteutushetkestä laskettuun maanantaihin;
- käytä verkkoa vain tässä eksplisiittisessä research-nodessa ja vain authoritative/primary sources -lähteisiin;
- tutki riippuvuudet, teknologiat, viralliset release notes/advisories, toistuvat validation-failit, repair-reitit, dokumenttidrift ja testievidenssi;
- älä tee ulkoisia kirjoituksia;
- älä muuta Loopia, permissioneita, hyväksyttyä Goalia/ADR:ää tai instruction/skill-käyttäytymistä pelkän malliarvion perusteella;
- kirjaa havainto, vaikutus, lähde-evidenssi, relevantti QS/RISK/ADR/BB ja odotettu mitattava parannus;
- reititä materiaalinen havainto repair-edgellä oikeaan arc42-Loopiin;
- jos mitään materiaalista ei löydy, älä tee dokumenttichurnia.

E. Yhteinen State
- Käytä kaikissa arc42-loopeissa samaa `Arc42MethodStateV1`-yhteensopivaa initial JSON -rakennetta.
- Sisällytä vähintään initiative-, architecture-, delivery-, release-, evaluation- ja handoff-alueet.
- Dokumentoi sopimus `STATE-CONTRACT.md`:ssä.
- Work- ja Validation-outcomet päivittävät Statea vain rajatuilla JSON Patch -operaatioilla.
- Patch-evidenssi sisältää muuttuneet artifact-polut, vakaat tunnisteet ja ajetut checkit.
- Älä käytä Statea dokumenttien täydellisen sisällön kopiona.

F. Flow- ja repair-graafi
Lisää flow-edget oletuspolulle.

Lisää vähintään seuraavat repair-capabilityt:
- structures -> clarify, structures
- concepts -> clarify, structures, concepts
- communicate -> clarify, structures, concepts, communicate
- implementation -> clarify, structures, concepts, communicate, implementation
- evaluate -> clarify, structures, concepts, communicate, implementation, evaluate
- continuous-learning -> clarify, structures, concepts, communicate, evaluate, continuous-learning
- release-validation -> communicate, implementation, evaluate, release-validation

Pidä repair-edgejen descriptionit capability-pohjaisina. Orchestrator ei saa käyttää ensimmäistä targetia fallbackina.

G. ExecutionProfilet
- Säilytä nykyinen `medium` baseline.
- Käytä Solia arkkitehtuuriin ja arviointiin, Terraa toteutukseen ja Lunaa mekaaniseen validointiin/orchestrationiin.
- Network access on oletuksena pois.
- Network on sallitaan vain nodeissa, joiden tehtävä aidosti tarvitsee GitHubia, virallisia ulkoisia lähteitä tai release/deploy-evidenssiä.
- Älä lisää `high`, `xhigh`, `max` tai pro-modea ilman runtime-capabilityä ja eval-evidenssiä.
- Balletin nykyinen ExecutionProfile-skeema ei sisällä Responses API:n `reasoning.mode`-kenttää. Älä teeskentele pro-moden olevan käytössä.

H. Primary instructionit
Luo vähintään:
- `arc42-requirements-agent`
- `arc42-structure-agent`
- `arc42-concepts-agent`
- `arc42-documentation-agent`
- `arc42-implementation-agent`
- `arc42-evaluation-agent`
- `arc42-learning-agent`
- `arc42-reviewer`
- päivitetty `loop-orchestrator`

Jokainen instruction sisältää:
- roolin;
- auktoriteettijärjestyksen;
- sallitut ja kielletyt kirjoitukset;
- lähde- ja evidenssivaatimukset;
- State patch -velvoitteen;
- `completed/needs_input/blocked/failed`-pysäytyssäännöt;
- Validation-roolissa kiellon muuttaa arvioitavaa toteutusta;
- kiellon keksiä puuttuvaa WHAT/WHY-päätöstä;
- kiellon palauttaa hidden chain-of-thoughtia.

Poista vanhat `migrated-*` instructionit vasta, kun kaikki viitteet on korvattu ja validointi osoittaa, ettei niitä käytetä.

I. Project skills
Luo projektiskillit hakemistoon `.agents/skills/arc42/.../SKILL.md` vähintään seuraaville menettelyille:
- `document-maintenance`
- `traceability`
- `quality-scenarios`
- `architecture-views`
- `decision-records`
- `conformance-review`
- `evaluation`
- `authoritative-research`
- `method-health`
- `initiative-handoff`

Pidä vastuunjako:
- Task kuvaa yksittäisen Noden konkreettisen tavoitteen.
- Primary instruction kuvaa roolin ja rajat.
- Skill kuvaa uudelleenkäytettävän menettelyn.
- Loop omistaa järjestyksen ja control flown.
- Älä kopioi samaa prosessia kaikkiin kolmeen kerrokseen.

J. Orchestrator
Päivitä Orchestrator-instruction capability-mapilla:
- epäselvä tavoite, stakeholder, scope, constraint tai quality scenario -> `arc42-clarify-requirements`
- building block, interface, runtime tai deployment -> `arc42-design-structures`
- cross-cutting concept tai merkittävä ADR -> `arc42-design-concepts`
- dokumentointi, glossary, traceability, handoff tai stakeholder review -> `arc42-communicate-document`
- koodi, testi, migration, conformance tai acceptance -> `arc42-accompany-implementation`
- quality evidence, risk, debt, drift tai päätöksen uudelleenarviointi -> `arc42-analyze-evaluate`
- teknologia- tai menetelmäoppiminen -> `arc42-continuous-learning`
- release/deploy/rollback -> `release-validation`

Jos useampi target on mahdollinen eikä evidenssi erottele niitä, palauta `needs_input`. Älä käytä ensimmäistä sallittua Loopia fallbackina.

K. Ihmisportit
Käytä Human Validationia tai eksplisiittistä `needs_input`-pysähdystä vähintään silloin, kun:
- uusi tai muuttuva WHAT/WHY-päätös tarvitaan;
- top-laatutavoitteen prioriteetti tai hyväksymismitta päätetään;
- uusi arkkitehtonisesti merkittävä ADR hyväksytään;
- toteutus hyväksytään ennen releasea;
- release/deploy/rollback tai muu ulkoinen kirjoitus sallitaan;
- loop-topologiaa, network accessia, permissioneita tai automaation omaa käyttäytymistä muutetaan.

Älä lisää ihmisporttia jokaisen mekaanisen dokumenttipäivityksen jälkeen.

L. Jatkuva itseparannus
`METHOD-HEALTH.md` seuraa ainakin:
- validation FAIL -määrät ja syyt;
- local retryt;
- orchestrator-repairit ja targetit;
- toistuvat avoimet kysymykset;
- stale/contradictory-document-findings;
- architecture drift -havainnot;
- testien ja laatuskenaarioiden evidenssivajeet;
- manuaalisten interventioiden syyt;
- ehdotettu parannus, odotettu mitta ja toteutunut vaikutus.

Säännöt:
- Automaattisesti saa korjata vain matalariskisen dokumenttilinkin, indeksin, formaatin, deterministisen lintin tai testin, kun semantiikka ei muutu.
- Goal-, ADR-, loop-, permission-, network-, release/deploy-, instruction- ja skill-käyttäytymismuutokset vaativat eksplisiittisen hyväksynnän.
- Jokainen menetelmämuutos sisältää baseline-mitan, hypoteesin, odotetun tuloksen ja myöhemmän evalin.
- Älä tee muutosta vain siksi, että teksti voisi olla erilainen.

M. Deterministinen validointi
Luo project-local validator esimerkiksi:
`.ballet/tools/validate-arc42.mjs`

Lisää npm-scripti:
`validate:arc42`

Validatorin pitää vähintään tarkistaa:
- kaikki 12 osiota ja tukidokumentit ovat olemassa;
- frontmatter-ID:t ovat uniikkeja;
- section-numerot ja tiedostonimet vastaavat toisiaan;
- paikalliset linkit ratkaisevat olemassa oleviin tiedostoihin tai ankkureihin;
- laatuskenaarioissa ovat pakolliset mitattavat kentät;
- traceabilityn viittaamat tunnisteet ovat olemassa;
- section 9:n ADR-viitteet ratkaisevat;
- `.ballet/project.json` on validi strict v10;
- kaikki ExecutionProfile-, instruction- ja skill-viitteet ratkaisevat;
- kaikilla nodeilla on täsmälleen yksi OK-edge;
- flow-ketju vastaa tavoitetta;
- vaaditut repair-capabilityt ovat allowlistattuja;
- arc42-loopien initial State on rakenteellisesti sama;
- network-on-profiilia käytetään vain eksplisiittisesti sallituissa nodeissa;
- platform-koodissa ei ole uusia arc42-loop-ID:itä tai artifact-polkuja.

N. Migraatio ja legacy
- Siirrä nykyisten ROADMAP-, DATA-MODEL-, C4-, UI-DESIGN-, TEST-PLAN-, IMPLEMENTATION-PLAN- ja ACCEPTANCE-artifactien relevantti sisältö kanonisiin arc42- tai initiative-dokumentteihin.
- Säilytä Git-historia; älä jätä kahta aktiivista source of truthia.
- Poista tai merkitse superseded vasta, kun kaikki linkit ja Node-taskit osoittavat uuteen paikkaan.
- Älä jätä aktiivista `migrated-*`-legacyä.
- Säilytä `DESIGN.md` UI-design-järjestelmän kanonisena lähteenä ja linkitä se arc42-osioon 8; älä kopioi koko DESIGN.md:tä.

O. Dokumentoi käyttö
Päivitä `README.md` ja `AGENTS.md`:
- miten arc42-dokumentaatio löytyy;
- mikä on ihmisen/agentin entrypoint;
- miten uusi initiative luodaan;
- miten oletus-flow ja repair-loopit toimivat;
- mikä tieto kuuluu Stateen ja mikä dokumentteihin;
- miten `validate:arc42` ajetaan;
- mitkä päätökset vaativat ihmisen;
- miten continuous-learning-schedule muutetaan;
- ettei Ballet mergeä tai pushaa tuloksia automaattisesti.

P. Validointi
Aja vähintään:
- `npm run validate:arc42`
- `npm run test`
- `npm run lint`
- `npm run build`
- `git diff --check`
- `npx @google/design.md lint DESIGN.md`, vain jos DESIGN.md muuttui ja komento on käytettävissä ilman manuaalista kirjautumista

Lisäksi:
- aja AGENTS.md:n platform-boundary-grep laajennettuna uusilla arc42-loop-ID:illä;
- varmista, ettei Git-diffissä ole generated runtime statea tai salaisuuksia;
- varmista, että project resources -katalogi löytää kaikki instructionit ja skillsit ilman duplicate- tai invalid-issueita;
- varmista, että strict-v10-konfiguraatio voidaan lukea nykyisellä repository-koodilla.

Jos jokin validointi ei ole ajettavissa ympäristösyystä, raportoi tarkka komento, virhe ja vaikutus. Älä merkitse sitä läpäistyksi.

Valmis lopputulos
Palauta lopuksi:
1. toteutuksen yhteenveto;
2. muuttuneet tiedostot ryhmiteltynä;
3. uusi Loop-graafi ja repair-matriisi;
4. dokumenttien source-of-truth-sopimus;
5. ihmisportit ja ulkoisten kirjoitusten rajat;
6. ajetut checkit tuloksineen;
7. jäljelle jäävät riskit tai avoimet päätökset;
8. ensimmäinen suositeltu Ballet Root Loop, jolla ratkaisu pilotoidaan.

Älä palauta yksityistä chain-of-thoughtia. Raportoi päätökset, evidenssi, tarkistukset ja avoimet asiat.
```

---

# Vaiheistettu promptti 1: auditointi ja migraatiosuunnitelma

```text
Analysoi nykyinen `isinisalo/ballet`-repository ja laadi toteutuskelpoinen suunnitelma arc42-tyyliseen Ballet-automaatioon. Älä muuta vielä `.ballet/project.json`-tiedostoa, runtime/platform-koodia tai aktiivisia instruction-viitteitä.

Lue vähintään:
- AGENTS.md
- README.md
- .ballet/project.json
- kaikki .ballet/goals ja .ballet/adr
- kaikki .ballet/instructions
- .ballet/outputs/**
- ADR-012, ADR-013, ADR-014 ja ADR-015
- shared/api/workspace-schemas.ts
- shared/api/work-schedule-schema.ts
- backend/documents/projectResourceCatalog.ts
- package.json

Tavoite:
- arc42 Template on kanoninen versionhallittu dokumenttirakenne;
- kuusi arc42-aktiviteettia ovat omat Ballet Work Loopinsa;
- continuous learning on seitsemäs ajastettava Loop;
- runtime State ja repository-dokumentit erotetaan;
- ihmiset ja agentit näkevät saman tavoitteen, statuksen, evidenssin, avoimet kysymykset ja handoffin;
- platform pysyy täysin geneerisenä.

Luo vain:
- `.ballet/arc42/migration/ASSESSMENT.md`
- `.ballet/arc42/migration/CONTENT-MAP.md`
- `.ballet/arc42/migration/DECISIONS.md`
- `.ballet/arc42/migration/IMPLEMENTATION-PLAN.md`

Sisällytä:
1. nykyinen Loop-, node-, flow-, repair-, State-, instruction-, skill- ja profile-inventaario;
2. nykyisten artifactien mapitus arc42-osioihin tai initiative-artifacteihin;
3. duplikaatit ja legacy;
4. puuttuvat päätökset;
5. yhteinen State-ehdotus;
6. tarkka 6+1 Loop -graafi ja node-vastuut;
7. repair-capability-matriisi;
8. instruction/skill-vastuunjako;
9. ihmisportit;
10. deterministiset validoinnit;
11. tiedostokohtainen toteutusjärjestys ja rollback-raja.

Älä keksi puuttuvaa WHAT/WHY-päätöstä. Merkitse se `Open question`-kohteeksi ja kerro, missä Loopissa se ratkaistaan.

Lopuksi aja `git diff --check` ja raportoi vain suunnitelman kannalta olennaiset havainnot.
```

---

# Vaiheistettu promptti 2: arc42-dokumenttimalli ja sisältömigraatio

```text
Toteuta hyväksytyn `.ballet/arc42/migration/IMPLEMENTATION-PLAN.md`-suunnitelman dokumenttiosuus.

Sallitut muutokset:
- ARCHITECTURE.md
- AGENTS.md
- README.md
- .ballet/goals/**
- .ballet/adr/**
- .ballet/arc42/**
- olemassa olevien .ballet/outputs-artifactien hallittu migraatio, supersede tai poisto

Älä muuta vielä:
- .ballet/project.json
- backend/**
- frontend/**
- shared/**
- aktiivisia instruction- tai skill-viitteitä

Toteuta:
1. seuraava vapaa hyväksytty Goal arc42-automaatioon;
2. seuraava vapaa hyväksytty ADR arc42 Template + Ballet Method -päätökseen;
3. ARCHITECTURE.md ihmisen ja agentin yhteiseksi entrypointiksi;
4. 12 arc42-osiota;
5. STATUS.md, TRACEABILITY.md, METHOD-HEALTH.md ja STATE-CONTRACT.md;
6. initiative-template BRIEF/PLAN/EVIDENCE/REVIEW;
7. nykyisen todennettavan sisällön siirto oikeisiin kohtiin;
8. section 9:n ADR-indeksi ilman sisältöduplikaatiota;
9. DESIGN.md-viittaus section 8:ssa ilman kopiointia;
10. sisältökartta vanhoista poluista uusiin.

Dokumenttisäännöt:
- vakaa frontmatter-ID ja status;
- eksplisiittiset Fact/Decision/Assumption/Hypothesis/Finding/Open question -luokat;
- vakaa tunnisteavaruus QG/QS/BB/RS/DV/CC/RISK/OQ;
- mitattavat quality scenarios;
- traceability Goal -> QS -> ADR/Concept -> BB -> Scenario -> Test/Monitor -> Evidence;
- vain relevantti sisältö, ei täytetekstiä;
- ei kahta aktiivista source of truthia;
- puuttuva tieto merkitään, sitä ei keksitä.

Päivitä AGENTS.md niin, että arkkitehtuuria muuttava agentti lukee ensin ARCHITECTURE.md:n ja affected arc42 sections -osiot. Säilytä nykyiset UI/DESIGN.md-säännöt.

Aja:
- git diff --check
- linkkien manuaalinen tai skriptattu tarkistus
- npx @google/design.md lint DESIGN.md vain, jos DESIGN.md muuttui

Raportoi migroidut lähteet, poistetut/superseded duplikaatit ja avoimet päätökset.
```

---

# Vaiheistettu promptti 3: Ballet Loop -graafi ja yhteinen State

```text
Muuta `.ballet/project.json` arc42 Methodia toteuttavaksi strict-v10-konfiguraatioksi. Käytä repositoryn nykyisiä Work Loop-, Work/Validation-, State-, Edge-, LoopEdge- ja Orchestrator-primitiiivejä. Älä muuta platform-koodia.

Lue ennen muutosta:
- `.ballet/arc42/STATE-CONTRACT.md`
- `.ballet/arc42/migration/IMPLEMENTATION-PLAN.md`
- ADR-013, ADR-014 ja ADR-015
- shared/api/workspace-schemas.ts
- shared/api/work-schedule-schema.ts
- nykyinen .ballet/project.json

Luo Loopit:
- arc42-clarify-requirements
- arc42-design-structures
- arc42-design-concepts
- arc42-communicate-document
- arc42-accompany-implementation
- arc42-analyze-evaluate
- arc42-continuous-learning

Säilytä release-validation tukilooppina ja rajaa kaikki ulkoiset kirjoitukset ihmisportin taakse.

Flow:
clarify -> structures -> concepts -> communicate -> implementation -> evaluate -> completed.

Tämä flow ei ole vesiputousrajoite. Lisää capability-pohjaiset repair-edget:
- structures -> clarify, structures
- concepts -> clarify, structures, concepts
- communicate -> clarify, structures, concepts, communicate
- implementation -> clarify, structures, concepts, communicate, implementation
- evaluate -> clarify, structures, concepts, communicate, implementation, evaluate
- learning -> clarify, structures, concepts, communicate, evaluate, learning
- release -> communicate, implementation, evaluate, release

Yhteinen State:
- käytä kaikissa arc42-loopeissa rakenteellisesti samaa initial JSON -arvoa;
- sisällytä methodVersion, initiative, architecture, delivery, release, evaluation ja handoff;
- älä tallenna dokumenttien koko sisältöä Stateen;
- tehtävien pitää pyytää outcome-State patch artifact-poluille, tunnisteille, checkeille ja handoffille.

Node-granulariteetti:
- 2–4 composite Work Loop Nodea per Loop;
- yksi ymmärrettävä tavoite per Node;
- Work tekee muutoksen;
- Validation arvioi evidenssin eikä muuta arvioitavaa sisältöä;
- maxLocalAttempts 2–3 riskin mukaan.

Continuous learning:
- starting Work Node saa olla scheduled;
- oletus: recurring weekly, Monday 09:00, Europe/Helsinki;
- startsOn = seuraava toteutushetken jälkeinen maanantai;
- network-on vain signal collection -nodessa;
- no external writes;
- no material finding -> no documentation churn.

ExecutionProfilet:
- käytä nykyisiä GPT-5.6 Sol/Terra/Luna medium -profiileja;
- network off oletuksena;
- älä lisää unsupported reasoning effortia;
- jos tarvittava profile puuttuu, lisää vain schema- ja runtime-capabilityn tukema profiili.

Koska instructionit ja skillsit toteutetaan seuraavassa vaiheessa, saat luoda niiden lopulliset ID:t nyt vain, jos samalla luot vähintään validit väliaikaiset resurssit tai pidät konfiguraation koko ajan resolvoitavana. Älä jätä rikkinäistä project.json-välitilaa.

Validointi:
- lue project.json repositoryn nykyisellä strict-v10-parserilla;
- varmista kaikki node/edge/loopEdge-viitteet;
- varmista yksi OK-edge per source-node;
- varmista yksi flow edge per source-loop enintään;
- varmista scheduled Work vain startNodessa;
- varmista State-koko ja JSON-validius;
- aja npm run test ja git diff --check.

Älä lisää arc42-ID:itä backend/frontend/shared-koodiin.
```

---

# Vaiheistettu promptti 4: primary instructionit, skillsit ja Orchestrator

```text
Toteuta arc42 Loopien execution composition project-local-resursseina.

Lue:
- .ballet/project.json
- .ballet/arc42/README.md
- .ballet/arc42/STATE-CONTRACT.md
- .ballet/arc42/TRACEABILITY.md
- ADR-012, ADR-013, ADR-014, ADR-015
- backend/documents/projectResourceCatalog.ts
- nykyiset .ballet/instructions/*.md

Luo primary instructionit:
- arc42-requirements-agent
- arc42-structure-agent
- arc42-concepts-agent
- arc42-documentation-agent
- arc42-implementation-agent
- arc42-evaluation-agent
- arc42-learning-agent
- arc42-reviewer
- päivitetty loop-orchestrator

Luo skillsit:
- .agents/skills/arc42/document-maintenance/SKILL.md
- .agents/skills/arc42/traceability/SKILL.md
- .agents/skills/arc42/quality-scenarios/SKILL.md
- .agents/skills/arc42/architecture-views/SKILL.md
- .agents/skills/arc42/decision-records/SKILL.md
- .agents/skills/arc42/conformance-review/SKILL.md
- .agents/skills/arc42/evaluation/SKILL.md
- .agents/skills/arc42/authoritative-research/SKILL.md
- .agents/skills/arc42/method-health/SKILL.md
- .agents/skills/arc42/initiative-handoff/SKILL.md

Pidä prompttikerrokset leanina:
- Task = tämän Noden tavoite.
- Primary instruction = rooli, auktoriteetti, rajat, evidenssi ja pysäytyssäännöt.
- Skill = uudelleenkäytettävä menettely.
- Loop = järjestys ja control flow.
- Älä toista samaa ohjetta kaikissa kerroksissa.

Jokainen Work-instruction:
- lukee current State revisionin ja affected artifactit;
- käyttää vain kanonisia lähteitä;
- erottaa faktan, päätöksen ja oletuksen;
- päivittää vain affected sections;
- palauttaa artifact refs, checks ja rajatun JSON Patchin;
- käyttää needs_inputia, jos tärkeä WHAT/WHY tai hyväksymismitta puuttuu;
- käyttää blockedia ristiriitaisiin authoritative sources -lähteisiin;
- ei palauta hidden chain-of-thoughtia.

`arc42-reviewer`:
- on read-only arvioitavaan sisältöön nähden;
- tarkistaa taskin hyväksymiskriteerit, traceabilityn, lähteet, diff-rajan ja State patchin;
- OK vain evidenssillä;
- FAIL/LOCAL_RETRY mekaaniseen paikalliseen puutteeseen;
- FAIL/ORCHESTRATOR_REPAIR, kun puute kuuluu toiseen arc42-capabilityyn;
- ei korjaa puutetta itse.

Orchestrator capability-map:
- requirements/scope/stakeholder/constraint/quality -> clarify
- building-block/interface/runtime/deployment -> structures
- concept/ADR -> concepts
- documentation/traceability/glossary/handoff -> communicate
- code/test/migration/conformance/acceptance -> implementation
- quality evidence/risk/debt/drift/re-evaluation -> evaluate
- technology/method learning -> learning
- release/deploy/rollback -> release-validation

Ei fallbackia ensimmäiseen Loopia. Epäselvä route -> needs_input.

Valitse jokaiselle project.json-nodelle vain tehtävän kannalta relevantit skillsit. SkillIds ovat set-semanttisiä ja validit path-based ID:t.

Poista vanhat migrated-* instructionit vasta, kun:
- mikään project.json-viite ei osoita niihin;
- resource catalog ei raportoi puuttuvia tai duplicate-ID:itä;
- uusi config läpäisee parserin.

Aja:
- npm run test
- npm run lint
- git diff --check
- project resource catalog -validointi
```

---

# Vaiheistettu promptti 5: deterministinen arc42-lint ja evalit

```text
Lisää projektikohtainen deterministinen validointi arc42-automaatiolle ilman arc42-spesifistä platform-koodia.

Luo:
- `.ballet/tools/validate-arc42.mjs`
- tarvittavat `.ballet/arc42/schemas/*.json`-tiedostot, jos niistä on aidosti hyötyä
- npm-scripti `validate:arc42`

Älä lisää arc42-ID:itä backend/frontend/shared-koodiin.

Validatorin tulee fail-closed tarkistaa:
1. 12 arc42-osiotiedostoa, README, STATUS, TRACEABILITY, METHOD-HEALTH ja STATE-CONTRACT;
2. frontmatterin pakolliset kentät ja uniikit ID:t;
3. filename <-> arc42Section -vastaavuus;
4. paikalliset linkit ja ADR-viitteet;
5. QS-kentät: source, stimulus, environment, affected artifact, expected response, measurable criterion, priority, evidence, status;
6. traceability-tunnisteiden olemassaolo;
7. project.json strict-v10-rakenne;
8. kaikki ExecutionProfile-, instruction- ja skill-viitteet;
9. Loop-, node-, edge- ja loopEdge-viitteet;
10. oletus-flow;
11. vaadittu repair-matriisi;
12. yksi OK-edge per Work Loop Node;
13. sama Arc42MethodStateV1-rakenne kaikissa arc42-loopeissa;
14. network-on-käyttö vain eksplisiittisesti sallitussa learning/release/GitHub-evidenssissä;
15. ettei backend/frontend/shared sisällä uusia project-workflow-ID:itä;
16. ettei vanhoja migrated-* resursseja enää viitata;
17. ettei kahta aktiivista source of truth -polkua ole CONTENT-MAPin mukaan.

Lisää validatoriin selkeät virhekoodit ja polut. Älä tulosta vain booleania.

Lisää vähintään kolme fixture-pohjaista evalia:
- validi nykyinen arc42-projekti;
- puuttuva quality scenario -mitta;
- rikkinäinen instruction/skill-viite tai repair-edge.

Fixturet pidetään `.ballet/tools/fixtures/`-hakemistossa tai muussa project-local-paikassa, eivät platformin yleisissä fixtureissa.

Päivitä README/AGENTS:
- `npm run validate:arc42`
- mitä se tarkistaa
- miten virhe korjataan
- validator ei korvaa ihmisen arkkitehtuuripäätöstä.

Aja:
- npm run validate:arc42
- npm run test
- npm run lint
- npm run build
- git diff --check

Raportoi jokainen komento ja tulos. Älä väitä provider- tai end-to-end-ajoa tehdyksi, jos ajoit vain staattisen validatorin.
```

---

# Vaiheistettu promptti 6: pilotointi ja menetelmän ensimmäinen parannuskierros

```text
Pilotoi uusi arc42 Ballet -menetelmä käyttäen tätä migraatiota ensimmäisenä initiative-esimerkkinä.

Initiative:
- id: arc42-automation-migration
- title: Balletin project-local kehitysautomaation muutos arc42-menetelmäksi
- source refs: käyttäjän vaatimus, uusi Goal, uusi ADR
- scope: arc42 docs, project.json, instructions, skills, validators, README/AGENTS
- non-goals: platformin arc42-kovakoodaus, push/merge/release/deploy

Tavoite:
1. Luo initiative BRIEF/PLAN/EVIDENCE/REVIEW.
2. Käy läpi jokaisen seitsemän Loopin preconditionit, expected artifacts, validation criteria ja repair-capabilityt.
3. Käynnistä oikea Ballet Root Run, jos paikallinen provider, palvelu ja autentikointi ovat valmiit eikä se vaadi ulkoista kirjoitusta.
4. Jos oikea provider-ajo ei ole käytettävissä, tee eksplisiittinen dry-run. Älä kutsu dry-runia onnistuneeksi end-to-end-ajoksi.
5. Kerää:
   - config/parser-evidenssi;
   - resource catalog -evidenssi;
   - document lint;
   - test/lint/build;
   - simuloidut tai todelliset State patchit;
   - vähintään yksi esimerkkirepair: implementation-dokumenttidrift -> communicate;
   - ihmisportit;
   - no-op learning run -käyttäytyminen.
6. Päivitä METHOD-HEALTH baseline:
   - validation failit;
   - local retryt;
   - repairit;
   - avoimet kysymykset;
   - dokumenttidrift;
   - manuaaliset interventiot;
   - token/cost/latency vain, jos ne ovat oikeasti saatavilla.
7. Ehdota enintään kolme menetelmäparannusta. Jokaisella pitää olla:
   - havainto ja evidenssi;
   - baseline;
   - hypoteesi;
   - odotettu mitattava vaikutus;
   - riskit;
   - hyväksyntäraja.
8. Älä muuta loop-topologiaa, permissioneita, network accessia, hyväksyttyä Goalia/ADR:ää tai instruction/skill-käyttäytymistä ilman eksplisiittistä ihmisinputia.
9. Matalariskiset linkki-, indeksi-, lint- ja testikorjaukset saa tehdä ja validoida.

Lopuksi raportoi:
- oliko ajo oikea Root Run vai dry-run;
- mikä toimi;
- mikä epäonnistui;
- mitkä repair-reitit todentuivat;
- mitä ihminen joutui päättämään;
- METHOD-HEALTH baseline;
- hyväksyntää odottavat parannusehdotukset.
```

---

# Operointipromptti: käynnistä uusi kehitysaloite arc42-menetelmällä

```text
Käsittele seuraava muutos Balletin arc42-menetelmällä:

<LIITÄ MUUTOSPYYNTÖ TÄHÄN>

Toimi current checkoutissa.

1. Lue ARCHITECTURE.md, .ballet/arc42/STATUS.md, relevantit arc42 sections, Goalit, ADR:t ja avoimet riskit.
2. Luo vakaa initiative-id ja `.ballet/arc42/initiatives/<id>/BRIEF.md`.
3. Kirjaa:
   - tavoite;
   - source refs;
   - scope;
   - non-goals;
   - stakeholderit;
   - affected arc42 sections;
   - affected QS/ADR/BB/RISK IDs;
   - avoimet kysymykset;
   - hyväksymismitat.
4. Käynnistä `arc42-clarify-requirements` Root Loopina.
5. Älä ohita ihmisporttia, jos WHAT/WHY, quality priority tai acceptance measure puuttuu.
6. Anna Loopien edetä oletus-flowlla. Käytä repair-reittiä aina, kun Validation finding kuuluu toiseen capabilityyn.
7. Älä muuta koodia ennen kuin clarification, structures, concepts ja tarvittava communication-handoff ovat validoitu.
8. Toteutuksessa pidä suunnitelma, diff, testit ja arc42-dokumentit synkronissa.
9. Arvioinnissa vertaa toteumaa mitattaviin quality scenarios -ehtoihin.
10. Päivitä STATUS, TRACEABILITY, initiative EVIDENCE/REVIEW ja METHOD-HEALTH.
11. Älä pushaa, mergeä, releasea tai deployaa ilman erillistä eksplisiittistä pyyntöä.

Palauta:
- initiative-id;
- current Loop/Node;
- tehdyt päätökset;
- avoimet kysymykset;
- repairit;
- artifactit;
- State revision -evidenssi;
- ajetut checkit;
- seuraava ihmiseltä tai agentilta vaadittu toiminto.
```

---

# Operointipromptti: arkkitehtuurikonformanssi toteutuksen jälkeen

```text
Arvioi nykyinen diff ja toteutus Balletin arc42-arkkitehtuuria vasten. Älä muuta toteutusta arvioinnin aikana.

Lue:
- ARCHITECTURE.md
- .ballet/arc42/STATUS.md
- initiative BRIEF/PLAN
- affected arc42 sections
- relevantit QS-, ADR-, BB-, RS-, DV-, CC- ja RISK-kohteet
- git diff
- testitulokset

Tarkista:
1. toteuttaako diff hyväksytyn scopen ja non-goals-rajauksen;
2. vastaavatko lähdekoodirajat Building Block Viewta;
3. vastaavatko runtime-polut Runtime Viewta;
4. vastaako deploy/infrastructure Deployment Viewta;
5. toteutuvatko cross-cutting concepts;
6. noudatetaanko ADR:iä;
7. onko jokaiselle affected quality scenariolle evidenssi;
8. syntyikö parempi toteutusratkaisu, joka pitäisi nostaa arkkitehtuuriksi;
9. syntyikö drift, riski tai technical debt;
10. ovatko dokumentit jäljessä koodista tai koodi dokumenteista.

Palauta Validation-päätös:
- OK vain, jos evidenssi riittää;
- LOCAL_RETRY, jos puute voidaan korjata saman implementation-noden rajassa;
- ORCHESTRATOR_REPAIR capabilityllä:
  - requirements
  - structures
  - concepts
  - communicate
  - evaluate
  tarpeen mukaan.

Kirjaa vain tallennettava rationale ja evidenssi. Älä palauta hidden chain-of-thoughtia.
```

---

# Operointipromptti: menetelmän jatkuva parantaminen

```text
Arvioi Balletin arc42-menetelmän toimivuus viimeisimmän todennettavan evidenssin perusteella.

Lue:
- .ballet/arc42/METHOD-HEALTH.md
- viimeisimmät initiative REVIEW- ja EVIDENCE-dokumentit
- STATUS ja TRACEABILITY
- saatavilla olevat Validation-, retry-, repair- ja check-evidenssit
- nykyinen .ballet/project.json
- relevantit instructions ja skills

Älä muuta vielä loop-topologiaa, permissioneita, network accessia, Goal/ADR-statusia tai instruction/skill-käyttäytymistä.

Tee:
1. päivitä baseline;
2. tunnista toistuvat ongelmat, ei yksittäisiä kosmeettisia poikkeamia;
3. erottele:
   - content problem;
   - architecture problem;
   - implementation problem;
   - validation problem;
   - routing problem;
   - prompt/instruction problem;
   - skill problem;
   - tooling problem;
4. johda enintään kolme parannushypoteesia;
5. määritä jokaiselle odotettu mitattava vaikutus, riski, rollback ja eval;
6. luokittele muutos:
   - auto-applicable low risk;
   - human approval required;
   - rejected/no evidence;
7. tee automaattisesti vain semantiikkaa muuttamattomat linkki-, indeksi-, lint- ja testikorjaukset;
8. pyydä ihmisinput ennen muuta muutosta;
9. reititä hyväksytty muutos oikeaan arc42-Loopiin, älä korjaa kaikkea tässä arviointitehtävässä.

Päivitä METHOD-HEALTH ja luo tarvittaessa improvement-ID.

Raportoi:
- baseline;
- löydökset evidensseineen;
- hyväksyttävät parannukset;
- hyväksyntää vaativat parannukset;
- hylätyt ideat ja syy;
- seuraava eval-ajankohta tai trigger.
```

---

# Migraation hyväksymiskriteerit

Migraatio on valmis vasta, kun:

- `ARCHITECTURE.md` ohjaa sekä ihmisen että agentin oikeaan tietoon.
- Kaikki 12 arc42-osiota ovat olemassa ja sisältävät joko todennettavaa tietoa tai eksplisiittisen puutteen.
- Goalit ja ADR:t säilyvät kanonisina, eikä sisältöä ole kopioitu ristiriitaisesti.
- `.ballet/project.json` on validi strict v10.
- Kuusi arc42-aktiviteettia ja continuous learning näkyvät erillisinä Loopeina.
- Oletus-flow ja repair-matriisi ovat eksplisiittiset.
- Kaikki arc42-loopit käyttävät yhteensopivaa State-sopimusta.
- Work ja Validation on erotettu.
- Validation ei korjaa arvioitavaa työtä itse.
- Orchestrator reitittää capabilityn perusteella eikä käytä fallback-first-käyttäytymistä.
- Human gate suojaa WHAT/WHY-, ADR-, acceptance-, permission- ja external-write-päätökset.
- Network access on vähimmän oikeuden mukainen.
- Continuous learning tuottaa evidenssiin perustuvia havaintoja eikä dokumenttichurnia.
- METHOD-HEALTH tukee mitattavaa menetelmän parantamista.
- Vanhat aktiiviset `migrated-*`-resurssit ja duplikaattiset source-of-truth-artifactit on poistettu.
- `npm run validate:arc42`, `npm run test`, `npm run lint`, `npm run build` ja `git diff --check` läpäisevät tai ympäristöeste on dokumentoitu täsmällisesti.
- Backend-, frontend- ja shared-platform-koodiin ei ole kovakoodattu arc42-workflow'ta.
- Mitään ei ole pushattu, mergetty, julkaistu tai deployattu ilman eksplisiittistä lupaa.
