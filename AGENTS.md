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

- Graph Engineering- ja Graph Node -canvasien avaruusteema on suojattu visuaalinen sopimus. Säilytä tumma 24 px tekninen ruudukko, planeettamaiset artworkit ja niiden konfiguroidut koot/tyylit, reasoning glow't, amber-ID-labelit, ohuet 1.5 px mintunväriset spoket, kirkkaat yhteyspisteet sekä reduced-motion-tuki.
- Graph Engineering käyttää capability-first GraphNode-kortteja ja Graph-tason 5×5/N×N Reward Decision Model -työtilaa. Graph Node näyttää valitun GraphNoden Action Node -kortit sekä oman local N×N Decision Model -välilehden. Matriisit ovat node-ID-omisteisia semantic CSS-grid -projektioita; terminalit eivät lisää rivejä, acceptance pysyy erillisenä gate-railina eikä Orchestrator-, Repair- tai runtime-tulosnäkymiä lisätä authoring-projektioksi.
- Action Node -canvasin suojattu sopimus on ADR-025/027:n tumma industrial flow: aina näkyvä Start, valittavat Work ja Validation, Pass?/Retry?-junctionit, Retry count -ghost sekä kiinteät Continue ja Escalate. Normaali flow käyttää 1.5 px mint-yhteyttä, retry amber-dashed-yhteyttä ja exhausted FAIL error-semanticsia. Work/Validationin konfiguroitu artwork/size näkyy kortin emblemissä/koossa; rakenteellisesti keskeneräinen määrittely näkyy dashed ghost -korttina.
- Action-flow on authoring-projektio, ei runtime-ohjain. Continue/Escalate eivät ole painikkeita eikä canvas tallenna next-targetia. Runtime käyttää Work→Validationia ja bounded `retry | escalate` -semantiikkaa; Continue/Escalate palauttavat typed outcomen local policylle, local terminal emittoi GraphNode-outcomen ja Graph Reward-MDP valitsee GraphNode-optionin.
- Käytä Graph/Graph Node -canvaksilla deterministic multi-ring-layoutia, Decision Modeleissa sticky/scrollattavaa ja yli 20 rivillä virtualisoitua semantic CSS-gridiä sekä Action-tasolla deterministic wide/narrow-flow-layoutia. Hyväksymisfixturet ovat 1/5/40 GraphNodea ja 1/17/64 ActionNodea; tavoite on nolla node-overlapia, nolla sivutason vaakaylivuotoa ja nolla leikattua ydintoimintoa desktop- ja narrow-viewporteissa.
- Domain-, runtime-, schema-, reititys- tai terminologiamuutos ei itsessään oikeuta canvas-kielen vaihtoon. Uusi tarkoituksellinen visualisointipäätös vaatii supersedoivan ADR:n, `DESIGN.md`-päivityksen ja desktop/narrow ennen/jälkeen-selain-QA:n.

## Määräaikainen Environment transition

- `goal-022`, `adr-034` ja `.ballet/arc42/initiatives/environment-state-action-orchestration/TARGET-CONTRACT.md` hyväksyvät Environment → State → Action- ja Validation-led-targetin. Nykyinen strict-v19 Graph/Reward-MDP-toteutus ja yllä oleva suojattu UI pysyvät canonical baseline -pintana phase 09:n atomiseen cutoveriin asti.
- Phases 02–08 saavat toteuttaa targetin vain eristetyssä vNext-namespace/hakemistossa sekä väliaikaisilla `/api/vnext`- ja `/vnext`-routeilla. VNext ei saa lukea eikä kirjoittaa v19-dataa, eikä v19 saa lukea tai kirjoittaa vNext-dataa. Dual-write, compatibility reader, migraatio ja route alias ovat kiellettyjä.
- Väliaikainen vNext-koodi ei ole compatibility layer. Jokaisella väliaikaisella tyypillä, taululla, reitillä, testillä ja UI-pinnalla on `.ballet/arc42/initiatives/environment-state-action-orchestration/CUTOVER-MANIFEST.md`:n phase 09 removal/canonicalization gate.
- Phase 09 poistaa vanhan active Graph/GraphNode/ActionNode-, Reward-MDP-, policy-, acceptance-ledger- ja Graph Node Module -pinnan sekä canonicalisoi vNextin yhdessä leikkauksessa. Lopullisessa branchissa ei saa olla vNext-prefixiä tai vanhaa aktiivipolkua.
- Phases 07–08:n vNext-UI saa käyttää `DESIGN.md`:n Target design appendix -authoritya. Se säilyttää nykyiset dark tokenit, typografian, spacingin, radiukset, densityn ja saavutettavuusperiaatteet, mutta ei muuta protected v19 Graph-canvaksia sivutehtävänä.

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

