# Agenttiohjeet

Nämä ohjeet koskevat koko repositoriota. Aloita aina `ARCHITECTURE.md`-tiedostosta ja lue kohdehakemistojen omat `AGENTS.md`-tiedostot ennen muutoksia.

## Kanoninen domain

- Balletin aktiivinen domain on `Environment -> State -> Action` päätöksen `adr-034` mukaisesti.
- Project Config noudattaa [aktiivista versiomatriisia](ARCHITECTURE.md#active-version-matrix). Environmentin Stateilla on positiivinen, yksikäsitteinen ja nouseva `order`; Staten Actioneilla vastaava `priority`.
- Seuraavaa Statea ei dispatchata ennen kuin edellisen kaikki Actionit ovat runtime-statuksessa `done`.
- Runtime status on totuus. `done` ja `blocked` ovat siitä johdettuja eivätkä project configiin tallennettavia lippuja.
- Validation on controller: precheck palauttaa vain `done | delegate | blocked`, Work on alisteinen toteutusrooli ja postwork palauttaa vain `done | retry | blocked`.
- `maxRetries` tarkoittaa ensimmäisen Work-yrityksen jälkeisiä lisäyrityksiä. Exhaustion tekee Actionista ja siihen liittyvästä Feedback-entrystä atomisesti blocked-tilaiset.
- Standalone State- tai Action-ajoja ei ole. Environment Run omistaa immutable Root Snapshotin ja koko etenemisportin.

## Ihmisen päätösvalta ja immutable evidenssi

- Use Caset ja niiden hyväksynnät ovat project-local evidenssiä. Run ei portita, snapshottaa eikä injektoi niitä; valitun Actionin instruction tai Skill ohjaa agentin lukemaan tarvittavat `.ballet/**`-dokumentit.
- Critic proposal ei ole Feedbackiä ennen eksplisiittistä human approval -komentoa.
- Refinement proposal on read-only ja sidotaan exact change-, impact- ja preimage-hasheihin. Vasta human approval saa käynnistää sallituille instruction- ja Skill-poluille rajatun applyn.
- Hyväksytty refinement tuottaa yhden managed-worktree-commitin ja uuden immutable continuation-runin. Parent runia ei muuteta.
- Merge, push, release, deploy, rollback ja muu ulkoinen kirjoitus vaativat täsmällisen ihmisvaltuutuksen.

## Strict cut

- Aktiiviset versiot: [ARCHITECTURE.md:n versiomatriisi](ARCHITECTURE.md#active-version-matrix). Älä ylläpidä rinnakkaista versioluetteloa. Action execution bindingia ei ole.
- Vanhasta datasta ei tehdä migraatiota, readeria, route-aliasta tai dual-write-polkuja. Epäyhteensopiva machine-local SQLite arkistoidaan tai poistetaan ennen käynnistystä.
- Canonical URLit ovat `/automation/loops`, `/agents`, `/skills`, `/runtimes`, `/project/goals`, `/project/adrs`, `/project/constraints`, `/project/use-cases`, `/project/instructions`, `/run`, `/feedback`, `/reviews/critic` ja `/reviews/refinement`; Run Evidence näkyy omistavan Runin sisällä. API on `/api/*`.

## Platformin ja projektin raja

- Platform-koodi toteuttaa vain yleiset Environment-, State-, Action-, Validation/Work-, Feedback-, Critic-, Refinement-, provider-, worktree-, queue/event-, SQLite-, HTTP-security- ja SSE-primitivet.
- Goals, ADR:t, Constraints, Use Caset, Environment-määritys, instructionit, Skillit, release- ja arc42-menettelyt ovat project-local dataa `.ballet/**`- ja `.agents/skills/**`-poluissa.
- Älä kovakoodaa projektikohtaisia workflow-tunnisteita `backend/`, `frontend/` tai `shared/`-koodiin.

## UI ja design

- Lue `DESIGN.md` ennen UI-, komponentti-, layout- tai tyylimuutoksia.
- Käytä sen frontmatter-tokeneita ja Balletin tiheää cyber-industrial-kieltä. Älä lisää ad hoc -värejä, gradientteja, paletteja, shape-kieltä tai typografiaa päivittämättä design-sopimusta.
- UI näyttää kanonisia runtime-faktoja. Se ei päätä etenemisestä, hyväksynnästä, retrystä tai refinementin sisällöstä clientissä.
- Todennettava responsive-raja on 1440x900 ja 390x844; tue keyboardia, focus-tiloja, reduced motionia ja väristä riippumattomia statuslabelleja.

## Validointi

- Aja `npm run validate:arc42`, kun muutos koskee arkkitehtuuria, project configia, instructioneita tai Skillejä.
- Aja `npm run validate:cutover` strict removal -muutoksissa.
- Aja `npm run test`, kun muutos koskee domainia, APIa, persistenssiä, runtimea tai UI-käyttäytymistä.
- Aja `npm run lint` koodin tai UI:n jälkeen ja `npm run build` TypeScript-, frontend-, CSS- tai bundlausmuutosten jälkeen.
- Aja `npx @google/design.md lint DESIGN.md` design-muutoksissa ja aina `git diff --check`.
- Lopullisessa repository-validoinnissa aja `make latest` ja varmista, että `ballet` käynnistyy. Vanhoja tietokantoja ei tarvitse säilyttää.

## Työskentely

- Säilytä käyttäjän ennestään tekemät muutokset. Älä tee riippumattomia refaktorointeja.
- Noudata KISS- ja YAGNI-periaatteita: käytä olemassa olevia ratkaisuja ja abstraktioita ennen uuden rakentamista, äläkä lisää pyytämätöntä rakennetta, variaatiota tai tulevaisuusvaraa.
- Pidä ratkaisu yksinkertaisena ja poista korvatuksi tullut aktiivinen legacy-koodi.
- Pysähdy `needs_input`-tilaan vain, kun WHAT/WHY, laatumitta, merkittävä ADR tai uusi external-write-valtuutus aidosti vaatii ihmistä.
