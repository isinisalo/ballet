# Agenttiohjeet

Nämä ohjeet koskevat koko repositoriota. Noudata niitä aina, kun muutat, suunnittelet tai arvioit projektin käyttöliittymää, komponentteja, layoutia, visuaalista tyyliä tai frontend-tyylitoteutusta.

## DESIGN.md

- Lue projektin juuressa oleva `DESIGN.md` ennen UI-, tyyli-, komponentti- tai layout-muutoksia.
- Käsittele `DESIGN.md`-tiedoston frontmatter-tokenit ensisijaisena lähteenä väreille, typografialle, spacingille ja pyöristyksille.
- Toteuta uudet UI-ratkaisut Ballet-komentokeskuksen cyber-industrial-tyylin mukaisesti.
- Käytä olemassa olevia React-, Vite-, Tailwind- ja shadcn-käytäntöjä ennen uuden komponentti- tai tyylirakenteen lisäämistä.
- Älä lisää ad hoc -värejä, koristeellisia gradientteja, irrallisia paletteja, uutta shape-kieltä tai uutta typografista linjaa ilman, että päivität samalla `DESIGN.md`-tiedoston.
- Päivitä `DESIGN.md`, kun tarkoituksellinen design-muutos vaikuttaa väreihin, typografiaan, spacingiin, radius-sääntöihin, komponenttikäytäntöihin tai käyttöliittymän visuaaliseen periaatteeseen.
- Jos nykyinen toteutus poikkeaa `DESIGN.md`-ohjeesta, älä tee laajaa uudelleenmuotoilua sivutehtävänä. Kohdista muutos pyydettyyn osaan ja vältä riippumattomia refaktorointeja.

## Kolmitasoisen Graph Node Engineeringin visuaalinen vakaus

- Graph Engineering-, Graph Node- ja Job Node -canvasien avaruusteema on suojattu visuaalinen sopimus. Säilytä tumma 24 px tekninen ruudukko, planeettamaiset artworkit ja niiden konfiguroidut koot/tyylit, reasoning glow't, amber-ID-labelit, ohuet 1.5 px mintunväriset spoket/yhteydet, kirkkaat yhteyspisteet sekä reduced-motion-tuki.
- Graph Engineering näyttää vain globaalin Luna Orchestratorin, valinnaisen Sol Repair Noden, GraphNode-planeetat ja kiinteät PASS/FAIL-connection pointit. Graph Node näyttää vain valitun Graph Noden Luna Orchestratorin, valinnaisen Sol Repair Noden, sen JobNode-planeetat ja terminaalit. Job Node näyttää vain aggregate Jobin Work- ja Validation-planeetat, mintun validate-yhteyden, amber-retryn ja PASS/FAIL-terminalit. Foreign-scope-nodeja ei näytetä.
- Graph- ja Graph Node -spoket kuvaavat authoroitujen candidate-sääntöjen sallittua membershipiä, eivät child-to-child Edgejä tai runtime-tuloksia. Work→Validation ja retry ovat ainoat kiinteät Job Node -canvasin sisäiset yhteydet.
- Käytä deterministic multi-ring -layoutia, pan/zoomia ja kiinteää minimitekstikokoa. Hyväksymisfixturet ovat 1/5/40 GraphNodea ja 1/17/64 JobNodea; tavoite on nolla node-overlapia, nolla sivutason vaakaylivuotoa ja nolla leikattua ydintoimintoa desktop- ja narrow-viewporteissa.
- Domain-, runtime-, schema-, reititys- tai terminologiamuutos ei oikeuta vaihtamaan avaruusteemaa tai lisäämään uutta shape-/palette-kieltä. Jos pakollinen semantiikka, saavutettavuus tai todistettu käytettävyysvika vaatii muutoksen, kirjaa perustelu, päivitä tarvittaessa `DESIGN.md` ja liitä desktop/narrow ennen/jälkeen-selain-QA.

## Validointi

- Aja `npm run validate:arc42`, kun muutos vaikuttaa `.ballet/arc42/**`, `.ballet/project.json`, `.ballet/instructions/**`, `.agents/skills/**` tai arkkitehtuurin source-of-truth-sopimukseen.
- Aja `npm run test`, kun muutos vaikuttaa domain-malliin, API-sopimuksiin, persistenssiin, suorituspolkuun tai käyttöliittymän käyttäytymiseen.
- Aja `npm run lint` käyttöliittymä- tai tyylimuutosten jälkeen.
- Aja `npm run build`, kun muutos vaikuttaa frontend-koodiin, komponenttien rajapintoihin, CSS:ään, Tailwind-luokkiin tai bundlaukseen.
- Aja `npx @google/design.md lint DESIGN.md`, kun muutat `DESIGN.md`-tiedostoa ja komento on saatavilla ilman manuaalista tunnistautumista.
- Aja `git diff --check` ennen muutoksen luovuttamista.
- Aja Graph Node Module -sopimuksen package-, install/export-, API-, UI- ja release smoke -testit, kun muutos vaikuttaa `.ballet/graph-node-library/**`, `.ballet/graph-node-modules/**` tai niiden materialisointiin.
- Raportoi selvästi, jos validointikomentoa ei voi ajaa tai se epäonnistuu ympäristösyyn vuoksi.

