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

- Aja `npm run test`, kun muutos vaikuttaa domain-malliin, API-sopimuksiin, persistenssiin, suorituspolkuun tai käyttöliittymän käyttäytymiseen.
- Aja `npm run lint` käyttöliittymä- tai tyylimuutosten jälkeen.
- Aja `npm run build`, kun muutos vaikuttaa frontend-koodiin, komponenttien rajapintoihin, CSS:ään, Tailwind-luokkiin tai bundlaukseen.
- Aja `npx @google/design.md lint DESIGN.md`, kun muutat `DESIGN.md`-tiedostoa ja komento on saatavilla ilman manuaalista tunnistautumista.
- Aja `git diff --check` ennen muutoksen luovuttamista.
- Raportoi selvästi, jos validointikomentoa ei voi ajaa tai se epäonnistuu ympäristösyyn vuoksi.

## Platformin ja projektin raja

- Balletin platform-koodi saa toteuttaa vain yleisiä primitivejä: Loop, Step, Approved/Rejected Transition, Human Step, Scheduled Step, ExecutionProfile, instruction- ja skill-resurssien ratkaisu, Root Run snapshot, provider-suoritus ja runtime state.
- Roadmap-, milestone-, issue-, acceptance-, staging-, release- ja deploy-menettelyt kuuluvat project-local dataan tiedostoissa `.ballet/project.json`, `.ballet/instructions/**` ja `.agents/skills/**`.
- Älä kovakoodaa project-workflow'ta `backend/`, `frontend/` tai `shared/`-koodiin tai Balletin pakolliseen System instructioniin.
- Tarkista execution- tai orchestration-muutoksen jälkeen, ettei platform-koodiin tullut project-workflow-kohtaisia tunnisteita:

  ```bash
  grep -R -n -E \
    'blueprint-design|milestone-planning|milestone-delivery|release-validation|ROADMAP\.md|IMPLEMENTATION-PLAN\.md|ACCEPTANCE\.md' \
    backend frontend shared || true
  ```

## Tärkeää

- Tuote ei ole vielä tuotannossa, joten älä jätä legacy koodia, kun teet uusia ominaisuuksia tai muutat jo olemassa olevia ominaisuuksia. En halua, että koodiin jää painolastia.
- Jos näet legacy koodia, pyri siivoamaan ne pois.
- Pyri aina löytämään yksinkertainen ratkaisu, kunnioittaen clean code and clean architecture periaatteita.