- Balletin platform-koodi saa toteuttaa vain yleisiä primitivejä: Graph, GraphNode, aggregate ActionNode, WorkNode, ValidationNode, scopekohtainen Reward-MDP, acceptance-ledger, immutable authorization-snapshot, compiled policy, State, ExecutionProfile, instruction- ja skill-resurssien ratkaisu, Graph/GraphNode Root Run snapshot, provider-suoritus, tracker-adapter/outbox ja runtime state.
- Roadmap-, milestone-, issue-, acceptance-, staging-, release-, deploy- ja arc42-menettelyt kuuluvat project-local dataan tiedostoissa `.ballet/project.json`, `.ballet/releases/**`, `.tickets/**`, `.ballet/instructions/**`, `.agents/skills/**` ja `.ballet/arc42/**`.
- Graph Node Module package-, katalogi-, install-, export- ja provenance-primitiveet ovat geneerisiä platform-ominaisuuksia. V7-paketti kantaa GraphNoden koko local policyn, rewardin ja initial staten; runtime lukee vain materialisoitua project-local dataa. Peer-GraphNode-targetit, global probabilityt/rewardit ja acceptance-binding/effectit kuuluvat project-global dataan, eivät pakettiin.
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
- Repositoryn oletusgraphissa ovat project-local GraphNodet DESIGN, PLAN, BUILD, DEPLOY ja VERIFY. Graph-tason Reward-MDP valitsee immutable compiled policysta GraphNode-optionin; GraphNoden local Reward-MDP valitsee ActionNoden. Terminalit ovat branch targetteja eivätkä nodeja tai matriisirivejä. Work→Validation ja bounded `retry | escalate` ovat Action Noden kiinteitä invariantteja.
- State sisältää vain rajatun `GraphEngineeringStateV1`-nykytilan, runtime-faktat ja vakaat viitteet. Authorization ja acceptance-ledger ovat erillisiä immutable snapshoteja. Markdown omistaa pitkäikäisen projektitotuuden ja tracker implementation-issuet. Älä kopioi dokumentteja, ticket-runkoja, diffejä tai runtime-lokeja Stateen.
- Pysähdy `needs_input`-tilaan, kun WHAT/WHY, laatutavoitteen prioriteetti/mitta, merkittävä ADR tai täsmällinen external-write-valtuutus vaatii ihmistä.
- Release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat täsmällisen ihmisvaltuutuksen. DEPLOY pysähtyy ilman valtuutusta `needs_input`-tilaan, eikä Ballet mergeä tai pushaa tuloksia automaattisesti.
- Schedulea ja standalone ActionNode Runia ei ole aktiivisessa domainissa. Topology-, Reward-MDP-, acceptance-, authorization-, tracker-, permission-, network-, instruction- ja skill-käyttäytymismuutokset ovat aina katselmoitavia ja hyväksyttäviä ennen soveltamista.
- Päivitä `STATUS.md`, `TRACEABILITY.md`, initiative-handoff ja `METHOD-HEALTH.md` vain uuden evidenssin tai päätöksen perusteella; älä tee semanttista dokumenttichurnia.

## Tärkeää

- Tuote ei ole vielä tuotannossa, joten älä jätä legacy koodia, kun teet uusia ominaisuuksia tai muutat jo olemassa olevia ominaisuuksia. En halua, että koodiin jää painolastia.
- Jos näet legacy koodia, pyri siivoamaan ne pois.
- Pyri aina löytämään yksinkertainen ratkaisu, kunnioittaen clean code and clean architecture periaatteita.
- Varmista lopuksi, että `make latest` menee onnituneesti läpi.
- Varmista lopuksi, että `ballet` käynnistyy onnistuneesti. (vanhoja tietokantoja ei tarvitse säilyttää.)