## Platformin ja projektin raja

- Balletin platform-koodi saa toteuttaa vain yleisiä primitivejä: Graph, GraphNode, aggregate JobNode, WorkNode, ValidationNode, scoped Orchestrator, scoped RepairNode, candidate-sääntö, State, RepairRequest/frame, ExecutionProfile, instruction- ja skill-resurssien ratkaisu, Graph/GraphNode Root Run snapshot, provider-suoritus, tracker-adapter/outbox ja runtime state.
- Roadmap-, milestone-, issue-, acceptance-, staging-, release-, deploy- ja arc42-menettelyt kuuluvat project-local dataan tiedostoissa `.ballet/project.json`, `.ballet/releases/**`, `.tickets/**`, `.ballet/instructions/**`, `.agents/skills/**` ja `.ballet/arc42/**`.
- Graph Node Module package-, katalogi-, install-, export- ja provenance-primitiveet ovat geneerisiä platform-ominaisuuksia. Moduulien nimet, capabilityt, instructionit, skillsit, candidate-suositukset ja external-write-metadata ovat `.ballet/graph-node-library/**`-dataa; runtime lukee vain materialisoitua project-local dataa. Peer-GraphNode-targetit kuuluvat project-global candidate-sääntöihin, eivät pakettiin.
- Älä kovakoodaa project-workflow'ta `backend/`, `frontend/` tai `shared/`-koodiin tai Balletin pakolliseen System instructioniin.
- Tarkista execution- tai orchestration-muutoksen jälkeen, ettei platform-koodiin tullut project-workflow-kohtaisia tunnisteita:

  ```bash
  grep -R -n -E \
    'blueprint-design|milestone-planning|milestone-delivery|release-validation|arc42-clarify-requirements|arc42-design-structures|arc42-design-concepts|arc42-communicate-document|arc42-accompany-implementation|arc42-analyze-evaluate|arc42-continuous-learning|\.ballet/arc42/|ROADMAP\.md|IMPLEMENTATION-PLAN\.md|ACCEPTANCE\.md' \
    backend frontend shared || true
  ```

## arc42-arkkitehtuuri ja jatkuva menetelmä

- Aloita aina `ARCHITECTURE.md`-tiedostosta. `.ballet/arc42/` on kanoninen 12-osioinen arkkitehtuurirakenne, `.ballet/goals/` omistaa WHAT/WHY-päätökset, `.ballet/adr/` arkkitehtuuripäätökset ja `DESIGN.md` UI-design-järjestelmän.
- Luo uusi aloite kopioimalla `.ballet/arc42/initiatives/TEMPLATE/` polkuun `.ballet/arc42/initiatives/<initiative-id>/`, anna kaikille tiedostoille uniikit vakaat ID:t ja aloita `draft`-statuksella.
- Repositoryn oletusgraphissa ovat project-local GraphNodet DESIGN, PLAN, BUILD, DEPLOY ja VERIFY. Graph- ja Graph Node -orchestratorit valitsevat kaikki tasojen väliset targetit immutable snapshotin strict candidate-enumista; Work→Validation ja bounded retry ovat Job Noden kiinteitä invariantteja. Repair on rajattu call/return samaan Validation Nodeen.
- State sisältää vain rajatun `GraphEngineeringStateV1`-nykytilan, runtime-reititysfaktat ja vakaat viitteet. Markdown omistaa pitkäikäisen projektitotuuden ja tracker implementation-issuet. Älä kopioi dokumentteja, ticket-runkoja, diffejä tai runtime-lokeja Stateen.
- Pysähdy `needs_input`-tilaan, kun WHAT/WHY, laatutavoitteen prioriteetti/mitta, merkittävä ADR tai usean yhtä hyvän repair-targetin valinta vaatii ihmistä.
- Release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat täsmällisen ihmisvaltuutuksen. DEPLOY pysähtyy ilman valtuutusta `needs_input`-tilaan, eikä Ballet mergeä tai pushaa tuloksia automaattisesti.
- Schedulea ja standalone JobNode Runia ei ole aktiivisessa domainissa. Topology-, candidate routing-, repair-, tracker-, permission-, network-, instruction- ja skill-käyttäytymismuutokset ovat aina katselmoitavia ja hyväksyttäviä ennen soveltamista.
- Päivitä `STATUS.md`, `TRACEABILITY.md`, initiative-handoff ja `METHOD-HEALTH.md` vain uuden evidenssin tai päätöksen perusteella; älä tee semanttista dokumenttichurnia.

## Tärkeää

- Tuote ei ole vielä tuotannossa, joten älä jätä legacy koodia, kun teet uusia ominaisuuksia tai muutat jo olemassa olevia ominaisuuksia. En halua, että koodiin jää painolastia.
- Jos näet legacy koodia, pyri siivoamaan ne pois.
- Pyri aina löytämään yksinkertainen ratkaisu, kunnioittaen clean code and clean architecture periaatteita.
