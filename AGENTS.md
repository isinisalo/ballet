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

## Validointi

- Aja `npm run validate:arc42`, kun muutos vaikuttaa `.ballet/arc42/**`, `.ballet/project.json`, `.ballet/instructions/**`, `.agents/skills/**` tai arkkitehtuurin source-of-truth-sopimukseen.
- Aja `npm run test`, kun muutos vaikuttaa domain-malliin, API-sopimuksiin, persistenssiin, suorituspolkuun tai käyttöliittymän käyttäytymiseen.
- Aja `npm run lint` käyttöliittymä- tai tyylimuutosten jälkeen.
- Aja `npm run build`, kun muutos vaikuttaa frontend-koodiin, komponenttien rajapintoihin, CSS:ään, Tailwind-luokkiin tai bundlaukseen.
- Aja `npx @google/design.md lint DESIGN.md`, kun muutat `DESIGN.md`-tiedostoa ja komento on saatavilla ilman manuaalista tunnistautumista.
- Aja `git diff --check` ennen muutoksen luovuttamista.
- Raportoi selvästi, jos validointikomentoa ei voi ajaa tai se epäonnistuu ympäristösyyn vuoksi.

## Platformin ja projektin raja

- Balletin platform-koodi saa toteuttaa vain yleisiä primitivejä: Loop, WorkLoopNode, WorkNode, ValidationNode, State, Edge, LoopEdge, RepairRequest, LoopOrchestrator, ExecutionProfile, instruction- ja skill-resurssien ratkaisu, Root Run snapshot, provider-suoritus ja runtime state.
- Roadmap-, milestone-, issue-, acceptance-, staging-, release-, deploy- ja arc42-menettelyt kuuluvat project-local dataan tiedostoissa `.ballet/project.json`, `.ballet/instructions/**`, `.agents/skills/**` ja `.ballet/arc42/**`.
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
- Oletus-flow on clarify → structures → concepts → communicate → implementation → evaluate. Se ei ole vesiputous: Validation pyytää capability-korjauksen, Orchestrator valitsee vain allowlistatun Loopin ja runtime palauttaa samaan Validation Nodeen.
- State sisältää vain rajatun `Arc42MethodStateV1`-nykytilan ja vakaat viitteet. Markdown sisältää pitkäikäisen projektitotuuden. Älä kopioi dokumentteja, diffejä tai runtime-lokeja Stateen.
- Pysähdy `needs_input`-tilaan, kun WHAT/WHY, laatutavoitteen prioriteetti/mitta, merkittävä ADR tai usean yhtä hyvän repair-targetin valinta vaatii ihmistä.
- Release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat täsmällisen ihmisvaltuutuksen. `release-validation` ei kuulu oletus-flow'hun, eikä Ballet mergeä tai pushaa tuloksia automaattisesti.
- Continuous-learning-schedule on `.ballet/project.json`-tiedoston `learning-authoritative-research` Work Nodessa. Schedule-, topology-, permission-, network-, instruction- ja skill-käyttäytymismuutokset ovat aina katselmoitavia ja hyväksyttäviä ennen soveltamista.
- Päivitä `STATUS.md`, `TRACEABILITY.md`, initiative-handoff ja `METHOD-HEALTH.md` vain uuden evidenssin tai päätöksen perusteella; älä tee semanttista dokumenttichurnia.

## Tärkeää

- Tuote ei ole vielä tuotannossa, joten älä jätä legacy koodia, kun teet uusia ominaisuuksia tai muutat jo olemassa olevia ominaisuuksia. En halua, että koodiin jää painolastia.
- Jos näet legacy koodia, pyri siivoamaan ne pois.
- Pyri aina löytämään yksinkertainen ratkaisu, kunnioittaen clean code and clean architecture periaatteita.
