---
version: 1
notes:
  - id: 022ca7ef-9193-48bf-a076-89591fad5ff4
    kind: command
    title: Palauta palvelut katkoksen jälkeen
    details: Queued-työ säilyy SQLiteen tallennettuna; jo claimattua tehtävää ei ajeta uudelleen.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 022f9769-b5c0-4221-bebf-4cbd9ab4615c
    kind: command
    title: Sovella hyväksytty muutos
    details: Palvelin tarkistaa preimagen ja base commitin ja soveltaa sallitun muutoksen managed worktreehen.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 0a36fef4-cef8-4175-b656-c5ec384faf21
    kind: event
    title: Tehtävä päättyi runtime_lost-virheeseen
    details: Lease vanheni daemonin menetyksen jälkeen; tehtävää ei requeueata.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 0b4e5387-4386-4ca3-9b82-327a75d5cdd6
    kind: aggregate
    title: User Story
    details: Tarina omistaa semanttisen sisältönsä ja hyväksyntärevisionsa. Tallennus ei hyväksy; merkityksen muutos mitätöi hyväksynnän.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: 0c385d44-c5ae-4e7b-a136-5706c1683292
    kind: event
    title: ADR tallennettiin
    details: Voimassa oleva päätös ja soveltamisala tallennetaan kolmirivisenä recordina.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: 0c7f7560-c960-4673-8197-ce97a4676099
    kind: command
    title: Käynnistä Environment Run
    details: Agenttien määritelmät, hashit ja Skill-koostumus sidotaan samaan muuttumattomaan lähtötilaan.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 0d322dfa-61c9-4541-bf34-bd958eadbf1d
    kind: command
    title: Varaa jonotettu tehtävä
    details: Checkout-token suojaa sisäistä rajaa; palvelin luo tehtävän yksikäsitteisen leasen.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 0f672016-246a-4d80-b899-17b6073c0830
    kind: value
    title: Paikallinen ja kestävä suoritus
    details: Prosessin tavoiteltu hyöty. Palvelin omistaa jonon ja leasen; daemon omistaa Codex-prosessin. Claimattua tehtävää ei palauteta jonoon eikä tulosta hyväksytä väärällä leasella.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 0fd41b9e-82f5-49e7-bb1a-ce41f76a2ff7
    kind: aggregate
    title: Critic-ehdotus ja päätös
    details: Critic on read-only. Vain ihmisen hyväksymä exact revision/hash saa luoda yhden kausaalisesti sidotun Feedback-entryn.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 11ca25a0-a066-4511-925e-b0c8bae79e66
    kind: command
    title: Laadi rajattu Refinement-ehdotus
    details: Vain lukeva agentti nimeää base commitin, sallitut muutokset, hashit, diffin ja vaikutusjoukon.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 120df932-7ea8-499b-ba30-d36cbe2397fc
    kind: event
    title: Tehtävä claimattiin
    details: Checkout-token suojaa sisäistä rajaa; palvelin luo tehtävän yksikäsitteisen leasen.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 12f2a569-a086-4054-ab25-e4bd5a7b10de
    kind: command
    title: Tarkista resurssien valmius
    details: TOMLit, Skillit ja Codexin model/reasoning-valmius tarkistetaan ennen dispatchia.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 146517d0-fd1f-4499-a7a2-291495196292
    kind: event
    title: Actionin tulos arvioitiin
    details: Postcheck palauttaa done, retry tai blocked. Vain validoitu retry käyttää semanttista retry-budjettia.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 17798111-31e0-42db-abb9-837514389bdb
    kind: event
    title: Critic-ehdotus hyväksyttiin
    details: Luotettu ihminen hyväksyy täsmällisen revision ja hashin.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 17e9acde-3e2e-4c8a-84f7-0aa7ed5b6eab
    kind: event
    title: Critic-palaute tallennettiin
    details: Hyväksyntä appendaa täsmälleen yhden immutable Feedback-entryn alkuperäviitteineen.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 1b1e7486-5055-4f80-90fb-3b00040cedf6
    kind: system
    title: Git ja Agent-TOML-tiedostot
    details: "Prosessin käyttämä ulkoinen järjestelmä: Git ja Agent-TOML-tiedostot. Sovelluspalvelun vastuu: Action-authorointipalvelu. Nykyisen vastuun kuvaus; ei uusi arkkitehtuuripäätös. State order ja Action priority ovat positiivisia ja yksikäsitteisiä. Action omistaa kaksi nimettyä TOML-agenttia ja niiden Skill-valinnat."
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
      - .ballet/arc42/05-building-block-view.md
  - id: 1c13c4a4-7da1-4e9f-a738-ff211c918085
    kind: command
    title: Kirjaa arkkitehtuuripäätös
    details: Voimassa oleva päätös ja soveltamisala tallennetaan kolmirivisenä recordina.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: 1fa6399d-307b-4105-bc0b-d61b54560411
    kind: event
    title: Refinement-apply estettiin
    details: Väärä hash, muuttunut base commit, kielletty polku tai puuttuva vaikutus tuottaa nolla projektikirjoitusta ja nolla continuationia.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 21191eee-61b5-45e6-9d6d-da34a847485e
    kind: event
    title: Run Evidence muodostettiin
    details: Kaikki Actionit ovat done; finalisointi sitoo terminaalisen tuloksen committiin ja säilyvään artefaktievidenssiin.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 231d1ba3-d86e-4ec5-953c-81ca945987bf
    kind: command
    title: Kirjoita User Story
    details: Rooli, tavoite, hyöty, hyväksymiskriteerit ja ADR-viitteet kuuluvat tarinaan.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: 234ee251-b5a9-4f13-bd84-5c2e625a7a0d
    kind: command
    title: Määrittele Environmentin Statet
    details: Työ jaetaan rajattuihin vaiheisiin; jokaisella Statella on vähintään yksi Action.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 2c0de0f8-766a-4200-bda6-45fc115076b2
    kind: event
    title: Refinement-commit muodostettiin
    details: Palvelin tarkistaa preimagen ja base commitin ja soveltaa sallitun muutoksen managed worktreehen.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 2db34c15-5434-4e22-81a4-74c0686969e5
    kind: actor
    title: Runin käynnistäjä
    details: Ihminen käyttää paikallista käyttöliittymää. Toimivalta ei tule providerin tulosteesta.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 2e58932c-651e-47f8-a154-ada552103c93
    kind: event
    title: Root Snapshot jäädytettiin
    details: Agenttien määritelmät, hashit ja Skill-koostumus sidotaan samaan muuttumattomaan lähtötilaan.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 2fd804de-fe56-45c9-9d75-684105ff72c1
    kind: system
    title: Codex CLI ja macOS launchd
    details: "Prosessin käyttämä ulkoinen järjestelmä: Codex CLI ja macOS launchd. Sovelluspalvelun vastuu: Checkout-daemon ja Codex CLI. Nykyisen vastuun kuvaus; ei uusi arkkitehtuuripäätös. Palvelin omistaa jonon ja leasen; daemon omistaa Codex-prosessin. Claimattua tehtävää ei palauteta jonoon eikä tulosta hyväksytä väärällä leasella."
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
      - .ballet/arc42/05-building-block-view.md
  - id: 31d161b4-46f0-4cd4-a1c5-fcdb58cb3e0c
    kind: command
    title: Kirjaa ihmispalaute
    details: Ihminen antaa vain kategorian ja kommentin; palvelin lisää teknisen alkuperän.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 34654214-fd6a-4933-96b6-036d72019b6d
    kind: value
    title: Rajattu ja todennettava työ
    details: Prosessin tavoiteltu hyöty. State order ja Action priority ovat positiivisia ja yksikäsitteisiä. Action omistaa kaksi nimettyä TOML-agenttia ja niiden Skill-valinnat.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 34d69e17-928b-4421-a19e-7215469d67b7
    kind: event
    title: Critic-arviointi aloitettiin
    details: Ajastus on oletuksena pois käytöstä; lease estää päällekkäiset esiintymät.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 360c1cee-30bb-4fec-b895-7777299d3b93
    kind: event
    title: Muutoksen vaikutukset tarkastettiin
    details: Jaetun Skillin kaikki vaikutukset ja vaadittu validointi ovat tarkastettavissa ennen hyväksyntää.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 3ef91417-c69d-4fda-85cc-4709a1d0cb63
    kind: system
    title: Git-worktree ja paikalliset artefaktit
    details: "Prosessin käyttämä ulkoinen järjestelmä: Git-worktree ja paikalliset artefaktit. Sovelluspalvelun vastuu: Runtime ja Git-worktree-palvelu. Nykyisen vastuun kuvaus; ei uusi arkkitehtuuripäätös. Root Snapshot on muuttumaton. Myöhempi State odottaa edeltävien Actionien done-tilaa. Validation omistaa delegoinnin, postcheckin ja semanttisen retryn."
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
      - .ballet/arc42/05-building-block-view.md
  - id: 44dd5316-4b59-4ac7-8a7e-403ff228fb0a
    kind: event
    title: Runtimen valmius tarkistettiin
    details: Asennus, autentikointi ja valittu model/reasoning todennetaan. Palvelimen health ei odota daemonin löytymistä.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 461dd592-012c-4666-bbdf-7137aef823a9
    kind: event
    title: Run peruutettiin
    details: Peruutus on operatiivinen terminaali eikä semanttinen retry.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 47d3e227-9eaa-4f49-bd62-edf3a5ebe947
    kind: event
    title: Work suoritettiin
    details: Validation antaa dynaamisen promptin; Work kirjoittaa vain hallittuun worktreehen ja palauttaa completed tai needs_input.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 4812c8db-35e7-4306-8760-13224e695d4e
    kind: aggregate
    title: Leasettu tehtävä
    details: Palvelin omistaa jonon ja leasen; daemon omistaa Codex-prosessin. Claimattua tehtävää ei palauteta jonoon eikä tulosta hyväksytä väärällä leasella.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 48b2f633-a98d-48ea-b366-235c12f08ca7
    kind: command
    title: Hyväksy täsmällinen muutos
    details: Luotettu ihminen hyväksyy juuri tarkastetun revision ja hashit.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 4a36dd61-b15a-4f97-a5aa-fbeea2703b33
    kind: command
    title: Arvioi viimeisin Run Evidence
    details: Vain lukeva Critic nimeää evidenssiin perustuvan ehdotuksen kirjoittamatta projektiin tai Feedbackiin.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 4c898994-0a6d-4375-b25c-a934374b6fa4
    kind: system
    title: Git ja paikalliset Skill-tiedostot
    details: "Prosessin käyttämä ulkoinen järjestelmä: Git ja paikalliset Skill-tiedostot. Sovelluspalvelun vastuu: Refinement-apply-palvelu. Nykyisen vastuun kuvaus; ei uusi arkkitehtuuripäätös. Hyväksyntä sidotaan exact change-, impact- ja preimage-hasheihin. Apply tuottaa yhden commitin ja yhden uuden Runin muuttamatta parentia."
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
      - .ballet/arc42/05-building-block-view.md
  - id: 4e062061-7908-4663-9033-bae9304a869e
    kind: event
    title: Actionin resurssit todennettiin
    details: TOMLit, Skillit ja Codexin model/reasoning-valmius tarkistetaan ennen dispatchia.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 51f7ba7d-de7c-4fb7-9c61-740fabb56f42
    kind: event
    title: Action ja sen agentit luotiin
    details: Uusi Action saa omat Validation- ja Work-TOMLit, ei kopioitua toisen Actionin ohjetta.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 5d869ff5-5a7a-401a-8617-61568d049ba4
    kind: command
    title: Peruuta Run
    details: Ihminen peruuttaa käynnissä olevan Runin. Provider peruutetaan eikä myöhempää dispatchia tehdä.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 5dd34d75-46b2-40fa-b801-5c91694f76e8
    kind: actor
    title: Palautteen arvioija
    details: Ihminen käyttää paikallista käyttöliittymää. Toimivalta ei tule providerin tulosteesta.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 5e3363aa-efb5-48fc-bc6e-1523dac4df6e
    kind: actor
    title: Muutoksen hyväksyjä
    details: Ihminen käyttää paikallista käyttöliittymää. Toimivalta ei tule providerin tulosteesta.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 5fdfc058-2cdb-42cb-974f-d227c1255281
    kind: event
    title: Tarinan hyväksyntä mitätöityi
    details: Semanttinen muutos palauttaa tarinan luonnokseksi. Esitystavan vastaavat muutokset eivät mitätöi hyväksyntää.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: 60dcc297-331c-469b-bb1e-f0f2f3d4fedb
    kind: event
    title: Action tarkistettiin ennen työtä
    details: Precheck palauttaa done, delegate tai blocked. Done ei vaadi tarpeetonta Work-suoritusta.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 6125fb63-7ae6-45ee-b2c5-c7c08d861d1c
    kind: command
    title: Hylkää Critic-ehdotus
    details: Hylätty, vanhentunut tai hyväksymätön ehdotus tuottaa nolla Feedback-entryä.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 62314b7b-f14c-42d3-ae0e-4a7d443563ed
    kind: command
    title: Hylkää vanhentunut tallennus
    details: Optimistinen hash estää ulkoisen editorin muutosten ylikirjoituksen; oma luonnos säilyy.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: 63c56006-52e4-4288-acd8-2e060add8f97
    kind: read-model
    title: Refinement review ja lineage
    details: Näyttää täsmällisen diffin, sallitut polut, hashit, jaetun Skillin vaikutukset sekä parent-, proposal-, approval- ja commit-viitteet.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 6595c7af-5104-40f5-bd21-93860a77f1d7
    kind: read-model
    title: Loop Engineering -puu
    details: URL omistaa Staten, Actionin ja agentin valinnan. Puu projisoi järjestyksen; geometria ei ole runtime-totuutta.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 682cf189-d5cf-4fbf-bdb3-d83b1a0a3d93
    kind: event
    title: Suoritusjärjestys tallennettiin
    details: Sortable-lista lähettää kaikki ID:t; palvelin normalisoi järjestyksen arvoiksi 1..n.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 691bc275-4506-4dec-a900-584a3851e4be
    kind: read-model
    title: Runtimes-diagnostiikka
    details: Daemonin tila, PID, uptime, last seen, virhe, aktiiviset tehtävät, Codex-valmius ja lokit. Restart estetään aktiivisen työn aikana.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 6cef2975-04c4-4565-b09f-16f30774ce39
    kind: event
    title: Critic-ehdotus laadittiin
    details: Vain lukeva Critic nimeää evidenssiin perustuvan ehdotuksen kirjoittamatta projektiin tai Feedbackiin.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 6d0c6346-ec46-49d6-ba80-0aaf0c6e6848
    kind: command
    title: Kirjaa hyväksytty ehdotus palautteeksi
    details: Hyväksyntä appendaa täsmälleen yhden immutable Feedback-entryn alkuperäviitteineen.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 6d46dbe1-b5f5-46e2-9b0d-f623544662ef
    kind: event
    title: Continuation Run luotiin
    details: Uusi snapshot nimeää parentin, ehdotuksen, hyväksynnän ja commitin; parentin sisältö ei muutu.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 6fae5808-9886-4d2a-a71a-d087849d8abc
    kind: command
    title: Järjestä Statet ja Actionit
    details: Sortable-lista lähettää kaikki ID:t; palvelin normalisoi järjestyksen arvoiksi 1..n.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 6fc2f920-23f2-45a8-a5ae-af502a16648d
    kind: command
    title: Hylkää virheellinen koostumus
    details: Puuttuva, ylimääräinen, symlinkattu, väärän niminen tai duplikaattiohjeinen agentti estää preflightin.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 72521641-b439-4e55-b0cf-b405548f4326
    kind: hotspot
    title: Prosessirajojen yhteinen katselmointi
    details: "Mallinnus perustuu nykyisiin dokumentteihin. Ihmisen kanssa pidetyn Event Storming -työpajan evidenssiä ei ole: toimijoiden käyttämä sanasto ja prosessien rajat odottavat yhteistä katselmointia. Tämä ei ole runtime-esto."
    sources:
      - .ballet/overview.md
  - id: 75ab8bc7-b9b7-43d7-8ef8-387c152d2b30
    kind: aggregate
    title: Environment-määritys
    details: State order ja Action priority ovat positiivisia ja yksikäsitteisiä. Action omistaa kaksi nimettyä TOML-agenttia ja niiden Skill-valinnat.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 75bd6f9b-51ab-425b-a9fe-03d12c5538e3
    kind: system
    title: Git ja paikallinen tiedostojärjestelmä
    details: "Prosessin käyttämä ulkoinen järjestelmä: Git ja paikallinen tiedostojärjestelmä. Sovelluspalvelun vastuu: Projektidokumenttipalvelu. Nykyisen vastuun kuvaus; ei uusi arkkitehtuuripäätös. Tarina omistaa semanttisen sisältönsä ja hyväksyntärevisionsa. Tallennus ei hyväksy; merkityksen muutos mitätöi hyväksynnän."
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
      - .ballet/arc42/05-building-block-view.md
  - id: 76a1859e-7423-4d48-a2d8-2eb12189dbda
    kind: event
    title: Authorointi tai valmiustarkistus estyi
    details: Puuttuva, ylimääräinen, symlinkattu, väärän niminen tai duplikaattiohjeinen agentti estää preflightin.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: 7b106a6f-746d-4f5e-916c-f3155c229fbf
    kind: command
    title: Muokkaa projektikuvausta
    details: Overviewn tarkoitus, tulokset, rajaus ja yhteiset vaatimukset tallennetaan yhteen Markdown-tiedostoon.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: 7f343df1-5897-4fa8-8779-5ad99601c5c5
    kind: value
    title: Turvallinen ja auditoitava parannus
    details: Prosessin tavoiteltu hyöty. Hyväksyntä sidotaan exact change-, impact- ja preimage-hasheihin. Apply tuottaa yhden commitin ja yhden uuden Runin muuttamatta parentia.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 81f93d10-9743-49fb-93fc-9e4eebb9ec0e
    kind: command
    title: Varmenna ja aktivoi julkaisu
    details: Natiivin macOS-paketin SHA-256 ja attestointi tarkistetaan ennen suoran asennuksen atomista aktivointia. Homebrew omistaa oman päivityspolkunsa.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027203.md
      - .ballet/adr/adr-009-varmennettu-macos-jakelu.md
  - id: 8389f28c-9bc9-48f9-84ed-b61cfbd13c4d
    kind: event
    title: Jonotettu työ palautui
    details: Queued-työ säilyy SQLiteen tallennettuna; jo claimattua tehtävää ei ajeta uudelleen.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 848ceaee-00d2-4a93-ad01-2355222c6c4b
    kind: system
    title: Codex CLI
    details: "Prosessin käyttämä ulkoinen järjestelmä: Codex CLI. Sovelluspalvelun vastuu: Critic-ajastin ja päätöspalvelu. Nykyisen vastuun kuvaus; ei uusi arkkitehtuuripäätös. Critic on read-only. Vain ihmisen hyväksymä exact revision/hash saa luoda yhden kausaalisesti sidotun Feedback-entryn."
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
      - .ballet/arc42/05-building-block-view.md
  - id: 8885ea91-05d5-4338-ba9b-b3f46f3371a0
    kind: command
    title: Hyväksy tallennettu tarina
    details: Luotettu ihmisidentiteetti hyväksyy tallennetun tiedosto- ja semanttisen hashin täsmällisesti.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: 8c938689-4c24-4ed8-8439-8c3a4926907a
    kind: command
    title: Tee Validation-postcheck
    details: Postcheck palauttaa done, retry tai blocked. Vain validoitu retry käyttää semanttista retry-budjettia.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 8f053585-b941-46e5-a425-eaf58fd88f92
    kind: value
    title: Yksi ymmärrettävä projektimäärittely
    details: Prosessin tavoiteltu hyöty. Tarina omistaa semanttisen sisältönsä ja hyväksyntärevisionsa. Tallennus ei hyväksy; merkityksen muutos mitätöi hyväksynnän.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: 904583b6-990f-41ae-b533-e8e9ec41b4e5
    kind: command
    title: Estä retry-rajan ylitys
    details: Exhaustion tai Validation blocked pysäyttää etenemisen ja kirjoittaa yhden blocked-Feedbackin samassa transaktiossa.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: 932e3055-2781-4d9e-97be-1d87c0cd7c04
    kind: event
    title: Projektisisällön tallennus hylättiin
    details: Optimistinen hash estää ulkoisen editorin muutosten ylikirjoituksen; oma luonnos säilyy.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: 9647dd59-3438-4565-bb0b-6cf0b9310995
    kind: event
    title: Ihmispalaute tallennettiin
    details: Ihminen antaa vain kategorian ja kommentin; palvelin lisää teknisen alkuperän.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: 9690f5de-9d1e-480e-bda7-75789d5f48e1
    kind: command
    title: Käynnistä checkoutin palvelut
    details: Git-checkoutin juuri ja HEAD tunnistetaan. Jokaisella checkoutilla on oma identiteetti, loopback-portti ja tila.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 9f71dcf2-cdf8-49ba-963f-514a3b5c9f1f
    kind: command
    title: Päätä runtimensa menettänyt tehtävä
    details: Lease vanheni daemonin menetyksen jälkeen; tehtävää ei requeueata.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: 9f76de14-e2f6-4d1d-95f9-451fdfb4ae24
    kind: event
    title: Action ja Feedback estyivät atomisesti
    details: Exhaustion tai Validation blocked pysäyttää etenemisen ja kirjoittaa yhden blocked-Feedbackin samassa transaktiossa.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: a410e4bc-718e-4296-9a26-d0d21f5bc602
    kind: command
    title: Hyväksy Critic-ehdotus
    details: Luotettu ihminen hyväksyy täsmällisen revision ja hashin.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: a51f2fb0-6180-4bed-8bf1-1f7ea415d8c7
    kind: policy
    title: Aktiivinen Run lukitsee authoroinnin
    details: Config ja omistetut Agent-TOMLit muuttuvat atomisesti tai eivät lainkaan. Roolien oikeuksia ei voi laajentaa TOMLissa.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: a5b3bfeb-359b-4cc1-bd82-97a5cb71a7bb
    kind: command
    title: Delegoi rajattu Work
    details: Validation antaa dynaamisen promptin; Work kirjoittaa vain hallittuun worktreehen ja palauttaa completed tai needs_input.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: a6832bac-f5bf-4304-a22d-ba3b3324594d
    kind: policy
    title: Retry → uusi rajattu Work-yritys
    details: Work-yrityksiä sallitaan 1 + maxRetries. Korjauspalaute välitetään seuraavaan yritykseen. Provider-virhe ei ole semanttinen retry.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: a6cad801-8cb2-47f5-bd71-d5b80797a0f1
    kind: command
    title: Käynnistä erääntynyt Critic
    details: Ajastus on oletuksena pois käytöstä; lease estää päällekkäiset esiintymät.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: a6e46ead-cfd4-4580-a03f-98b3cb51017a
    kind: event
    title: Tarinaluonnos tallennettiin
    details: Rooli, tavoite, hyöty, hyväksymiskriteerit ja ADR-viitteet kuuluvat tarinaan.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: a768e1f5-f597-412f-b30d-c1203902c0aa
    kind: event
    title: Providerin tulos vastaanotettiin
    details: Daemon ajaa Codex CLI:n ja toimittaa tuloksen lease- ja fencing-rajojen läpi.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: a7f095cf-9156-4a13-8956-eac0109cfcb8
    kind: actor
    title: Työn määrittelijä
    details: Ihminen käyttää paikallista käyttöliittymää. Toimivalta ei tule providerin tulosteesta.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: a8179a54-f7de-49a6-bd4a-76cd5e9429b1
    kind: read-model
    title: Run Gate ja Run Evidence
    details: Run Gate näyttää palvelimen etenemisfaktat. Terminaalinen Run Evidence projisoi commitin, artefaktit ja hyväksyntäviitteet ilman rinnakkaista tallennustotuutta.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: a890f62f-43e9-483c-9d4c-1e35f95e53c6
    kind: policy
    title: Ihmisen hyväksyntä → yksi Feedback
    details: Duplikaattikomento ja restart eivät luo toista Feedback-entryä. Ajastin sallii korkeintaan yhden catch-upin.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: ab0b3c45-f6f6-42dc-b03e-10bc91c78af3
    kind: command
    title: Tarkasta diff ja vaikutukset
    details: Jaetun Skillin kaikki vaikutukset ja vaadittu validointi ovat tarkastettavissa ennen hyväksyntää.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: b5e3fe45-0681-44e3-85a5-faf785413681
    kind: command
    title: Tarkista Codex-valmius
    details: Asennus, autentikointi ja valittu model/reasoning todennetaan. Palvelimen health ei odota daemonin löytymistä.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: b70a0c86-8cd3-4772-a3ea-5e8e63d20e50
    kind: policy
    title: Merkitys muuttui → hyväksyntä vanheni
    details: Hyväksytty tarina ei ole Run-portti. Semanttinen hash käsittää sanat, rakenteen, linkit, koodin ja järjestetyt kriteerit.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: bfa7a70d-0fe7-4905-8eef-3f0fd57178f4
    kind: event
    title: Statet määriteltiin
    details: Työ jaetaan rajattuihin vaiheisiin; jokaisella Statella on vähintään yksi Action.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: c322601e-8254-4887-b45e-75c2ba85209a
    kind: command
    title: Finalisoi valmis Run
    details: Kaikki Actionit ovat done; finalisointi sitoo terminaalisen tuloksen committiin ja säilyvään artefaktievidenssiin.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: c6ad6caf-ac9d-4031-8d0f-93e3874b1c37
    kind: event
    title: Projektikuvaus tallennettiin
    details: Overviewn tarkoitus, tulokset, rajaus ja yhteiset vaatimukset tallennetaan yhteen Markdown-tiedostoon.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: c88fc915-feab-41f7-9834-6d9b52f1834d
    kind: event
    title: Refinement hyväksyttiin
    details: Luotettu ihminen hyväksyy juuri tarkastetun revision ja hashit.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: c8a1a71c-acae-4288-bf53-42ab58c1885c
    kind: command
    title: Luo rajattu Action
    details: Uusi Action saa omat Validation- ja Work-TOMLit, ei kopioitua toisen Actionin ohjetta.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: ca83c128-9d26-4a4c-896f-365e2b1879eb
    kind: actor
    title: Paikallinen operaattori
    details: Ihminen käyttää paikallista käyttöliittymää. Toimivalta ei tule providerin tulosteesta.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: d183b59d-fe0a-47db-9801-4c2097f01925
    kind: event
    title: Varmennettu paketti aktivoitiin
    details: Väärä arkkitehtuuri tai epäonnistunut varmennus aktivoi nolla pakettia. Julkaisu ja deploy edellyttävät erillistä täsmällistä ihmisvaltuutusta.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027203.md
      - .ballet/adr/adr-009-varmennettu-macos-jakelu.md
  - id: d18c5f7a-ca31-40fb-a736-3d4e6b4f0502
    kind: event
    title: Palvelin ja daemon käynnistyivät
    details: Git-checkoutin juuri ja HEAD tunnistetaan. Jokaisella checkoutilla on oma identiteetti, loopback-portti ja tila.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: d3504513-4afc-4083-af6c-0c7021081734
    kind: event
    title: Actionin koostumus tallennettiin
    details: Config ja kaksi TOMLia tallennetaan atomisesti täsmällisillä hasheilla.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: d524f702-c7de-458e-a0b1-f5c4b1aed035
    kind: value
    title: Harkittu parannuspalaute
    details: Prosessin tavoiteltu hyöty. Critic on read-only. Vain ihmisen hyväksymä exact revision/hash saa luoda yhden kausaalisesti sidotun Feedback-entryn.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: d7aeddfd-7b67-488d-aafe-43d44a5bd468
    kind: value
    title: Todennettu ja jäljitettävä tulos
    details: Prosessin tavoiteltu hyöty. Root Snapshot on muuttumaton. Myöhempi State odottaa edeltävien Actionien done-tilaa. Validation omistaa delegoinnin, postcheckin ja semanttisen retryn.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: da56eac4-b164-4bd1-b1fb-ab1eb75f572b
    kind: command
    title: Valitse agentin ohje ja Skillit
    details: Config ja kaksi TOMLia tallennetaan atomisesti täsmällisillä hasheilla.
    sources:
      - .ballet/user-stories/837f8ecb-c3e7-46d5-a8a4-9521f37542e4.md
      - .ballet/adr/adr-042-action-specific-codex-agents.md
  - id: dd63a167-758d-45f8-8236-9eb82085bf0a
    kind: command
    title: Muuta tarinan merkitystä
    details: Semanttinen muutos palauttaa tarinan luonnokseksi. Esitystavan vastaavat muutokset eivät mitätöi hyväksyntää.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: e5f79a9f-7a2f-45de-95e4-c366420d40b9
    kind: policy
    title: Kelvollinen hyväksytty apply → uusi Run
    details: Vain olemassa olevan Action-agentin developer_instructions ja sallitut instruction-/Skill-polut ovat soveltamisen piirissä. Muut TOML-kentät jäävät authorointiin.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: e72c51cc-3a6e-405f-be35-de8445371b75
    kind: actor
    title: Projektin omistaja
    details: Ihminen käyttää paikallista käyttöliittymää. Toimivalta ei tule providerin tulosteesta.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: ebd5aa83-1e35-4632-b1e9-a0f14d30ac6e
    kind: command
    title: Luo muuttumaton jatkoajo
    details: Uusi snapshot nimeää parentin, ehdotuksen, hyväksynnän ja commitin; parentin sisältö ei muutu.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: ee014148-26a7-4ce1-ad92-862269a9a42f
    kind: aggregate
    title: Environment Run
    details: Root Snapshot on muuttumaton. Myöhempi State odottaa edeltävien Actionien done-tilaa. Validation omistaa delegoinnin, postcheckin ja semanttisen retryn.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: f0a720d9-a2b3-4f60-b070-3f3738a450da
    kind: event
    title: Muutosehdotus laadittiin
    details: Vain lukeva agentti nimeää base commitin, sallitut muutokset, hashit, diffin ja vaikutusjoukon.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: f1cd5dbd-a603-4ce8-b76e-a9747c26e06e
    kind: event
    title: Critic-ehdotus hylättiin
    details: Hylätty, vanhentunut tai hyväksymätön ehdotus tuottaa nolla Feedback-entryä.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: f4206cda-7f79-4951-8be6-5bc5c0803e18
    kind: read-model
    title: Critic review ja Feedback Box
    details: Ehdotus ja ihmisen päätös näkyvät erillisinä. Feedback näyttää alkuperän; hylätty tai hyväksymätön ehdotus ei ole Feedbackia.
    sources:
      - .ballet/user-stories/9def77e6-89c3-4ef3-b295-89323c592807.md
      - .ballet/adr/adr-040-codex-only-fixed-governance-agents.md
  - id: f44d5345-7471-44f6-8000-e2f9c9f7a43c
    kind: policy
    title: Leasen menetys → terminaalinen virhe
    details: Runtimensa menettänyt claimattu tehtävä päättyy kerran runtime_lost-virheeseen. Vanhentunut callback ei tuota toista tulosta.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
  - id: f82b8f49-c1f2-4eb4-8b29-32ad8ff9cf7e
    kind: aggregate
    title: Refinement-ehdotus ja apply
    details: Hyväksyntä sidotaan exact change-, impact- ja preimage-hasheihin. Apply tuottaa yhden commitin ja yhden uuden Runin muuttamatta parentia.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: f8c3f921-3751-4062-a914-c842bae9b245
    kind: command
    title: Tee Validation-precheck
    details: Precheck palauttaa done, delegate tai blocked. Done ei vaadi tarpeetonta Work-suoritusta.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027201.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: f9295d71-aa62-43bf-ad03-f86225679e50
    kind: event
    title: Tarina hyväksyttiin
    details: Luotettu ihmisidentiteetti hyväksyy tallennetun tiedosto- ja semanttisen hashin täsmällisesti.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: fba97b32-b1e8-4d77-b850-44e30151d802
    kind: read-model
    title: Projektin neljä näkymää
    details: Overview, Event Storming, User Stories ja ADRs lukevat repositorylähteitä. Hyväksyntä näytetään vain nykyiselle semanttiselle hashille.
    sources:
      - .ballet/user-stories/54625950-26fb-46fe-90e3-f4cf31084368.md
      - .ballet/adr/adr-048-four-project-views.md
  - id: fbb7a2d1-4899-444c-afba-95631559eb2b
    kind: command
    title: Hylkää vanhentunut tai kielletty apply
    details: Väärä hash, muuttunut base commit, kielletty polku tai puuttuva vaikutus tuottaa nolla projektikirjoitusta ja nolla continuationia.
    sources:
      - .ballet/user-stories/cc322abc-96e2-41ef-93f8-1b5aba633995.md
      - .ballet/adr/adr-034-validation-led-environment-state-action-orchestration.md
  - id: fd797518-322f-4e4f-b826-8dda32ee44dd
    kind: command
    title: Suorita provider-tehtävä
    details: Daemon ajaa Codex CLI:n ja toimittaa tuloksen lease- ja fencing-rajojen läpi.
    sources:
      - .ballet/user-stories/aae46173-ec52-44d0-8fa6-e80353027202.md
      - .ballet/adr/adr-037-checkout-local-daemon.md
boards:
  - id: 09eee978-fa50-4df9-8b3c-7ed65a9f55ba
    title: Ballet — kokonaiskuva
    level: big-picture
    description: Nykyisiin projektidokumentteihin perustuva rekonstruktio, ei väite pidetystä työpajasta. Kuusi rinnakkaista prosessia etenevät vasemmalta oikealle. Ihminen omistaa tavoitteet ja hyväksynnät; runtime omistaa suorituksen.
    placements:
      - id: 00692e78-114b-4197-bf88-25eac52f908d
        noteId: 0c385d44-c5ae-4e7b-a136-5706c1683292
        x: 1320
        y: 90
        width: 184
        height: 208
        pivotal: true
        frameId: 4914d5c7-ccd9-4234-9984-8a89d4e9bb22
      - id: 0410631d-6168-470b-89f4-c9e5fc59d452
        noteId: 51f7ba7d-de7c-4fb7-9c61-740fabb56f42
        x: 510
        y: 530
        width: 184
        height: 208
        pivotal: false
        frameId: f3f480db-c67e-46f5-abd0-5622e4e0f08b
      - id: 0646cb74-7435-4ca5-97ab-f60fc4d859a5
        noteId: 6d46dbe1-b5f5-46e2-9b0d-f623544662ef
        x: 1320
        y: 2290
        width: 184
        height: 208
        pivotal: true
        frameId: 6342d1e7-73fc-4700-9cea-756845a22496
      - id: 2e11aab1-58fd-43e3-a20b-5fca9805e517
        noteId: 8389f28c-9bc9-48f9-84ed-b61cfbd13c4d
        x: 1320
        y: 1410
        width: 184
        height: 208
        pivotal: true
        frameId: 730a509a-5c63-4323-9d0a-bfdcf4e3cf24
      - id: 2e9ab4b9-72cb-4362-bcca-3fd6f8ab2c3c
        noteId: 5dd34d75-46b2-40fa-b801-5c91694f76e8
        x: 40
        y: 1850
        width: 184
        height: 208
        pivotal: false
        frameId: 4ee834df-74dc-4650-9f00-2eb9551d631a
      - id: 3400bb22-af1c-4c28-9a5d-151bac50ac86
        noteId: 21191eee-61b5-45e6-9d6d-da34a847485e
        x: 1320
        y: 970
        width: 184
        height: 208
        pivotal: true
        frameId: 3e86d29c-a41f-4e27-8128-829241886094
      - id: 3e9f1896-c0b2-42af-bb63-7260621d515e
        noteId: 0f672016-246a-4d80-b899-17b6073c0830
        x: 1600
        y: 1410
        width: 184
        height: 208
        pivotal: false
        frameId: 730a509a-5c63-4323-9d0a-bfdcf4e3cf24
      - id: 42fa9d9d-b0ed-4355-986c-f26cf1719baa
        noteId: f9295d71-aa62-43bf-ad03-f86225679e50
        x: 780
        y: 90
        width: 184
        height: 208
        pivotal: false
        frameId: 4914d5c7-ccd9-4234-9984-8a89d4e9bb22
      - id: 4fa628ca-559d-4221-9190-f3d15dd7df67
        noteId: a6e46ead-cfd4-4580-a03f-98b3cb51017a
        x: 510
        y: 90
        width: 184
        height: 208
        pivotal: false
        frameId: 4914d5c7-ccd9-4234-9984-8a89d4e9bb22
      - id: 4fdc8009-b429-4ad8-b02c-110af91d2db1
        noteId: 2db34c15-5434-4e22-81a4-74c0686969e5
        x: 40
        y: 970
        width: 184
        height: 208
        pivotal: false
        frameId: 3e86d29c-a41f-4e27-8128-829241886094
      - id: 5e1b0c78-db7c-4472-9b3f-a3b2c56cd787
        noteId: 60dcc297-331c-469b-bb1e-f0f2f3d4fedb
        x: 510
        y: 970
        width: 184
        height: 208
        pivotal: false
        frameId: 3e86d29c-a41f-4e27-8128-829241886094
      - id: 60267bef-5a30-4db8-9060-62c355d354af
        noteId: 34d69e17-928b-4421-a19e-7215469d67b7
        x: 510
        y: 1850
        width: 184
        height: 208
        pivotal: false
        frameId: 4ee834df-74dc-4650-9f00-2eb9551d631a
      - id: 61c0743c-02b3-45c8-8a2c-7072ca38ce75
        noteId: d183b59d-fe0a-47db-9801-4c2097f01925
        x: 2000
        y: 1410
        width: 184
        height: 208
        pivotal: false
      - id: 666c1e21-d52f-4b51-8bef-e0d18411fa5a
        noteId: e72c51cc-3a6e-405f-be35-de8445371b75
        x: 40
        y: 90
        width: 184
        height: 208
        pivotal: false
        frameId: 4914d5c7-ccd9-4234-9984-8a89d4e9bb22
      - id: 6ce657a3-c29c-4e23-a646-5314da1b3e22
        noteId: 47d3e227-9eaa-4f49-bd62-edf3a5ebe947
        x: 780
        y: 970
        width: 184
        height: 208
        pivotal: false
        frameId: 3e86d29c-a41f-4e27-8128-829241886094
      - id: 7561592b-b6ba-4556-bacd-4250c75c48da
        noteId: f0a720d9-a2b3-4f60-b070-3f3738a450da
        x: 240
        y: 2290
        width: 184
        height: 208
        pivotal: false
        frameId: 6342d1e7-73fc-4700-9cea-756845a22496
      - id: 78859ad7-b64a-4076-91bc-8e5310028710
        noteId: 17798111-31e0-42db-abb9-837514389bdb
        x: 1050
        y: 1850
        width: 184
        height: 208
        pivotal: false
        frameId: 4ee834df-74dc-4650-9f00-2eb9551d631a
      - id: 7ca3a6f6-9a22-4984-b395-0b51cd4de52a
        noteId: 4e062061-7908-4663-9033-bae9304a869e
        x: 1320
        y: 530
        width: 184
        height: 208
        pivotal: true
        frameId: f3f480db-c67e-46f5-abd0-5622e4e0f08b
      - id: 7e00f426-e3a1-4179-a4ab-02198a647428
        noteId: ca83c128-9d26-4a4c-896f-365e2b1879eb
        x: 40
        y: 1410
        width: 184
        height: 208
        pivotal: false
        frameId: 730a509a-5c63-4323-9d0a-bfdcf4e3cf24
      - id: 7f361f22-ea12-4884-ae4d-d91312b805ff
        noteId: 7f343df1-5897-4fa8-8779-5ad99601c5c5
        x: 1600
        y: 2290
        width: 184
        height: 208
        pivotal: false
        frameId: 6342d1e7-73fc-4700-9cea-756845a22496
      - id: 85ce3860-01db-4759-89c7-c43c62dfdddf
        noteId: c88fc915-feab-41f7-9834-6d9b52f1834d
        x: 780
        y: 2290
        width: 184
        height: 208
        pivotal: false
        frameId: 6342d1e7-73fc-4700-9cea-756845a22496
      - id: 86f86e58-9c2d-497c-b35e-50bb2f2f6bd9
        noteId: 17e9acde-3e2e-4c8a-84f7-0aa7ed5b6eab
        x: 1320
        y: 1850
        width: 184
        height: 208
        pivotal: true
        frameId: 4ee834df-74dc-4650-9f00-2eb9551d631a
      - id: 8a1c4afd-88d9-4b32-9586-094b53c1a05c
        noteId: bfa7a70d-0fe7-4905-8eef-3f0fd57178f4
        x: 240
        y: 530
        width: 184
        height: 208
        pivotal: false
        frameId: f3f480db-c67e-46f5-abd0-5622e4e0f08b
      - id: 8b7c7a9f-7962-4ec0-b120-0f65686f1d49
        noteId: a7f095cf-9156-4a13-8956-eac0109cfcb8
        x: 40
        y: 530
        width: 184
        height: 208
        pivotal: false
        frameId: f3f480db-c67e-46f5-abd0-5622e4e0f08b
      - id: 8de0c70e-b9e7-45c4-9633-100f97dc8109
        noteId: 2e58932c-651e-47f8-a154-ada552103c93
        x: 240
        y: 970
        width: 184
        height: 208
        pivotal: false
        frameId: 3e86d29c-a41f-4e27-8128-829241886094
      - id: 8e22da89-18fc-4fdb-bd29-804c11392827
        noteId: 72521641-b439-4e55-b0cf-b405548f4326
        x: 40
        y: 2760
        width: 184
        height: 208
        pivotal: false
      - id: 935bb915-2b53-446b-ac17-ad02b104dd06
        noteId: d18c5f7a-ca31-40fb-a736-3d4e6b4f0502
        x: 240
        y: 1410
        width: 184
        height: 208
        pivotal: false
        frameId: 730a509a-5c63-4323-9d0a-bfdcf4e3cf24
      - id: 9d6be38f-e51e-4796-8222-c492b3cdbe7e
        noteId: c6ad6caf-ac9d-4031-8d0f-93e3874b1c37
        x: 240
        y: 90
        width: 184
        height: 208
        pivotal: false
        frameId: 4914d5c7-ccd9-4234-9984-8a89d4e9bb22
      - id: 9e7b4804-d77c-40b7-b2bf-492e38ff6ae1
        noteId: d7aeddfd-7b67-488d-aafe-43d44a5bd468
        x: 1600
        y: 970
        width: 184
        height: 208
        pivotal: false
        frameId: 3e86d29c-a41f-4e27-8128-829241886094
      - id: a11ed431-79cb-43d4-a3f6-4bc2fadf69cd
        noteId: 461dd592-012c-4666-bbdf-7137aef823a9
        x: 2000
        y: 970
        width: 184
        height: 208
        pivotal: false
      - id: a37d9ed8-1d3b-4fa4-aeac-d4d84dfdc1fe
        noteId: 146517d0-fd1f-4499-a7a2-291495196292
        x: 1050
        y: 970
        width: 184
        height: 208
        pivotal: false
        frameId: 3e86d29c-a41f-4e27-8128-829241886094
      - id: a4f7e078-e899-42c0-8932-43eccf4c0ad5
        noteId: 682cf189-d5cf-4fbf-bdb3-d83b1a0a3d93
        x: 1050
        y: 530
        width: 184
        height: 208
        pivotal: false
        frameId: f3f480db-c67e-46f5-abd0-5622e4e0f08b
      - id: a6484e85-323c-4364-b353-51665baaf259
        noteId: a768e1f5-f597-412f-b30d-c1203902c0aa
        x: 1050
        y: 1410
        width: 184
        height: 208
        pivotal: false
        frameId: 730a509a-5c63-4323-9d0a-bfdcf4e3cf24
      - id: ae9c3b6a-b080-4308-8741-8e1f92b9f4a7
        noteId: 8f053585-b941-46e5-a425-eaf58fd88f92
        x: 1600
        y: 90
        width: 184
        height: 208
        pivotal: false
        frameId: 4914d5c7-ccd9-4234-9984-8a89d4e9bb22
      - id: b7c1a0e6-4329-43e9-a31d-fd2633f7bb64
        noteId: 9647dd59-3438-4565-bb0b-6cf0b9310995
        x: 240
        y: 1850
        width: 184
        height: 208
        pivotal: false
        frameId: 4ee834df-74dc-4650-9f00-2eb9551d631a
      - id: b9d0c7d5-136d-4e14-8ec9-e171989d6dc9
        noteId: 5fdfc058-2cdb-42cb-974f-d227c1255281
        x: 1050
        y: 90
        width: 184
        height: 208
        pivotal: false
        frameId: 4914d5c7-ccd9-4234-9984-8a89d4e9bb22
      - id: bb848c19-3138-44b6-b0cc-07f2a77c4fab
        noteId: d3504513-4afc-4083-af6c-0c7021081734
        x: 780
        y: 530
        width: 184
        height: 208
        pivotal: false
        frameId: f3f480db-c67e-46f5-abd0-5622e4e0f08b
      - id: be7d5764-d58a-4210-9e53-85eced1c7b59
        noteId: 120df932-7ea8-499b-ba30-d36cbe2397fc
        x: 780
        y: 1410
        width: 184
        height: 208
        pivotal: false
        frameId: 730a509a-5c63-4323-9d0a-bfdcf4e3cf24
      - id: c642cc14-f653-43d1-94f3-6d772f2de198
        noteId: d524f702-c7de-458e-a0b1-f5c4b1aed035
        x: 1600
        y: 1850
        width: 184
        height: 208
        pivotal: false
        frameId: 4ee834df-74dc-4650-9f00-2eb9551d631a
      - id: d8f7406e-5851-4386-98d7-3aac2b1b5029
        noteId: 34654214-fd6a-4933-96b6-036d72019b6d
        x: 1600
        y: 530
        width: 184
        height: 208
        pivotal: false
        frameId: f3f480db-c67e-46f5-abd0-5622e4e0f08b
      - id: dd05332b-d2c8-4834-b402-0cbc95ce6cef
        noteId: 360c1cee-30bb-4fec-b895-7777299d3b93
        x: 510
        y: 2290
        width: 184
        height: 208
        pivotal: false
        frameId: 6342d1e7-73fc-4700-9cea-756845a22496
      - id: dd30e8f9-8775-48e3-957b-3c96e2e0463b
        noteId: 5e3363aa-efb5-48fc-bc6e-1523dac4df6e
        x: 40
        y: 2290
        width: 184
        height: 208
        pivotal: false
        frameId: 6342d1e7-73fc-4700-9cea-756845a22496
      - id: e127a1d1-c8bb-466e-981a-56c941a89d18
        noteId: 6cef2975-04c4-4565-b09f-16f30774ce39
        x: 780
        y: 1850
        width: 184
        height: 208
        pivotal: false
        frameId: 4ee834df-74dc-4650-9f00-2eb9551d631a
      - id: ec0520ac-8f35-44cf-b9b3-810874e80fe8
        noteId: 44dd5316-4b59-4ac7-8a7e-403ff228fb0a
        x: 510
        y: 1410
        width: 184
        height: 208
        pivotal: false
        frameId: 730a509a-5c63-4323-9d0a-bfdcf4e3cf24
      - id: ec4b2f10-bbe8-4256-8f1c-b8e74d2da2fe
        noteId: 2c0de0f8-766a-4200-bda6-45fc115076b2
        x: 1050
        y: 2290
        width: 184
        height: 208
        pivotal: false
        frameId: 6342d1e7-73fc-4700-9cea-756845a22496
    connections:
      - id: 001ed665-bac1-48b8-89ea-134429bcfd0d
        source: 85ce3860-01db-4759-89c7-c43c62dfdddf
        target: ec4b2f10-bbe8-4256-8f1c-b8e74d2da2fe
        label: ""
      - id: 01fbb764-2384-4d21-a96b-1dbf7d42c6fb
        source: b7c1a0e6-4329-43e9-a31d-fd2633f7bb64
        target: 60267bef-5a30-4db8-9060-62c355d354af
        label: ""
      - id: 034d9aff-3062-403b-8f3a-1c1c6f74b537
        source: b9d0c7d5-136d-4e14-8ec9-e171989d6dc9
        target: 00692e78-114b-4197-bf88-25eac52f908d
        label: ""
      - id: 07b09c80-7617-4918-83f3-02cbd0f86728
        source: 78859ad7-b64a-4076-91bc-8e5310028710
        target: 86f86e58-9c2d-497c-b35e-50bb2f2f6bd9
        label: ""
      - id: 1aa132ab-421b-4675-ab1e-8e51fd985333
        source: a4f7e078-e899-42c0-8932-43eccf4c0ad5
        target: 7ca3a6f6-9a22-4984-b395-0b51cd4de52a
        label: ""
      - id: 1c7edd17-fd7b-4cd2-a0db-8afbcfcad2a8
        source: 935bb915-2b53-446b-ac17-ad02b104dd06
        target: ec0520ac-8f35-44cf-b9b3-810874e80fe8
        label: ""
      - id: 2e62705d-be2f-4ba6-bca5-121cc11b5bd1
        source: 6ce657a3-c29c-4e23-a646-5314da1b3e22
        target: a37d9ed8-1d3b-4fa4-aeac-d4d84dfdc1fe
        label: ""
      - id: 36804b2c-f479-4646-89d3-1b1ebe3ba8ff
        source: 60267bef-5a30-4db8-9060-62c355d354af
        target: e127a1d1-c8bb-466e-981a-56c941a89d18
        label: ""
      - id: 5750607c-0815-4e93-9097-20d00606d080
        source: 42fa9d9d-b0ed-4355-986c-f26cf1719baa
        target: b9d0c7d5-136d-4e14-8ec9-e171989d6dc9
        label: ""
      - id: 74968da3-9937-499a-918c-6220c321ac37
        source: 7561592b-b6ba-4556-bacd-4250c75c48da
        target: dd05332b-d2c8-4834-b402-0cbc95ce6cef
        label: ""
      - id: 7ad22017-5b5d-473a-b3f6-2b7ded375210
        source: 9d6be38f-e51e-4796-8222-c492b3cdbe7e
        target: 4fa628ca-559d-4221-9190-f3d15dd7df67
        label: ""
      - id: 91bdeb9c-fdb9-4e9e-8d61-f914d0c44bcb
        source: 0410631d-6168-470b-89f4-c9e5fc59d452
        target: bb848c19-3138-44b6-b0cc-07f2a77c4fab
        label: ""
      - id: 98f9ea31-cfe0-4e07-afa9-e878e2ea3134
        source: ec0520ac-8f35-44cf-b9b3-810874e80fe8
        target: be7d5764-d58a-4210-9e53-85eced1c7b59
        label: ""
      - id: aa5b8a22-b222-42f9-ab4e-a29d9aab154a
        source: a37d9ed8-1d3b-4fa4-aeac-d4d84dfdc1fe
        target: 3400bb22-af1c-4c28-9a5d-151bac50ac86
        label: ""
      - id: b18724bb-90ed-42ff-b72c-1579786c23dd
        source: ec4b2f10-bbe8-4256-8f1c-b8e74d2da2fe
        target: 0646cb74-7435-4ca5-97ab-f60fc4d859a5
        label: ""
      - id: b9826c96-b130-4439-afbb-dadaf0f7752c
        source: 5e1b0c78-db7c-4472-9b3f-a3b2c56cd787
        target: 6ce657a3-c29c-4e23-a646-5314da1b3e22
        label: ""
      - id: bc030288-e0a0-4761-bf9d-ec964f34508e
        source: bb848c19-3138-44b6-b0cc-07f2a77c4fab
        target: a4f7e078-e899-42c0-8932-43eccf4c0ad5
        label: ""
      - id: c3705a96-7dd3-420f-9c20-115a7793e9c4
        source: be7d5764-d58a-4210-9e53-85eced1c7b59
        target: a6484e85-323c-4364-b353-51665baaf259
        label: ""
      - id: c7bf1bbf-98da-48eb-97dc-cf870637032f
        source: 8a1c4afd-88d9-4b32-9586-094b53c1a05c
        target: 0410631d-6168-470b-89f4-c9e5fc59d452
        label: ""
      - id: dd9cf138-7502-4199-be4a-46ec65917b4a
        source: 8de0c70e-b9e7-45c4-9633-100f97dc8109
        target: 5e1b0c78-db7c-4472-9b3f-a3b2c56cd787
        label: ""
      - id: e2aac726-0a57-4e12-86e9-eb96003326ba
        source: e127a1d1-c8bb-466e-981a-56c941a89d18
        target: 78859ad7-b64a-4076-91bc-8e5310028710
        label: ""
      - id: f23c157d-4d63-4b7c-bf7b-3d54ee22b993
        source: dd05332b-d2c8-4834-b402-0cbc95ce6cef
        target: 85ce3860-01db-4759-89c7-c43c62dfdddf
        label: ""
      - id: f33ca510-9850-4a9e-b92c-46b0bccaceec
        source: a6484e85-323c-4364-b353-51665baaf259
        target: 2e11aab1-58fd-43e3-a20b-5fca9805e517
        label: ""
      - id: f978a137-fa9d-487a-802c-d8964c303089
        source: 4fa628ca-559d-4221-9190-f3d15dd7df67
        target: 42fa9d9d-b0ed-4355-986c-f26cf1719baa
        label: ""
      - id: fc13fbcc-b577-46d7-827d-1d3435f7d33f
        source: 2e11aab1-58fd-43e3-a20b-5fca9805e517
        target: 61c0743c-02b3-45c8-8a2c-7072ca38ce75
        label: erillinen asennuspolku
    frames:
      - id: 3e86d29c-a41f-4e27-8128-829241886094
        title: Validation, Work ja Run Evidence
        kind: process
        x: 0
        y: 880
        width: 1880
        height: 380
      - id: 4914d5c7-ccd9-4234-9984-8a89d4e9bb22
        title: Projektisisältö ja tarinoiden hyväksyntä
        kind: process
        x: 0
        y: 0
        width: 1880
        height: 380
      - id: 4ee834df-74dc-4650-9f00-2eb9551d631a
        title: Feedback ja Critic
        kind: process
        x: 0
        y: 1760
        width: 1880
        height: 380
      - id: 6342d1e7-73fc-4700-9cea-756845a22496
        title: Refinement ja continuation
        kind: process
        x: 0
        y: 2200
        width: 1880
        height: 380
      - id: 730a509a-5c63-4323-9d0a-bfdcf4e3cf24
        title: Paikallinen palvelu, daemon ja jakelu
        kind: process
        x: 0
        y: 1320
        width: 1880
        height: 380
      - id: f3f480db-c67e-46f5-abd0-5622e4e0f08b
        title: Environment ja Action Agentit
        kind: process
        x: 0
        y: 440
        width: 1880
        height: 380
  - id: 3d075703-a410-4d75-b98f-942f9755e9a8
    title: 6. Refinement ja continuation
    level: process-modelling
    description: Dokumentoidun prosessin komennot, tapahtumat, toimija, säännöt ja poikkeuspolut. Yhteydet kuvaavat ehtoja, eivät alustan uusia kontrollikomentoja.
    sourceBoardId: 09eee978-fa50-4df9-8b3c-7ed65a9f55ba
    placements:
      - id: 29716cb3-4120-4114-b74e-7102338896cf
        noteId: 2c0de0f8-766a-4200-bda6-45fc115076b2
        x: 990
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: 2e49eefc-df61-4804-aaf4-4badbe2c4d3d
        noteId: 022f9769-b5c0-4221-bebf-4cbd9ab4615c
        x: 990
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: 2f4926b7-f4c2-43dc-b474-f664b0674d81
        noteId: 6d46dbe1-b5f5-46e2-9b0d-f623544662ef
        x: 1240
        y: 360
        width: 184
        height: 208
        pivotal: true
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: 3e52eea6-75ff-42ae-995b-fe0130815af7
        noteId: 48b2f633-a98d-48ea-b366-235c12f08ca7
        x: 740
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: 5e85f887-cc1f-4917-a47f-5e93d40f282b
        noteId: 360c1cee-30bb-4fec-b895-7777299d3b93
        x: 490
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: 65abbeab-7c83-4149-82e3-90028cba21a9
        noteId: 11ca25a0-a066-4511-925e-b0c8bae79e66
        x: 240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: 73e3d85b-f112-47d1-8853-6744530ad542
        noteId: ab0b3c45-f6f6-42dc-b03e-10bc91c78af3
        x: 490
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: 95fc2834-bc2b-4c03-99f9-7ba81ba3af70
        noteId: f0a720d9-a2b3-4f60-b070-3f3738a450da
        x: 240
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: b029fca5-ae6d-46cf-9f6d-cfc6a18f12d6
        noteId: 63c56006-52e4-4288-acd8-2e060add8f97
        x: 40
        y: 650
        width: 224
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: c567a9d5-cc9e-4dcd-abea-4390d79bfa98
        noteId: 1fa6399d-307b-4105-bc0b-d61b54560411
        x: 1240
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: d0f7fd63-8236-49c0-9b63-fb897ce425b7
        noteId: ebd5aa83-1e35-4632-b1e9-a0f14d30ac6e
        x: 1240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: d1a5dcf4-21e8-4187-beab-6b3e6a7adcb0
        noteId: e5f79a9f-7a2f-45de-95e4-c366420d40b9
        x: 490
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: eb1ca2a9-6a8a-4c45-a02d-eae3647b10b0
        noteId: fbb7a2d1-4899-444c-afba-95631559eb2b
        x: 990
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: f2d795e6-7793-46f8-8e43-93cdbbe86f01
        noteId: c88fc915-feab-41f7-9834-6d9b52f1834d
        x: 740
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
      - id: f3b86247-be71-442f-9bcb-45028ad605ab
        noteId: 5e3363aa-efb5-48fc-bc6e-1523dac4df6e
        x: 40
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
    connections:
      - id: 0098b57f-885a-41b6-acd7-dda7667888b4
        source: f2d795e6-7793-46f8-8e43-93cdbbe86f01
        target: 2e49eefc-df61-4804-aaf4-4badbe2c4d3d
        label: jatkoehdon täyttyessä
      - id: 0cde3e57-1e6f-4a9e-8d95-7603afb304d9
        source: f2d795e6-7793-46f8-8e43-93cdbbe86f01
        target: d1a5dcf4-21e8-4187-beab-6b3e6a7adcb0
        label: sääntö
      - id: 4e64008a-a46e-4fe3-bb2c-c21bef8a64f4
        source: 2e49eefc-df61-4804-aaf4-4badbe2c4d3d
        target: 29716cb3-4120-4114-b74e-7102338896cf
        label: tuottaa
      - id: 5e98974c-0639-47df-816b-bbf576d08e51
        source: 73e3d85b-f112-47d1-8853-6744530ad542
        target: 5e85f887-cc1f-4917-a47f-5e93d40f282b
        label: tuottaa
      - id: 7e61635d-df8f-462e-a983-88d9dbc1f9c7
        source: 29716cb3-4120-4114-b74e-7102338896cf
        target: d0f7fd63-8236-49c0-9b63-fb897ce425b7
        label: jatkoehdon täyttyessä
      - id: 851f0d2d-c4f7-40ed-a69a-f07fe5645360
        source: 65abbeab-7c83-4149-82e3-90028cba21a9
        target: 95fc2834-bc2b-4c03-99f9-7ba81ba3af70
        label: tuottaa
      - id: 9b47498b-cd6e-4b47-ae2d-c6d668387bd8
        source: d1a5dcf4-21e8-4187-beab-6b3e6a7adcb0
        target: eb1ca2a9-6a8a-4c45-a02d-eae3647b10b0
        label: esto tai poikkeus
      - id: c641568f-d03f-45af-b368-72dc4cd6735c
        source: 3e52eea6-75ff-42ae-995b-fe0130815af7
        target: f2d795e6-7793-46f8-8e43-93cdbbe86f01
        label: tuottaa
      - id: dcdd29e0-ff4a-4d63-bcae-a19eaeffbb18
        source: 2f4926b7-f4c2-43dc-b474-f664b0674d81
        target: b029fca5-ae6d-46cf-9f6d-cfc6a18f12d6
        label: näytetään
      - id: dd20356a-1017-4473-a6e5-e5e07ada7042
        source: eb1ca2a9-6a8a-4c45-a02d-eae3647b10b0
        target: c567a9d5-cc9e-4dcd-abea-4390d79bfa98
        label: tuottaa
      - id: e2f6b371-5b07-41a1-988b-8df6e8e48383
        source: d0f7fd63-8236-49c0-9b63-fb897ce425b7
        target: 2f4926b7-f4c2-43dc-b474-f664b0674d81
        label: tuottaa
      - id: e7585954-acb5-4720-8346-ab9782168e35
        source: 5e85f887-cc1f-4917-a47f-5e93d40f282b
        target: 3e52eea6-75ff-42ae-995b-fe0130815af7
        label: jatkoehdon täyttyessä
      - id: f8e3728f-d5b8-4b76-b43d-81ca045da09e
        source: f3b86247-be71-442f-9bcb-45028ad605ab
        target: 65abbeab-7c83-4149-82e3-90028cba21a9
        label: aloittaa
      - id: fab93ebd-5284-4d0f-9d4b-74377c9ff15e
        source: 95fc2834-bc2b-4c03-99f9-7ba81ba3af70
        target: 73e3d85b-f112-47d1-8853-6744530ad542
        label: jatkoehdon täyttyessä
    frames:
      - id: 91e67f89-b4d9-424f-93eb-3a3f9a56bacf
        title: Refinement ja continuation
        kind: process
        x: 0
        y: 0
        width: 1550
        height: 1040
  - id: 4436191c-d365-4d73-b9b1-9128e5eeba6e
    title: 5. Critic ja Feedback — vastuut
    level: software-design
    description: Nykyiseen arkkitehtuuriin sidottu vastuumalli. Kehys kuvaa nykyistä vastuualueen rajaa, ei ehdotusta uudeksi palveluksi tai bounded context -jaoksi.
    sourceBoardId: ba0bdc02-5d4b-425d-8d0a-3a38f9d99489
    placements:
      - id: 05dd9e24-d463-413b-a3e8-0b96aecce328
        noteId: a410e4bc-718e-4296-9a26-d0d21f5bc602
        x: 920
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: 2abb4470-09eb-47fd-81b0-5c5b2458a543
        noteId: 848ceaee-00d2-4a93-ad01-2355222c6c4b
        x: 450
        y: 70
        width: 224
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: 2fae5ec1-7d8d-4c2f-bbab-13249acfbfe2
        noteId: 4a36dd61-b15a-4f97-a5aa-fbeea2703b33
        x: 640
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: 5439aba4-2dd5-423b-a03b-b2ad426ee848
        noteId: 31d161b4-46f0-4cd4-a1c5-fcdb58cb3e0c
        x: 80
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: 56b29033-73b7-4d5f-a3f0-7e4c32b79378
        noteId: 9647dd59-3438-4565-bb0b-6cf0b9310995
        x: 80
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: 5b32253a-a529-4b9b-896f-88b03e9de511
        noteId: a890f62f-43e9-483c-9d4c-1e35f95e53c6
        x: 100
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: 63396a8c-161b-41b7-a50d-1cfb20eb5e7c
        noteId: 17798111-31e0-42db-abb9-837514389bdb
        x: 920
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: 6a679166-4245-469f-a433-c03c6ae53f9e
        noteId: 17e9acde-3e2e-4c8a-84f7-0aa7ed5b6eab
        x: 1200
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: 84382ee8-2abb-452f-89dc-de5412e57ebe
        noteId: f1cd5dbd-a603-4ce8-b76e-a9747c26e06e
        x: 740
        y: 1030
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: 89a05a29-b932-45e8-aa90-e08149596537
        noteId: f4206cda-7f79-4951-8be6-5bc5c0803e18
        x: 1030
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: b3254e52-cbdc-4d9c-a89e-aada593fc5c1
        noteId: 34d69e17-928b-4421-a19e-7215469d67b7
        x: 360
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: d4aba46d-2fc0-49e4-8d65-eaefe5cd4f32
        noteId: a6cad801-8cb2-47f5-bd71-d5b80797a0f1
        x: 360
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: dac5a8ce-7243-4ea1-aa7b-272d8032e83e
        noteId: 6d0c6346-ec46-49d6-ba80-0aaf0c6e6848
        x: 1200
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: eefc4b2a-a417-4bdb-a9e3-17d695a89b39
        noteId: 0fd41b9e-82f5-49e7-bb1a-ce41f76a2ff7
        x: 740
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
      - id: f05b20e7-b618-41a0-950a-2724bc765432
        noteId: 6cef2975-04c4-4565-b09f-16f30774ce39
        x: 640
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: e936bc89-e6a7-4c37-83a3-118b36b62b02
    connections:
      - id: 0fd4f52b-c78d-4274-b03a-f3cd792d5a26
        source: 2fae5ec1-7d8d-4c2f-bbab-13249acfbfe2
        target: eefc4b2a-a417-4bdb-a9e3-17d695a89b39
        label: komennon omistus
      - id: 1995da36-5319-49c9-a323-62ee208e1500
        source: 05dd9e24-d463-413b-a3e8-0b96aecce328
        target: eefc4b2a-a417-4bdb-a9e3-17d695a89b39
        label: komennon omistus
      - id: 22309d4b-9a49-41af-9d83-994cd3c30765
        source: dac5a8ce-7243-4ea1-aa7b-272d8032e83e
        target: 6a679166-4245-469f-a433-c03c6ae53f9e
        label: tulos
      - id: 31e4ec9e-4057-4a0e-991f-6f033278684d
        source: 5439aba4-2dd5-423b-a03b-b2ad426ee848
        target: 56b29033-73b7-4d5f-a3f0-7e4c32b79378
        label: tulos
      - id: 3e334e7e-8055-4d24-ab31-1c9b676718aa
        source: 56b29033-73b7-4d5f-a3f0-7e4c32b79378
        target: 89a05a29-b932-45e8-aa90-e08149596537
        label: luettava fakta
      - id: 4b1c8e13-3d12-4d39-bd78-b92a9ef66196
        source: d4aba46d-2fc0-49e4-8d65-eaefe5cd4f32
        target: b3254e52-cbdc-4d9c-a89e-aada593fc5c1
        label: tulos
      - id: 505250d2-0aff-4f9f-b226-c272a2617ab4
        source: b3254e52-cbdc-4d9c-a89e-aada593fc5c1
        target: 89a05a29-b932-45e8-aa90-e08149596537
        label: luettava fakta
      - id: 6d5d1b8f-6ac7-458f-b911-c7f4612e1f2f
        source: 6a679166-4245-469f-a433-c03c6ae53f9e
        target: 89a05a29-b932-45e8-aa90-e08149596537
        label: luettava fakta
      - id: 85c6679a-67b3-46e8-9953-89df805495ac
        source: eefc4b2a-a417-4bdb-a9e3-17d695a89b39
        target: 84382ee8-2abb-452f-89dc-de5412e57ebe
        label: invariantin estämä polku
      - id: 974bbf35-d653-425a-9994-75f83622d428
        source: 5439aba4-2dd5-423b-a03b-b2ad426ee848
        target: eefc4b2a-a417-4bdb-a9e3-17d695a89b39
        label: komennon omistus
      - id: a076485a-a90c-436d-83a3-eb1516ad280b
        source: f05b20e7-b618-41a0-950a-2724bc765432
        target: 89a05a29-b932-45e8-aa90-e08149596537
        label: luettava fakta
      - id: a479c201-737d-4f97-91f4-6b4db81e47c2
        source: dac5a8ce-7243-4ea1-aa7b-272d8032e83e
        target: eefc4b2a-a417-4bdb-a9e3-17d695a89b39
        label: komennon omistus
      - id: ac67ae5c-b83d-48b6-9e36-1b3ffa045b07
        source: 2fae5ec1-7d8d-4c2f-bbab-13249acfbfe2
        target: f05b20e7-b618-41a0-950a-2724bc765432
        label: tulos
      - id: ad07e622-e8cd-4688-9628-169493930370
        source: d4aba46d-2fc0-49e4-8d65-eaefe5cd4f32
        target: eefc4b2a-a417-4bdb-a9e3-17d695a89b39
        label: komennon omistus
      - id: af694a63-a896-4e23-8702-5d9fcdc6a70d
        source: 5b32253a-a529-4b9b-896f-88b03e9de511
        target: eefc4b2a-a417-4bdb-a9e3-17d695a89b39
        label: rajoittaa
      - id: c28f7cb2-0bf6-46dc-9e3a-0597f96649bb
        source: eefc4b2a-a417-4bdb-a9e3-17d695a89b39
        target: 89a05a29-b932-45e8-aa90-e08149596537
        label: projisoidaan
      - id: d2787c9b-59f0-48a5-a0a4-c34dfb9e9e8f
        source: 05dd9e24-d463-413b-a3e8-0b96aecce328
        target: 63396a8c-161b-41b7-a50d-1cfb20eb5e7c
        label: tulos
      - id: d5ea9876-fe25-4924-b40d-81e3620729f8
        source: 2abb4470-09eb-47fd-81b0-5c5b2458a543
        target: eefc4b2a-a417-4bdb-a9e3-17d695a89b39
        label: käsittelee
      - id: d9dc7659-df51-4216-925a-67611837e4a5
        source: 63396a8c-161b-41b7-a50d-1cfb20eb5e7c
        target: 89a05a29-b932-45e8-aa90-e08149596537
        label: luettava fakta
    frames:
      - id: e936bc89-e6a7-4c37-83a3-118b36b62b02
        title: Critic ja Feedback
        kind: bounded-context
        x: 0
        y: 0
        width: 1550
        height: 1300
  - id: 57a098ff-f0ee-4398-adc4-43a1b09ceb92
    title: 2. Projektimääritys ja Action Agentit — vastuut
    level: software-design
    description: Nykyiseen arkkitehtuuriin sidottu vastuumalli. Kehys kuvaa nykyistä vastuualueen rajaa, ei ehdotusta uudeksi palveluksi tai bounded context -jaoksi.
    sourceBoardId: c8d2c75c-a2e3-4197-a69f-7a5f6cc281a8
    placements:
      - id: 254e33d4-8b63-4f12-88b7-d3f600a51a05
        noteId: d3504513-4afc-4083-af6c-0c7021081734
        x: 640
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: 3e5d5727-32a2-4cac-89ca-6ea7c2bf9971
        noteId: 234ee251-b5a9-4f13-bd84-5c2e625a7a0d
        x: 80
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: 57b15213-f2db-4c3b-b524-2399741b3cdb
        noteId: 12f2a569-a086-4054-ab25-e4bd5a7b10de
        x: 1200
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: 5b8788a5-0b24-46da-b3d7-7a3edc7997ff
        noteId: 682cf189-d5cf-4fbf-bdb3-d83b1a0a3d93
        x: 920
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: 5fee5d43-c6f8-4695-ba51-a22449b89ae8
        noteId: 76a1859e-7423-4d48-a2d8-2eb12189dbda
        x: 740
        y: 1030
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: 6e73d5d1-9e2f-4f41-9fac-cdcbc588fea7
        noteId: 6595c7af-5104-40f5-bd21-93860a77f1d7
        x: 1030
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: 79ddbe0d-8214-493e-b7c2-5df3e281d1a6
        noteId: bfa7a70d-0fe7-4905-8eef-3f0fd57178f4
        x: 80
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: 8d02da9f-3efd-43c4-baae-0ba01f9fe5d7
        noteId: 6fae5808-9886-4d2a-a71a-d087849d8abc
        x: 920
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: 94a892ff-47fe-4d5b-b009-1c29f125ee85
        noteId: 51f7ba7d-de7c-4fb7-9c61-740fabb56f42
        x: 360
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: 984db572-6ef5-4e71-8e0a-096d99139e7b
        noteId: 75ab8bc7-b9b7-43d7-8ef8-387c152d2b30
        x: 740
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: 9b7a8d27-989a-416f-baa5-ab4af71614cd
        noteId: a51f2fb0-6180-4bed-8bf1-1f7ea415d8c7
        x: 100
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: abbd07dd-e265-49fb-afa8-f4efdb49c812
        noteId: 4e062061-7908-4663-9033-bae9304a869e
        x: 1200
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: b2184b3b-e4ab-4454-9757-3216b35d9388
        noteId: c8a1a71c-acae-4288-bf53-42ab58c1885c
        x: 360
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: bebfd57c-e9dc-4263-b0c5-0b1c0820e465
        noteId: 1b1e7486-5055-4f80-90fb-3b00040cedf6
        x: 450
        y: 70
        width: 224
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
      - id: dc6897ff-4773-40b6-982d-8023ff1204dc
        noteId: da56eac4-b164-4bd1-b1fb-ab1eb75f572b
        x: 640
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 63fbc438-eb29-4ca5-9314-e69d65b18038
    connections:
      - id: 1142047c-36e2-4767-a883-d30aff1726f8
        source: 94a892ff-47fe-4d5b-b009-1c29f125ee85
        target: 6e73d5d1-9e2f-4f41-9fac-cdcbc588fea7
        label: luettava fakta
      - id: 183aa80f-a8e0-45e0-a445-dd5b793f2787
        source: 984db572-6ef5-4e71-8e0a-096d99139e7b
        target: 5fee5d43-c6f8-4695-ba51-a22449b89ae8
        label: invariantin estämä polku
      - id: 229d813b-0c76-4907-ab78-4a031bf01d99
        source: bebfd57c-e9dc-4263-b0c5-0b1c0820e465
        target: 984db572-6ef5-4e71-8e0a-096d99139e7b
        label: käsittelee
      - id: 2c87ed89-7a78-4619-8a55-1eb99c097bb4
        source: b2184b3b-e4ab-4454-9757-3216b35d9388
        target: 94a892ff-47fe-4d5b-b009-1c29f125ee85
        label: tulos
      - id: 5e199ad9-a53f-46f3-9125-841780e7f9e7
        source: abbd07dd-e265-49fb-afa8-f4efdb49c812
        target: 6e73d5d1-9e2f-4f41-9fac-cdcbc588fea7
        label: luettava fakta
      - id: 6d59f981-0632-4b6e-8a5c-7c599cb6864a
        source: 5b8788a5-0b24-46da-b3d7-7a3edc7997ff
        target: 6e73d5d1-9e2f-4f41-9fac-cdcbc588fea7
        label: luettava fakta
      - id: 73919ec9-b953-42f0-96dd-514d05b7793a
        source: 9b7a8d27-989a-416f-baa5-ab4af71614cd
        target: 984db572-6ef5-4e71-8e0a-096d99139e7b
        label: rajoittaa
      - id: 7c50364a-b4a2-4cb8-b1ce-1e148658bbc0
        source: 79ddbe0d-8214-493e-b7c2-5df3e281d1a6
        target: 6e73d5d1-9e2f-4f41-9fac-cdcbc588fea7
        label: luettava fakta
      - id: 8eee4a03-5e54-4fe0-9506-b7b732d19136
        source: 8d02da9f-3efd-43c4-baae-0ba01f9fe5d7
        target: 984db572-6ef5-4e71-8e0a-096d99139e7b
        label: komennon omistus
      - id: 9ab5a824-0866-441e-a56b-d1e2138775d1
        source: 984db572-6ef5-4e71-8e0a-096d99139e7b
        target: 6e73d5d1-9e2f-4f41-9fac-cdcbc588fea7
        label: projisoidaan
      - id: a53e1c6f-d4aa-4b80-97b9-71fe5298dd5f
        source: dc6897ff-4773-40b6-982d-8023ff1204dc
        target: 254e33d4-8b63-4f12-88b7-d3f600a51a05
        label: tulos
      - id: a580e61a-f08d-4a9c-bce9-a5d4d48395d3
        source: 3e5d5727-32a2-4cac-89ca-6ea7c2bf9971
        target: 984db572-6ef5-4e71-8e0a-096d99139e7b
        label: komennon omistus
      - id: aaf62dde-8950-4a7d-aefa-28b960dc5b0a
        source: b2184b3b-e4ab-4454-9757-3216b35d9388
        target: 984db572-6ef5-4e71-8e0a-096d99139e7b
        label: komennon omistus
      - id: b00bd0a7-1584-4b2b-a445-3cbbc865ab32
        source: 3e5d5727-32a2-4cac-89ca-6ea7c2bf9971
        target: 79ddbe0d-8214-493e-b7c2-5df3e281d1a6
        label: tulos
      - id: b9161656-f939-4d9e-bb77-992e97b9f4ff
        source: 57b15213-f2db-4c3b-b524-2399741b3cdb
        target: 984db572-6ef5-4e71-8e0a-096d99139e7b
        label: komennon omistus
      - id: c45d119e-4de2-4a04-9587-9cb614e01872
        source: 254e33d4-8b63-4f12-88b7-d3f600a51a05
        target: 6e73d5d1-9e2f-4f41-9fac-cdcbc588fea7
        label: luettava fakta
      - id: d756081f-f7ac-4c6e-b34a-b561cbd42682
        source: 57b15213-f2db-4c3b-b524-2399741b3cdb
        target: abbd07dd-e265-49fb-afa8-f4efdb49c812
        label: tulos
      - id: dd9f1d4d-0dcf-4222-bcae-81bdb485faf6
        source: dc6897ff-4773-40b6-982d-8023ff1204dc
        target: 984db572-6ef5-4e71-8e0a-096d99139e7b
        label: komennon omistus
      - id: e5ef2156-e683-44d3-accd-c6335e15ece2
        source: 8d02da9f-3efd-43c4-baae-0ba01f9fe5d7
        target: 5b8788a5-0b24-46da-b3d7-7a3edc7997ff
        label: tulos
    frames:
      - id: 63fbc438-eb29-4ca5-9314-e69d65b18038
        title: Projektimääritys ja Action Agentit
        kind: bounded-context
        x: 0
        y: 0
        width: 1550
        height: 1300
  - id: 598ff734-ac7f-47f6-bd92-2fc73cdf6e88
    title: 3. Validation, Work ja Run Evidence
    level: process-modelling
    description: Dokumentoidun prosessin komennot, tapahtumat, toimija, säännöt ja poikkeuspolut. Yhteydet kuvaavat ehtoja, eivät alustan uusia kontrollikomentoja.
    sourceBoardId: 09eee978-fa50-4df9-8b3c-7ed65a9f55ba
    placements:
      - id: 0e3cd332-ef16-44cc-b50d-943db94d47ce
        noteId: a6832bac-f5bf-4304-a22d-ba3b3324594d
        x: 490
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: 2fa38f01-27e8-4287-a34d-08dddc8903f4
        noteId: f8c3f921-3751-4062-a914-c842bae9b245
        x: 490
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: 37a0bfdf-ec6a-4f40-adf5-91969e18af0b
        noteId: a8179a54-f7de-49a6-bd4a-76cd5e9429b1
        x: 40
        y: 650
        width: 224
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: 4487c01b-d37e-484e-b166-bcea8920a74e
        noteId: c322601e-8254-4887-b45e-75c2ba85209a
        x: 1240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: 4c36c070-5075-4aca-84d5-71b6e94cc71f
        noteId: 2e58932c-651e-47f8-a154-ada552103c93
        x: 240
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: 723b6b3c-1df2-41eb-bfac-02ae3579dc83
        noteId: 146517d0-fd1f-4499-a7a2-291495196292
        x: 990
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: 72677c49-07f4-443c-ae5f-241aab91fbce
        noteId: 9f76de14-e2f6-4d1d-95f9-451fdfb4ae24
        x: 1240
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: 735f27f1-ae5b-4b87-9ad8-d3acc21a469c
        noteId: 60dcc297-331c-469b-bb1e-f0f2f3d4fedb
        x: 490
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: 7bb247ed-e568-4110-9707-8e91fc310761
        noteId: 0c7f7560-c960-4673-8197-ce97a4676099
        x: 240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: 911f81f6-eb82-43f8-832c-6a290376b07c
        noteId: 8c938689-4c24-4ed8-8439-8c3a4926907a
        x: 990
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: a18ae090-07b5-4394-9085-69be571d584f
        noteId: 904583b6-990f-41ae-b533-e8e9ec41b4e5
        x: 990
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: abe5ac1a-8469-44f1-98b9-bd3000a76676
        noteId: a5b3bfeb-359b-4cc1-bd82-97a5cb71a7bb
        x: 740
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: b5fad18b-f2b8-46a6-8454-0bbccc537997
        noteId: 5d869ff5-5a7a-401a-8617-61568d049ba4
        x: 1700
        y: 80
        width: 184
        height: 208
        pivotal: false
      - id: c8dd3556-a51e-4aca-bb83-e29e8045adb9
        noteId: 461dd592-012c-4666-bbdf-7137aef823a9
        x: 1700
        y: 360
        width: 184
        height: 208
        pivotal: false
      - id: e10e8f50-3ffc-42ec-9b4b-b9f344607a14
        noteId: 21191eee-61b5-45e6-9d6d-da34a847485e
        x: 1240
        y: 360
        width: 184
        height: 208
        pivotal: true
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: ee0c2228-639e-4619-ae75-b2188cc0fa3f
        noteId: 2db34c15-5434-4e22-81a4-74c0686969e5
        x: 40
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
      - id: f4c14313-201f-498b-83c5-d9dd3b0519a7
        noteId: 47d3e227-9eaa-4f49-bd62-edf3a5ebe947
        x: 740
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 68e91929-0ebb-4d8c-99d1-4b34b7516453
    connections:
      - id: 0a6b0c6e-8232-4c1c-a16a-3fe34a567db7
        source: ee0c2228-639e-4619-ae75-b2188cc0fa3f
        target: 7bb247ed-e568-4110-9707-8e91fc310761
        label: aloittaa
      - id: 390a3f3d-2e7c-4bdc-954a-4d769e46bdfc
        source: 0e3cd332-ef16-44cc-b50d-943db94d47ce
        target: a18ae090-07b5-4394-9085-69be571d584f
        label: esto tai poikkeus
      - id: 45f69d80-5045-48ea-a90a-60306d94a805
        source: 735f27f1-ae5b-4b87-9ad8-d3acc21a469c
        target: a18ae090-07b5-4394-9085-69be571d584f
        label: "blocked: ei Workia"
      - id: 596754e6-7ce7-414c-b706-fef09ee2df6b
        source: f4c14313-201f-498b-83c5-d9dd3b0519a7
        target: 0e3cd332-ef16-44cc-b50d-943db94d47ce
        label: sääntö
      - id: 5a3c1b66-54b6-4b20-9248-1089a77a093f
        source: abe5ac1a-8469-44f1-98b9-bd3000a76676
        target: f4c14313-201f-498b-83c5-d9dd3b0519a7
        label: tuottaa
      - id: 5cf0bb9b-c09e-4c4a-a357-74b44104f505
        source: 723b6b3c-1df2-41eb-bfac-02ae3579dc83
        target: abe5ac1a-8469-44f1-98b9-bd3000a76676
        label: "retry: budjettia jäljellä"
      - id: 6e8dd5fc-5924-4a22-9178-fbe926222312
        source: 911f81f6-eb82-43f8-832c-6a290376b07c
        target: 723b6b3c-1df2-41eb-bfac-02ae3579dc83
        label: tuottaa
      - id: 7da9aac5-9983-4386-9bdf-ef3dda6c3740
        source: 4487c01b-d37e-484e-b166-bcea8920a74e
        target: e10e8f50-3ffc-42ec-9b4b-b9f344607a14
        label: tuottaa
      - id: 83440366-a068-4630-904a-8b92ed7a2d6f
        source: a18ae090-07b5-4394-9085-69be571d584f
        target: 72677c49-07f4-443c-ae5f-241aab91fbce
        label: tuottaa
      - id: 84ebb4eb-12b5-4705-8b5e-2f813f22e3b4
        source: 723b6b3c-1df2-41eb-bfac-02ae3579dc83
        target: a18ae090-07b5-4394-9085-69be571d584f
        label: blocked tai retry-budjetti loppui
      - id: 859d8cb4-48d1-411d-9596-9d9254a2f722
        source: f4c14313-201f-498b-83c5-d9dd3b0519a7
        target: 911f81f6-eb82-43f8-832c-6a290376b07c
        label: jatkoehdon täyttyessä
      - id: 8795629f-9198-4179-9260-787f702bcf13
        source: 723b6b3c-1df2-41eb-bfac-02ae3579dc83
        target: 4487c01b-d37e-484e-b166-bcea8920a74e
        label: jatkoehdon täyttyessä
      - id: 898b93dc-c3d5-45cf-a604-dd973ca43d39
        source: 735f27f1-ae5b-4b87-9ad8-d3acc21a469c
        target: abe5ac1a-8469-44f1-98b9-bd3000a76676
        label: jatkoehdon täyttyessä
      - id: 9be215c9-1d99-4d71-a599-be418f8e0ef8
        source: 2fa38f01-27e8-4287-a34d-08dddc8903f4
        target: 735f27f1-ae5b-4b87-9ad8-d3acc21a469c
        label: tuottaa
      - id: ab3792d8-cf81-49c5-9791-1eec68fb6f7c
        source: e10e8f50-3ffc-42ec-9b4b-b9f344607a14
        target: 37a0bfdf-ec6a-4f40-adf5-91969e18af0b
        label: näytetään
      - id: bcc01960-a6f7-43fe-8657-c648033ee7e2
        source: b5fad18b-f2b8-46a6-8454-0bbccc537997
        target: c8dd3556-a51e-4aca-bb83-e29e8045adb9
        label: kelvollinen komento
      - id: d164e0e0-6f46-411a-a48c-7c3edf5488b9
        source: 4c36c070-5075-4aca-84d5-71b6e94cc71f
        target: 2fa38f01-27e8-4287-a34d-08dddc8903f4
        label: jatkoehdon täyttyessä
      - id: d39fa55c-a3bb-4b28-839b-302245d4a8f7
        source: 7bb247ed-e568-4110-9707-8e91fc310761
        target: 4c36c070-5075-4aca-84d5-71b6e94cc71f
        label: tuottaa
      - id: fb082573-ccf7-434c-b9be-b630d59ea166
        source: 735f27f1-ae5b-4b87-9ad8-d3acc21a469c
        target: 4487c01b-d37e-484e-b166-bcea8920a74e
        label: "done: kaikki Actionit valmiit"
    frames:
      - id: 68e91929-0ebb-4d8c-99d1-4b34b7516453
        title: Validation, Work ja Run Evidence
        kind: process
        x: 0
        y: 0
        width: 1550
        height: 1040
  - id: 74f22c5a-3ae7-4184-bf95-4e69368c586d
    title: 4. Paikallinen palvelu, daemon ja jakelu
    level: process-modelling
    description: Dokumentoidun prosessin komennot, tapahtumat, toimija, säännöt ja poikkeuspolut. Yhteydet kuvaavat ehtoja, eivät alustan uusia kontrollikomentoja.
    sourceBoardId: 09eee978-fa50-4df9-8b3c-7ed65a9f55ba
    placements:
      - id: 0f540cfc-4c07-460a-8e57-dc8bcbe5c0e2
        noteId: d183b59d-fe0a-47db-9801-4c2097f01925
        x: 1700
        y: 360
        width: 184
        height: 208
        pivotal: false
      - id: 1c4bcf03-d9b5-470a-9c9d-1c77b3702755
        noteId: 0a36fef4-cef8-4175-b656-c5ec384faf21
        x: 1240
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: 1fb6c41d-e925-4cf2-9785-18b9ad7e04df
        noteId: ca83c128-9d26-4a4c-896f-365e2b1879eb
        x: 40
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: 250209bb-4e6c-4be7-b7d0-3d9640ef9168
        noteId: b5e3fe45-0681-44e3-85a5-faf785413681
        x: 490
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: 647e107c-e20a-46df-ae05-838a8ee231ac
        noteId: 120df932-7ea8-499b-ba30-d36cbe2397fc
        x: 740
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: 66ecbc69-b221-4ef7-bdcd-beb6db9dce84
        noteId: fd797518-322f-4e4f-b826-8dda32ee44dd
        x: 990
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: 79046570-69ec-441e-ab70-bf3f4e78c053
        noteId: 9f71dcf2-cdf8-49ba-963f-514a3b5c9f1f
        x: 990
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: 954f44d6-59ed-4822-b015-c9e8c29fdc73
        noteId: 44dd5316-4b59-4ac7-8a7e-403ff228fb0a
        x: 490
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: 9a15417b-b8e3-47a0-8f2b-2230e8abd43d
        noteId: 691bc275-4506-4dec-a900-584a3851e4be
        x: 40
        y: 650
        width: 224
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: a4256f72-7158-495b-9c79-8b9cf4d1337f
        noteId: 9690f5de-9d1e-480e-bda7-75789d5f48e1
        x: 240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: ac51cf79-6c93-4624-b5fb-dd1c787a79f3
        noteId: 8389f28c-9bc9-48f9-84ed-b61cfbd13c4d
        x: 1240
        y: 360
        width: 184
        height: 208
        pivotal: true
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: b43e0a55-39e1-422d-8441-50c81c019e91
        noteId: a768e1f5-f597-412f-b30d-c1203902c0aa
        x: 990
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: bd85a76b-5976-452d-afdf-2069ff1aaa1a
        noteId: f44d5345-7471-44f6-8000-e2f9c9f7a43c
        x: 490
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: bde5fa7f-75ac-402a-9e62-35b8572c5ee3
        noteId: 0d322dfa-61c9-4541-bf34-bd958eadbf1d
        x: 740
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: c791763b-eb4f-4ad1-a668-1389aae1f351
        noteId: 022ca7ef-9193-48bf-a076-89591fad5ff4
        x: 1240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
      - id: cdbdd49d-bfc9-4126-8b59-f6e7d1d7e756
        noteId: 81f93d10-9743-49fb-93fc-9e4eebb9ec0e
        x: 1700
        y: 80
        width: 184
        height: 208
        pivotal: false
      - id: e175d159-9f6b-431f-b25e-4a61af720813
        noteId: d18c5f7a-ca31-40fb-a736-3d4e6b4f0502
        x: 240
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: bde79969-710d-4eca-8cea-46fd62d279cb
    connections:
      - id: 03b6cabf-972a-41fa-9725-81c727b48b6f
        source: 647e107c-e20a-46df-ae05-838a8ee231ac
        target: 66ecbc69-b221-4ef7-bdcd-beb6db9dce84
        label: jatkoehdon täyttyessä
      - id: 11b4f168-e173-4105-be53-619bbc4f94ce
        source: 1fb6c41d-e925-4cf2-9785-18b9ad7e04df
        target: a4256f72-7158-495b-9c79-8b9cf4d1337f
        label: aloittaa
      - id: 18057191-0651-452e-ba49-ec50699a6d53
        source: 647e107c-e20a-46df-ae05-838a8ee231ac
        target: bd85a76b-5976-452d-afdf-2069ff1aaa1a
        label: sääntö
      - id: 1e7ed9aa-a2ed-450b-b19f-65415fd1ca1c
        source: bde5fa7f-75ac-402a-9e62-35b8572c5ee3
        target: 647e107c-e20a-46df-ae05-838a8ee231ac
        label: tuottaa
      - id: 40bd401b-5139-42a0-bbd0-a4b458a3bf32
        source: 79046570-69ec-441e-ab70-bf3f4e78c053
        target: 1c4bcf03-d9b5-470a-9c9d-1c77b3702755
        label: tuottaa
      - id: 739554a5-25b8-4fe7-9366-f81e144614e1
        source: 66ecbc69-b221-4ef7-bdcd-beb6db9dce84
        target: b43e0a55-39e1-422d-8441-50c81c019e91
        label: tuottaa
      - id: 7c02e1a4-8a99-46f4-ab87-b8e0b64f8870
        source: cdbdd49d-bfc9-4126-8b59-f6e7d1d7e756
        target: 0f540cfc-4c07-460a-8e57-dc8bcbe5c0e2
        label: kelvollinen komento
      - id: a6128fe7-4b58-4cb9-b755-d9e1def5558f
        source: 250209bb-4e6c-4be7-b7d0-3d9640ef9168
        target: 954f44d6-59ed-4822-b015-c9e8c29fdc73
        label: tuottaa
      - id: d0b3d3d0-430f-4bee-a0e0-d69d9f7d91bf
        source: 954f44d6-59ed-4822-b015-c9e8c29fdc73
        target: bde5fa7f-75ac-402a-9e62-35b8572c5ee3
        label: jatkoehdon täyttyessä
      - id: d3059e57-5dfc-47c7-8da2-88450064c054
        source: e175d159-9f6b-431f-b25e-4a61af720813
        target: 250209bb-4e6c-4be7-b7d0-3d9640ef9168
        label: jatkoehdon täyttyessä
      - id: d568691f-ebac-4d71-9022-1e63eddf0f8c
        source: a4256f72-7158-495b-9c79-8b9cf4d1337f
        target: e175d159-9f6b-431f-b25e-4a61af720813
        label: tuottaa
      - id: d68db8cb-1835-4a9a-a17d-95d781627a0b
        source: c791763b-eb4f-4ad1-a668-1389aae1f351
        target: ac51cf79-6c93-4624-b5fb-dd1c787a79f3
        label: tuottaa
      - id: dd9bed58-a505-41eb-a4f4-cfdab76315dc
        source: bd85a76b-5976-452d-afdf-2069ff1aaa1a
        target: 79046570-69ec-441e-ab70-bf3f4e78c053
        label: esto tai poikkeus
      - id: ede24ed8-0c8d-45e2-bd71-b5e9d3be20a5
        source: ac51cf79-6c93-4624-b5fb-dd1c787a79f3
        target: 9a15417b-b8e3-47a0-8f2b-2230e8abd43d
        label: näytetään
      - id: fa8544cb-1c8a-4d24-bd30-79c38104488b
        source: b43e0a55-39e1-422d-8441-50c81c019e91
        target: c791763b-eb4f-4ad1-a668-1389aae1f351
        label: jatkoehdon täyttyessä
    frames:
      - id: bde79969-710d-4eca-8cea-46fd62d279cb
        title: Paikallinen palvelu, daemon ja jakelu
        kind: process
        x: 0
        y: 0
        width: 1550
        height: 1040
  - id: 8319f5a8-4263-483e-b027-83bb1c082406
    title: 1. Projektisisältö ja tarinoiden hyväksyntä
    level: process-modelling
    description: Dokumentoidun prosessin komennot, tapahtumat, toimija, säännöt ja poikkeuspolut. Yhteydet kuvaavat ehtoja, eivät alustan uusia kontrollikomentoja.
    sourceBoardId: 09eee978-fa50-4df9-8b3c-7ed65a9f55ba
    placements:
      - id: 03fef151-5d31-443c-a93f-577961c8bcb5
        noteId: 1c13c4a4-7da1-4e9f-a738-ff211c918085
        x: 1240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: 1f239872-516d-4b13-bb4b-1a3bb51e9012
        noteId: fba97b32-b1e8-4d77-b850-44e30151d802
        x: 40
        y: 650
        width: 224
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: 61e29a82-76ac-44da-877b-64171cfb7804
        noteId: b70a0c86-8cd3-4772-a3ea-5e8e63d20e50
        x: 490
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: 6d717025-6ddd-4650-b57d-eccfbf1bd1e3
        noteId: 932e3055-2781-4d9e-97be-1d87c0cd7c04
        x: 1240
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: 8baed908-a010-4214-8a9a-b5bb8fc57ada
        noteId: 5fdfc058-2cdb-42cb-974f-d227c1255281
        x: 990
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: 8c8431ab-bac9-45f8-84cf-920ecbd3c574
        noteId: a6e46ead-cfd4-4580-a03f-98b3cb51017a
        x: 490
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: 95358baf-d737-4ae3-9f01-e7a9e998f172
        noteId: 0c385d44-c5ae-4e7b-a136-5706c1683292
        x: 1240
        y: 360
        width: 184
        height: 208
        pivotal: true
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: a131b092-597b-4a22-8aa5-25d840a4999c
        noteId: dd63a167-758d-45f8-8236-9eb82085bf0a
        x: 990
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: ccdf9912-28a0-49db-a9e0-04005965643b
        noteId: c6ad6caf-ac9d-4031-8d0f-93e3874b1c37
        x: 240
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: ce20215f-4a95-4ecf-b0a9-dc49b4340f69
        noteId: e72c51cc-3a6e-405f-be35-de8445371b75
        x: 40
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: e28dc29f-d369-492f-8710-0e5fc4bc4dea
        noteId: 8885ea91-05d5-4338-ba9b-b3f46f3371a0
        x: 740
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: eca2020f-18cb-41be-a1b8-a436b3cfb003
        noteId: 7b106a6f-746d-4f5e-916c-f3155c229fbf
        x: 240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: ef1b2486-4826-465a-b89b-d88ce051299e
        noteId: 231d1ba3-d86e-4ec5-953c-81ca945987bf
        x: 490
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: f1ca9a72-e979-47ae-877b-59e6725aecfc
        noteId: 62314b7b-f14c-42d3-ae0e-4a7d443563ed
        x: 990
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
      - id: fe236363-9aaf-462d-85a1-dbe829860efa
        noteId: f9295d71-aa62-43bf-ad03-f86225679e50
        x: 740
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: b9aa8174-afb8-482d-85c5-bd698620f03f
    connections:
      - id: 0d044aa5-808b-4cdf-8d6c-ca7316f9382a
        source: 8baed908-a010-4214-8a9a-b5bb8fc57ada
        target: 03fef151-5d31-443c-a93f-577961c8bcb5
        label: seuraava määrittelyvaihe
      - id: 134547e4-d314-40de-8446-3eba484030f4
        source: ce20215f-4a95-4ecf-b0a9-dc49b4340f69
        target: eca2020f-18cb-41be-a1b8-a436b3cfb003
        label: aloittaa
      - id: 16f64f97-f486-4e88-b21d-5aa4c9fd9d1a
        source: e28dc29f-d369-492f-8710-0e5fc4bc4dea
        target: fe236363-9aaf-462d-85a1-dbe829860efa
        label: tuottaa
      - id: 304b4b28-cee1-4d04-9d8a-61ff421613b1
        source: a131b092-597b-4a22-8aa5-25d840a4999c
        target: 8baed908-a010-4214-8a9a-b5bb8fc57ada
        label: tuottaa
      - id: 42451b05-0f99-41de-a81d-41a6b6b586ad
        source: fe236363-9aaf-462d-85a1-dbe829860efa
        target: a131b092-597b-4a22-8aa5-25d840a4999c
        label: seuraava määrittelyvaihe
      - id: 45dfdf20-68c4-43e0-a82c-15c1e28bbd15
        source: 8c8431ab-bac9-45f8-84cf-920ecbd3c574
        target: e28dc29f-d369-492f-8710-0e5fc4bc4dea
        label: seuraava määrittelyvaihe
      - id: 5dbac26d-a5f3-43ef-8596-9ca22a9f7763
        source: f1ca9a72-e979-47ae-877b-59e6725aecfc
        target: 6d717025-6ddd-4650-b57d-eccfbf1bd1e3
        label: tuottaa
      - id: 974a8642-11a9-4c23-b161-4255b77fa427
        source: 61e29a82-76ac-44da-877b-64171cfb7804
        target: f1ca9a72-e979-47ae-877b-59e6725aecfc
        label: esto tai poikkeus
      - id: ca24b03c-761b-49c2-b52d-40e0ddd6fd87
        source: eca2020f-18cb-41be-a1b8-a436b3cfb003
        target: ccdf9912-28a0-49db-a9e0-04005965643b
        label: tuottaa
      - id: cf2318d6-03ca-4cdf-b920-204167a39be2
        source: fe236363-9aaf-462d-85a1-dbe829860efa
        target: 61e29a82-76ac-44da-877b-64171cfb7804
        label: sääntö
      - id: d814da7d-bdb4-4c56-aab5-e0dc8ccd6d94
        source: ccdf9912-28a0-49db-a9e0-04005965643b
        target: ef1b2486-4826-465a-b89b-d88ce051299e
        label: seuraava määrittelyvaihe
      - id: eb6008ea-850c-4f19-ae3f-f0f38ce44ee0
        source: 95358baf-d737-4ae3-9f01-e7a9e998f172
        target: 1f239872-516d-4b13-bb4b-1a3bb51e9012
        label: näytetään
      - id: fc886682-af8a-4762-8dc6-c066991546df
        source: 03fef151-5d31-443c-a93f-577961c8bcb5
        target: 95358baf-d737-4ae3-9f01-e7a9e998f172
        label: tuottaa
      - id: fe4f31a9-5337-426e-9000-ce1b1e3caa67
        source: ef1b2486-4826-465a-b89b-d88ce051299e
        target: 8c8431ab-bac9-45f8-84cf-920ecbd3c574
        label: tuottaa
    frames:
      - id: b9aa8174-afb8-482d-85c5-bd698620f03f
        title: Projektisisältö ja tarinoiden hyväksyntä
        kind: process
        x: 0
        y: 0
        width: 1550
        height: 1040
  - id: 85f829ff-ccf0-41a2-804f-f06406a327e6
    title: 3. Runtime ja finalisointi — vastuut
    level: software-design
    description: Nykyiseen arkkitehtuuriin sidottu vastuumalli. Kehys kuvaa nykyistä vastuualueen rajaa, ei ehdotusta uudeksi palveluksi tai bounded context -jaoksi.
    sourceBoardId: 598ff734-ac7f-47f6-bd92-2fc73cdf6e88
    placements:
      - id: 1080b800-5e48-4b1d-bfdb-fce409a8e01b
        noteId: a8179a54-f7de-49a6-bd4a-76cd5e9429b1
        x: 1030
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 1865dbaa-60ac-474b-8f21-fdb87b61d8e1
        noteId: 146517d0-fd1f-4499-a7a2-291495196292
        x: 920
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 20689832-caf5-4609-b442-f989f2d86162
        noteId: ee014148-26a7-4ce1-ad92-862269a9a42f
        x: 740
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 2ed881a1-31a6-44ba-b0ec-13f522dd2310
        noteId: 60dcc297-331c-469b-bb1e-f0f2f3d4fedb
        x: 360
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 3c1d0c65-bbf6-4144-8c4a-000dc47b8e19
        noteId: c322601e-8254-4887-b45e-75c2ba85209a
        x: 1200
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 424b732f-7cd4-4048-8632-7a9a62118de3
        noteId: 0c7f7560-c960-4673-8197-ce97a4676099
        x: 80
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 4f78bc18-49ce-4243-8223-34069363e6e1
        noteId: 47d3e227-9eaa-4f49-bd62-edf3a5ebe947
        x: 640
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 53d848f7-dce7-4295-9d25-ebe7f3748631
        noteId: a6832bac-f5bf-4304-a22d-ba3b3324594d
        x: 100
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 647876e1-5832-4099-80c7-fdb88148da6e
        noteId: 8c938689-4c24-4ed8-8439-8c3a4926907a
        x: 920
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 6aba112b-bf92-4f1a-bb79-823c8dfc8d7f
        noteId: 21191eee-61b5-45e6-9d6d-da34a847485e
        x: 1200
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 6f032b45-d13a-4cfb-89de-502de80b3689
        noteId: a5b3bfeb-359b-4cc1-bd82-97a5cb71a7bb
        x: 640
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 8b006dbd-9201-44f0-80f9-236d11571aa2
        noteId: 5d869ff5-5a7a-401a-8617-61568d049ba4
        x: 1700
        y: 430
        width: 184
        height: 208
        pivotal: false
      - id: 9953985e-da7b-4983-87e0-befd40c350da
        noteId: 2e58932c-651e-47f8-a154-ada552103c93
        x: 80
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: 9a014616-ba0c-4bea-8e35-04ad94b20209
        noteId: 461dd592-012c-4666-bbdf-7137aef823a9
        x: 1700
        y: 730
        width: 184
        height: 208
        pivotal: false
      - id: a81e702a-e01b-4d19-beda-2ca69be5cbac
        noteId: 3ef91417-c69d-4fda-85cc-4709a1d0cb63
        x: 450
        y: 70
        width: 224
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: c3e72e27-73c4-41d3-8d40-69fb96a23675
        noteId: 9f76de14-e2f6-4d1d-95f9-451fdfb4ae24
        x: 740
        y: 1030
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
      - id: dc87ffbb-3079-4224-a8cf-26431761a678
        noteId: f8c3f921-3751-4062-a914-c842bae9b245
        x: 360
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 7937be8a-390e-4f3a-b655-712fc829c8dc
    connections:
      - id: 1a70c717-6005-4e8b-b5d2-317fa5add0c9
        source: 8b006dbd-9201-44f0-80f9-236d11571aa2
        target: 9a014616-ba0c-4bea-8e35-04ad94b20209
        label: erillinen elinkaaripolku
      - id: 1c2c3f2e-cab0-4d9e-b64c-296dd8b688e8
        source: 6f032b45-d13a-4cfb-89de-502de80b3689
        target: 20689832-caf5-4609-b442-f989f2d86162
        label: komennon omistus
      - id: 272f22ec-ae37-47bc-b83d-68e8ba3dff41
        source: 20689832-caf5-4609-b442-f989f2d86162
        target: 1080b800-5e48-4b1d-bfdb-fce409a8e01b
        label: projisoidaan
      - id: 2e2e8092-3049-4339-ab30-1fe07b6959bd
        source: 424b732f-7cd4-4048-8632-7a9a62118de3
        target: 9953985e-da7b-4983-87e0-befd40c350da
        label: tulos
      - id: 4b948dce-2595-479d-8975-82a25605c88d
        source: 3c1d0c65-bbf6-4144-8c4a-000dc47b8e19
        target: 6aba112b-bf92-4f1a-bb79-823c8dfc8d7f
        label: tulos
      - id: 4dd56bd7-98bd-4d9d-a0ea-4e3e35e7dcab
        source: 1865dbaa-60ac-474b-8f21-fdb87b61d8e1
        target: 1080b800-5e48-4b1d-bfdb-fce409a8e01b
        label: luettava fakta
      - id: 541089f4-bfbd-4746-9bfc-d6303a911c7e
        source: 20689832-caf5-4609-b442-f989f2d86162
        target: c3e72e27-73c4-41d3-8d40-69fb96a23675
        label: invariantin estämä polku
      - id: 564c8d2f-f39b-41d3-9024-4ddde5a038bf
        source: 3c1d0c65-bbf6-4144-8c4a-000dc47b8e19
        target: 20689832-caf5-4609-b442-f989f2d86162
        label: komennon omistus
      - id: 69c92f41-cfe2-40ae-b8e2-74fad41439bc
        source: 4f78bc18-49ce-4243-8223-34069363e6e1
        target: 1080b800-5e48-4b1d-bfdb-fce409a8e01b
        label: luettava fakta
      - id: 78fbf359-e9f5-4fa5-8ef3-656daa1d582e
        source: 424b732f-7cd4-4048-8632-7a9a62118de3
        target: 20689832-caf5-4609-b442-f989f2d86162
        label: komennon omistus
      - id: 88e65e8b-0d22-44fa-a0d5-c5835ab0f400
        source: 647876e1-5832-4099-80c7-fdb88148da6e
        target: 20689832-caf5-4609-b442-f989f2d86162
        label: komennon omistus
      - id: 8eecb0b7-4840-4c99-ae15-adf13eb2d6b6
        source: 9953985e-da7b-4983-87e0-befd40c350da
        target: 1080b800-5e48-4b1d-bfdb-fce409a8e01b
        label: luettava fakta
      - id: a7f0e0ef-f53d-4c30-921f-f7a4d5d5f460
        source: 6f032b45-d13a-4cfb-89de-502de80b3689
        target: 4f78bc18-49ce-4243-8223-34069363e6e1
        label: tulos
      - id: a9673fef-a8f5-4be0-a403-2a84e879649c
        source: dc87ffbb-3079-4224-a8cf-26431761a678
        target: 2ed881a1-31a6-44ba-b0ec-13f522dd2310
        label: tulos
      - id: b9717059-679f-4a8f-b375-f39a6c95b9d9
        source: 647876e1-5832-4099-80c7-fdb88148da6e
        target: 1865dbaa-60ac-474b-8f21-fdb87b61d8e1
        label: tulos
      - id: c8c29591-16af-4c52-88ef-414739ae84b5
        source: 53d848f7-dce7-4295-9d25-ebe7f3748631
        target: 20689832-caf5-4609-b442-f989f2d86162
        label: rajoittaa
      - id: db98c639-e8a9-4294-89f2-568e3cd0d724
        source: 2ed881a1-31a6-44ba-b0ec-13f522dd2310
        target: 1080b800-5e48-4b1d-bfdb-fce409a8e01b
        label: luettava fakta
      - id: e737b416-64b0-4999-ac04-66dcd1a04a9d
        source: dc87ffbb-3079-4224-a8cf-26431761a678
        target: 20689832-caf5-4609-b442-f989f2d86162
        label: komennon omistus
      - id: f2739d5d-0d3c-4328-916d-88b48dd34da3
        source: 6aba112b-bf92-4f1a-bb79-823c8dfc8d7f
        target: 1080b800-5e48-4b1d-bfdb-fce409a8e01b
        label: luettava fakta
      - id: fdbcd402-d088-41c2-9bca-75bc75ce4fd1
        source: a81e702a-e01b-4d19-beda-2ca69be5cbac
        target: 20689832-caf5-4609-b442-f989f2d86162
        label: käsittelee
    frames:
      - id: 7937be8a-390e-4f3a-b655-712fc829c8dc
        title: Runtime ja finalisointi
        kind: bounded-context
        x: 0
        y: 0
        width: 1550
        height: 1300
  - id: a858d959-11ac-4dd5-8359-71f79828e5bb
    title: 4. Jono, lease ja daemon — vastuut
    level: software-design
    description: Nykyiseen arkkitehtuuriin sidottu vastuumalli. Kehys kuvaa nykyistä vastuualueen rajaa, ei ehdotusta uudeksi palveluksi tai bounded context -jaoksi.
    sourceBoardId: 74f22c5a-3ae7-4184-bf95-4e69368c586d
    placements:
      - id: 200c295d-83fd-4962-a30a-eb5243d44f14
        noteId: 44dd5316-4b59-4ac7-8a7e-403ff228fb0a
        x: 360
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: 3b5534bd-642a-438e-8a80-e374bcb33372
        noteId: 691bc275-4506-4dec-a900-584a3851e4be
        x: 1030
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: 5e38d6a8-04ad-4987-9664-26c444be3f06
        noteId: 4812c8db-35e7-4306-8760-13224e695d4e
        x: 740
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: 6de41510-8f4c-464e-862d-f080c0ca384b
        noteId: fd797518-322f-4e4f-b826-8dda32ee44dd
        x: 920
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: 6e1933c4-7ba4-447d-b3f8-cdab9a182e81
        noteId: 0d322dfa-61c9-4541-bf34-bd958eadbf1d
        x: 640
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: 86c6d8b3-b805-4e92-bff3-06259125daab
        noteId: 9690f5de-9d1e-480e-bda7-75789d5f48e1
        x: 80
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: 8efc373c-90b2-4a34-b35d-331958b49b54
        noteId: 120df932-7ea8-499b-ba30-d36cbe2397fc
        x: 640
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: 96fe49a5-8aba-4e26-a36f-35a95cea5361
        noteId: a768e1f5-f597-412f-b30d-c1203902c0aa
        x: 920
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: aa39bfa0-7b1e-4b09-bd31-ca3d30ce8e11
        noteId: 81f93d10-9743-49fb-93fc-9e4eebb9ec0e
        x: 1700
        y: 430
        width: 184
        height: 208
        pivotal: false
      - id: d348db22-3c89-4ec1-b041-e112925beb25
        noteId: 022ca7ef-9193-48bf-a076-89591fad5ff4
        x: 1200
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: d81dc87b-bb04-4d50-bd14-b28ccd7c9085
        noteId: 0a36fef4-cef8-4175-b656-c5ec384faf21
        x: 740
        y: 1030
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: d898e857-893c-4750-afde-edce195c0600
        noteId: 2fd804de-fe56-45c9-9d75-684105ff72c1
        x: 450
        y: 70
        width: 224
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: de6e0ce3-f40b-473f-81c2-668a49b780fe
        noteId: d18c5f7a-ca31-40fb-a736-3d4e6b4f0502
        x: 80
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: dfb28cd7-6c58-418d-811d-1bf0d177c0ce
        noteId: b5e3fe45-0681-44e3-85a5-faf785413681
        x: 360
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: e6ec5bbb-72c5-433c-8128-0166077781b1
        noteId: 8389f28c-9bc9-48f9-84ed-b61cfbd13c4d
        x: 1200
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
      - id: f21e9b4c-654c-4592-ab98-c3cf6b59d9cd
        noteId: d183b59d-fe0a-47db-9801-4c2097f01925
        x: 1700
        y: 730
        width: 184
        height: 208
        pivotal: false
      - id: f72b692c-0ff2-4178-8a32-e63a6e56a857
        noteId: f44d5345-7471-44f6-8000-e2f9c9f7a43c
        x: 100
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 27ec7530-b4f4-43b6-89a9-fc881c9548db
    connections:
      - id: 06d905b6-42f7-4b75-80af-981e3cfba880
        source: d898e857-893c-4750-afde-edce195c0600
        target: 5e38d6a8-04ad-4987-9664-26c444be3f06
        label: käsittelee
      - id: 099aa637-bb9b-452a-9a4a-6a101bb6f7e0
        source: aa39bfa0-7b1e-4b09-bd31-ca3d30ce8e11
        target: f21e9b4c-654c-4592-ab98-c3cf6b59d9cd
        label: erillinen elinkaaripolku
      - id: 0f4604d5-5c54-4da6-be83-38293b5a682b
        source: 5e38d6a8-04ad-4987-9664-26c444be3f06
        target: 3b5534bd-642a-438e-8a80-e374bcb33372
        label: projisoidaan
      - id: 12292df5-c689-4068-80be-c1555395e428
        source: 6e1933c4-7ba4-447d-b3f8-cdab9a182e81
        target: 8efc373c-90b2-4a34-b35d-331958b49b54
        label: tulos
      - id: 157e0236-074a-498c-8ca3-e9425cfef302
        source: 200c295d-83fd-4962-a30a-eb5243d44f14
        target: 3b5534bd-642a-438e-8a80-e374bcb33372
        label: luettava fakta
      - id: 261cafa9-d702-4bf5-95c1-dd5c3b7db059
        source: dfb28cd7-6c58-418d-811d-1bf0d177c0ce
        target: 5e38d6a8-04ad-4987-9664-26c444be3f06
        label: komennon omistus
      - id: 37826cd5-cf14-49fd-bfec-8e3bbe5d39ee
        source: 8efc373c-90b2-4a34-b35d-331958b49b54
        target: 3b5534bd-642a-438e-8a80-e374bcb33372
        label: luettava fakta
      - id: 51b56309-9689-4b74-8cef-30f94f3d7ef5
        source: d348db22-3c89-4ec1-b041-e112925beb25
        target: 5e38d6a8-04ad-4987-9664-26c444be3f06
        label: komennon omistus
      - id: 74a00e9b-fc0f-4a50-a8ee-a383c1f273ff
        source: 86c6d8b3-b805-4e92-bff3-06259125daab
        target: 5e38d6a8-04ad-4987-9664-26c444be3f06
        label: komennon omistus
      - id: 7b12d581-51f4-41d8-8d93-97921567b02e
        source: f72b692c-0ff2-4178-8a32-e63a6e56a857
        target: 5e38d6a8-04ad-4987-9664-26c444be3f06
        label: rajoittaa
      - id: 963d20f4-ca78-4408-9c94-f700e67af7bc
        source: 86c6d8b3-b805-4e92-bff3-06259125daab
        target: de6e0ce3-f40b-473f-81c2-668a49b780fe
        label: tulos
      - id: 9a082ae7-4ca3-4300-bb03-3f6fbf8df857
        source: 6de41510-8f4c-464e-862d-f080c0ca384b
        target: 96fe49a5-8aba-4e26-a36f-35a95cea5361
        label: tulos
      - id: 9f0ee28f-9f22-4b7e-b934-dc0e37369bfa
        source: 5e38d6a8-04ad-4987-9664-26c444be3f06
        target: d81dc87b-bb04-4d50-bd14-b28ccd7c9085
        label: invariantin estämä polku
      - id: adb1b6b3-5867-4b6f-b96d-c73d20b23117
        source: dfb28cd7-6c58-418d-811d-1bf0d177c0ce
        target: 200c295d-83fd-4962-a30a-eb5243d44f14
        label: tulos
      - id: d009e1e2-8b6e-41d7-b3ba-8b954dc9ea2d
        source: 6e1933c4-7ba4-447d-b3f8-cdab9a182e81
        target: 5e38d6a8-04ad-4987-9664-26c444be3f06
        label: komennon omistus
      - id: df97d363-df87-459e-9350-31fbe2cd73e6
        source: 6de41510-8f4c-464e-862d-f080c0ca384b
        target: 5e38d6a8-04ad-4987-9664-26c444be3f06
        label: komennon omistus
      - id: e054bea7-ba72-4606-b59b-eff686693832
        source: de6e0ce3-f40b-473f-81c2-668a49b780fe
        target: 3b5534bd-642a-438e-8a80-e374bcb33372
        label: luettava fakta
      - id: e8ded11f-8d46-49b9-bcf2-8c426f21fe71
        source: d348db22-3c89-4ec1-b041-e112925beb25
        target: e6ec5bbb-72c5-433c-8128-0166077781b1
        label: tulos
      - id: f5dfa380-3f4c-4121-aca9-a9d8a245ae4b
        source: e6ec5bbb-72c5-433c-8128-0166077781b1
        target: 3b5534bd-642a-438e-8a80-e374bcb33372
        label: luettava fakta
      - id: fc5510ca-25f4-4125-b8c2-5f8b43440817
        source: 96fe49a5-8aba-4e26-a36f-35a95cea5361
        target: 3b5534bd-642a-438e-8a80-e374bcb33372
        label: luettava fakta
    frames:
      - id: 27ec7530-b4f4-43b6-89a9-fc881c9548db
        title: Jono, lease ja daemon
        kind: bounded-context
        x: 0
        y: 0
        width: 1550
        height: 1300
  - id: ba0bdc02-5d4b-425d-8d0a-3a38f9d99489
    title: 5. Feedback ja Critic
    level: process-modelling
    description: Dokumentoidun prosessin komennot, tapahtumat, toimija, säännöt ja poikkeuspolut. Yhteydet kuvaavat ehtoja, eivät alustan uusia kontrollikomentoja.
    sourceBoardId: 09eee978-fa50-4df9-8b3c-7ed65a9f55ba
    placements:
      - id: 089604c0-58ef-4946-be4a-e2159cdaba60
        noteId: 9647dd59-3438-4565-bb0b-6cf0b9310995
        x: 240
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 0da03c1d-465a-49e4-b87c-84c0b8280b9b
        noteId: 34d69e17-928b-4421-a19e-7215469d67b7
        x: 490
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 22b10cc2-3bf1-48b4-aa96-1f555c651e43
        noteId: f1cd5dbd-a603-4ce8-b76e-a9747c26e06e
        x: 1240
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 32923c7b-f461-4a64-bb58-caf704aed9a6
        noteId: 4a36dd61-b15a-4f97-a5aa-fbeea2703b33
        x: 740
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 37305d84-bb89-4867-8956-ab33745a468f
        noteId: 17798111-31e0-42db-abb9-837514389bdb
        x: 990
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 46e67ce5-b433-4b8b-a607-6a96b35f6d11
        noteId: 5dd34d75-46b2-40fa-b801-5c91694f76e8
        x: 40
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 56d1f529-566a-4f3a-b9d0-48b7ed2fbe83
        noteId: f4206cda-7f79-4951-8be6-5bc5c0803e18
        x: 40
        y: 650
        width: 224
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 5b0a4c6a-3a0e-447a-9235-6bb2894ee83b
        noteId: a410e4bc-718e-4296-9a26-d0d21f5bc602
        x: 990
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 69620e75-6ddf-41a0-acb5-c0d192ca1bc1
        noteId: 6cef2975-04c4-4565-b09f-16f30774ce39
        x: 740
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 7533474b-f039-43a8-bffc-b28f59667433
        noteId: 6125fb63-7ae6-45ee-b2c5-c7c08d861d1c
        x: 990
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 880ab9f2-7e6c-4c25-9993-af4106357d8a
        noteId: a890f62f-43e9-483c-9d4c-1e35f95e53c6
        x: 490
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: 8b000976-0e48-4129-a915-cbc8881440d8
        noteId: a6cad801-8cb2-47f5-bd71-d5b80797a0f1
        x: 490
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: b498ed9c-c2cb-448c-a697-14b19c24548f
        noteId: 31d161b4-46f0-4cd4-a1c5-fcdb58cb3e0c
        x: 240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: cd2ec4d9-a8b0-4e01-8e49-87a14c302195
        noteId: 6d0c6346-ec46-49d6-ba80-0aaf0c6e6848
        x: 1240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
      - id: fe682395-37c9-4e25-b4e2-43050376def0
        noteId: 17e9acde-3e2e-4c8a-84f7-0aa7ed5b6eab
        x: 1240
        y: 360
        width: 184
        height: 208
        pivotal: true
        frameId: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
    connections:
      - id: 09fb598d-ee80-459f-8738-e5ad1ccb9273
        source: 46e67ce5-b433-4b8b-a607-6a96b35f6d11
        target: b498ed9c-c2cb-448c-a697-14b19c24548f
        label: aloittaa
      - id: 3a436ced-bcca-4a94-92e1-d29e7fc911e7
        source: 69620e75-6ddf-41a0-acb5-c0d192ca1bc1
        target: 880ab9f2-7e6c-4c25-9993-af4106357d8a
        label: sääntö
      - id: 53fb1598-da7f-476d-bc1f-6e5f114e42c7
        source: 8b000976-0e48-4129-a915-cbc8881440d8
        target: 0da03c1d-465a-49e4-b87c-84c0b8280b9b
        label: tuottaa
      - id: 562239fa-03c4-4eb4-bb55-dcf2d14f3233
        source: cd2ec4d9-a8b0-4e01-8e49-87a14c302195
        target: fe682395-37c9-4e25-b4e2-43050376def0
        label: tuottaa
      - id: 5981acc9-d891-4a7b-a83d-b5253354accd
        source: 5b0a4c6a-3a0e-447a-9235-6bb2894ee83b
        target: 37305d84-bb89-4867-8956-ab33745a468f
        label: tuottaa
      - id: 65c0d03e-4d8e-4703-b9f1-2b41ebd91228
        source: 0da03c1d-465a-49e4-b87c-84c0b8280b9b
        target: 32923c7b-f461-4a64-bb58-caf704aed9a6
        label: jatkoehdon täyttyessä
      - id: 672f7ccf-b836-4f6f-a690-918cd7eaa457
        source: 880ab9f2-7e6c-4c25-9993-af4106357d8a
        target: 7533474b-f039-43a8-bffc-b28f59667433
        label: esto tai poikkeus
      - id: 70781be6-fad8-4527-927d-7b59a0a81ff0
        source: 32923c7b-f461-4a64-bb58-caf704aed9a6
        target: 69620e75-6ddf-41a0-acb5-c0d192ca1bc1
        label: tuottaa
      - id: 7876772b-3ecf-4d6c-b1f2-626febb22194
        source: 69620e75-6ddf-41a0-acb5-c0d192ca1bc1
        target: 7533474b-f039-43a8-bffc-b28f59667433
        label: ihminen hylkää
      - id: 992633a7-408d-4021-94f5-19391c43657a
        source: 69620e75-6ddf-41a0-acb5-c0d192ca1bc1
        target: 5b0a4c6a-3a0e-447a-9235-6bb2894ee83b
        label: jatkoehdon täyttyessä
      - id: 9ce281bc-3292-4118-8177-18c3714850ed
        source: 7533474b-f039-43a8-bffc-b28f59667433
        target: 22b10cc2-3bf1-48b4-aa96-1f555c651e43
        label: tuottaa
      - id: ae083b12-650c-4299-a63e-a6df53ca33ab
        source: 089604c0-58ef-4946-be4a-e2159cdaba60
        target: 8b000976-0e48-4129-a915-cbc8881440d8
        label: jatkoehdon täyttyessä
      - id: d53bf721-dd3d-4b36-9e9e-957ccaaa60ec
        source: 37305d84-bb89-4867-8956-ab33745a468f
        target: cd2ec4d9-a8b0-4e01-8e49-87a14c302195
        label: jatkoehdon täyttyessä
      - id: dcba5b29-f976-4f10-8a43-d32d0d567788
        source: fe682395-37c9-4e25-b4e2-43050376def0
        target: 56d1f529-566a-4f3a-b9d0-48b7ed2fbe83
        label: näytetään
      - id: f76ce3be-8f50-4cd6-b644-233fddf4057e
        source: b498ed9c-c2cb-448c-a697-14b19c24548f
        target: 089604c0-58ef-4946-be4a-e2159cdaba60
        label: tuottaa
    frames:
      - id: 78d90fa1-b18f-476c-a9f9-0a27f8503b2b
        title: Feedback ja Critic
        kind: process
        x: 0
        y: 0
        width: 1550
        height: 1040
  - id: c7b4c86b-e5da-4230-b4eb-53ad2dcb0f16
    title: 1. Git ja projektidokumentit — vastuut
    level: software-design
    description: Nykyiseen arkkitehtuuriin sidottu vastuumalli. Kehys kuvaa nykyistä vastuualueen rajaa, ei ehdotusta uudeksi palveluksi tai bounded context -jaoksi.
    sourceBoardId: 8319f5a8-4263-483e-b027-83bb1c082406
    placements:
      - id: 0a3401eb-99f9-4220-9e98-4d18562ff063
        noteId: f9295d71-aa62-43bf-ad03-f86225679e50
        x: 640
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 0c469a2c-324b-4985-8219-1f757dd715df
        noteId: 8885ea91-05d5-4338-ba9b-b3f46f3371a0
        x: 640
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 162ffac0-1e16-4143-a9ca-db9274397d7a
        noteId: a6e46ead-cfd4-4580-a03f-98b3cb51017a
        x: 360
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 1635fbff-e2ea-4b4a-96db-82398e2cce2a
        noteId: 0c385d44-c5ae-4e7b-a136-5706c1683292
        x: 1200
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 16494195-ae36-4527-9a4b-2163206a0090
        noteId: c6ad6caf-ac9d-4031-8d0f-93e3874b1c37
        x: 80
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 36365a5e-21a6-4416-8fa8-13adb9c1ba46
        noteId: fba97b32-b1e8-4d77-b850-44e30151d802
        x: 1030
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 3aa3c6c6-1521-40af-bba7-48855fa0e9cd
        noteId: 932e3055-2781-4d9e-97be-1d87c0cd7c04
        x: 740
        y: 1030
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 56ca081b-0afb-47c0-9d32-0e2f2714fbd5
        noteId: 0b4e5387-4386-4ca3-9b82-327a75d5cdd6
        x: 740
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 61f18092-cb30-44c9-b48e-e2176c161c90
        noteId: 5fdfc058-2cdb-42cb-974f-d227c1255281
        x: 920
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 7bce2642-8ed0-49f1-8a28-7d4b1df062b3
        noteId: 7b106a6f-746d-4f5e-916c-f3155c229fbf
        x: 80
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 8c84e1ec-5473-4473-a6ad-19740a005579
        noteId: b70a0c86-8cd3-4772-a3ea-5e8e63d20e50
        x: 100
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 9a0539b4-97d4-4efb-aa4e-c796f74618c1
        noteId: 75bd6f9b-51ab-425b-a9fe-03d12c5538e3
        x: 450
        y: 70
        width: 224
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: 9d888ee8-d3cb-458c-ae8b-baf366c82008
        noteId: dd63a167-758d-45f8-8236-9eb82085bf0a
        x: 920
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: d5916e82-077d-4426-8699-548930ce5e9b
        noteId: 1c13c4a4-7da1-4e9f-a738-ff211c918085
        x: 1200
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
      - id: e4d51260-5421-4fde-ae0e-53cefd96c42a
        noteId: 231d1ba3-d86e-4ec5-953c-81ca945987bf
        x: 360
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
    connections:
      - id: 03bc60d5-13c7-4aa4-a2cb-3255cedc0e17
        source: 61f18092-cb30-44c9-b48e-e2176c161c90
        target: 36365a5e-21a6-4416-8fa8-13adb9c1ba46
        label: luettava fakta
      - id: 132dfdfb-c7fe-48eb-9acb-71c31d27d245
        source: 16494195-ae36-4527-9a4b-2163206a0090
        target: 36365a5e-21a6-4416-8fa8-13adb9c1ba46
        label: luettava fakta
      - id: 1bc468c7-e43f-415f-9a4f-1001605a8dc8
        source: 162ffac0-1e16-4143-a9ca-db9274397d7a
        target: 36365a5e-21a6-4416-8fa8-13adb9c1ba46
        label: luettava fakta
      - id: 3b251e23-6fbb-438e-b3a6-33f8ae3278f5
        source: 1635fbff-e2ea-4b4a-96db-82398e2cce2a
        target: 36365a5e-21a6-4416-8fa8-13adb9c1ba46
        label: luettava fakta
      - id: 486a061a-61e0-4948-8799-0e66795dd436
        source: 7bce2642-8ed0-49f1-8a28-7d4b1df062b3
        target: 16494195-ae36-4527-9a4b-2163206a0090
        label: tulos
      - id: 67a96339-4147-4a57-8bb4-98c76171faf4
        source: 56ca081b-0afb-47c0-9d32-0e2f2714fbd5
        target: 3aa3c6c6-1521-40af-bba7-48855fa0e9cd
        label: invariantin estämä polku
      - id: 78bdc8ed-1fde-48d5-aea0-3070296ff649
        source: 56ca081b-0afb-47c0-9d32-0e2f2714fbd5
        target: 36365a5e-21a6-4416-8fa8-13adb9c1ba46
        label: projisoidaan
      - id: 7a583b0c-20ea-4632-9a44-6fef16149809
        source: e4d51260-5421-4fde-ae0e-53cefd96c42a
        target: 56ca081b-0afb-47c0-9d32-0e2f2714fbd5
        label: komennon omistus
      - id: 8153558e-d2f0-49e8-8347-43a769c8acce
        source: 0a3401eb-99f9-4220-9e98-4d18562ff063
        target: 36365a5e-21a6-4416-8fa8-13adb9c1ba46
        label: luettava fakta
      - id: 84ce10d3-079f-487a-8e6b-453b9a32105e
        source: 0c469a2c-324b-4985-8219-1f757dd715df
        target: 0a3401eb-99f9-4220-9e98-4d18562ff063
        label: tulos
      - id: 87887d59-c184-43a7-8a0a-bc923fa49bc0
        source: d5916e82-077d-4426-8699-548930ce5e9b
        target: 56ca081b-0afb-47c0-9d32-0e2f2714fbd5
        label: komennon omistus
      - id: 97d0194c-17a8-43e3-bda0-d2f19c689f94
        source: 9a0539b4-97d4-4efb-aa4e-c796f74618c1
        target: 56ca081b-0afb-47c0-9d32-0e2f2714fbd5
        label: käsittelee
      - id: a4bcb34b-3c4f-41f3-a273-bd0a009e399c
        source: 9d888ee8-d3cb-458c-ae8b-baf366c82008
        target: 61f18092-cb30-44c9-b48e-e2176c161c90
        label: tulos
      - id: a727c21f-20f3-4142-b80e-3841bf617ea8
        source: 0c469a2c-324b-4985-8219-1f757dd715df
        target: 56ca081b-0afb-47c0-9d32-0e2f2714fbd5
        label: komennon omistus
      - id: ad603d2e-678c-4054-a17e-4c9ab6ece5fc
        source: 9d888ee8-d3cb-458c-ae8b-baf366c82008
        target: 56ca081b-0afb-47c0-9d32-0e2f2714fbd5
        label: komennon omistus
      - id: b7e22c1c-7979-4655-a316-bff332e4b8e7
        source: 8c84e1ec-5473-4473-a6ad-19740a005579
        target: 56ca081b-0afb-47c0-9d32-0e2f2714fbd5
        label: rajoittaa
      - id: c52430ce-120d-4c89-a1de-1748579a7735
        source: d5916e82-077d-4426-8699-548930ce5e9b
        target: 1635fbff-e2ea-4b4a-96db-82398e2cce2a
        label: tulos
      - id: f1007f06-12c7-41e1-b5cd-dc0401d88bb6
        source: e4d51260-5421-4fde-ae0e-53cefd96c42a
        target: 162ffac0-1e16-4143-a9ca-db9274397d7a
        label: tulos
      - id: fb38ed80-819b-4439-8b4e-b581e3d5cc7f
        source: 7bce2642-8ed0-49f1-8a28-7d4b1df062b3
        target: 56ca081b-0afb-47c0-9d32-0e2f2714fbd5
        label: komennon omistus
    frames:
      - id: 2842febc-a8fc-40a0-8d0c-8edc11ed0ab5
        title: Git ja projektidokumentit
        kind: bounded-context
        x: 0
        y: 0
        width: 1550
        height: 1300
  - id: c8d2c75c-a2e3-4197-a69f-7a5f6cc281a8
    title: 2. Environment ja Action Agentit
    level: process-modelling
    description: Dokumentoidun prosessin komennot, tapahtumat, toimija, säännöt ja poikkeuspolut. Yhteydet kuvaavat ehtoja, eivät alustan uusia kontrollikomentoja.
    sourceBoardId: 09eee978-fa50-4df9-8b3c-7ed65a9f55ba
    placements:
      - id: 0b75b9a2-b851-4d7f-94b6-c76e5716be08
        noteId: 6fae5808-9886-4d2a-a71a-d087849d8abc
        x: 990
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: 16cc53bc-ce21-4d4a-80c4-6c0a3418a1ee
        noteId: a51f2fb0-6180-4bed-8bf1-1f7ea415d8c7
        x: 490
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: 2afd1ed1-209c-44e8-9dd1-924ce2f6e177
        noteId: 234ee251-b5a9-4f13-bd84-5c2e625a7a0d
        x: 240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: 2ea99370-dd50-483e-96b5-5af220b7b7eb
        noteId: 6fc2f920-23f2-45a8-a5ae-af502a16648d
        x: 990
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: 3c570b7d-18cd-4297-a447-e9e1ad3dd89b
        noteId: da56eac4-b164-4bd1-b1fb-ab1eb75f572b
        x: 740
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: 43db813c-1231-464c-9a63-357a37717be9
        noteId: d3504513-4afc-4083-af6c-0c7021081734
        x: 740
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: 667068fb-0219-4a0a-b3c3-54fefeafb285
        noteId: 4e062061-7908-4663-9033-bae9304a869e
        x: 1240
        y: 360
        width: 184
        height: 208
        pivotal: true
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: 6d134227-074b-45c2-9ca6-ff0572ad1c95
        noteId: 51f7ba7d-de7c-4fb7-9c61-740fabb56f42
        x: 490
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: 7cf77bba-a3ba-45a4-90d4-1d316056916d
        noteId: c8a1a71c-acae-4288-bf53-42ab58c1885c
        x: 490
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: 82cc49f6-5e47-4e51-962b-1a833fec4e07
        noteId: 76a1859e-7423-4d48-a2d8-2eb12189dbda
        x: 1240
        y: 650
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: 99bbb534-8e12-4171-8eb9-cf5a7a39e1f4
        noteId: 6595c7af-5104-40f5-bd21-93860a77f1d7
        x: 40
        y: 650
        width: 224
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: a03dcde1-2cda-4441-a623-39608e9146b7
        noteId: a7f095cf-9156-4a13-8956-eac0109cfcb8
        x: 40
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: ad8c9126-3c85-4a50-afb3-e00d7bc02df6
        noteId: bfa7a70d-0fe7-4905-8eef-3f0fd57178f4
        x: 240
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: be8841fd-a9db-48e4-a25f-07137839d6bd
        noteId: 682cf189-d5cf-4fbf-bdb3-d83b1a0a3d93
        x: 990
        y: 360
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
      - id: d47c5052-2234-49ee-b519-5534c4178099
        noteId: 12f2a569-a086-4054-ab25-e4bd5a7b10de
        x: 1240
        y: 80
        width: 184
        height: 208
        pivotal: false
        frameId: 30151f48-1e3a-418e-bde0-b9ad65638039
    connections:
      - id: 02911b92-6ff2-475c-b573-3a807af208a0
        source: 2ea99370-dd50-483e-96b5-5af220b7b7eb
        target: 82cc49f6-5e47-4e51-962b-1a833fec4e07
        label: tuottaa
      - id: 03b132c6-4568-430e-91f3-cfea2b5ace0f
        source: 3c570b7d-18cd-4297-a447-e9e1ad3dd89b
        target: 43db813c-1231-464c-9a63-357a37717be9
        label: tuottaa
      - id: 193a2641-7a08-4dd4-b31b-500ddc1288f2
        source: 6d134227-074b-45c2-9ca6-ff0572ad1c95
        target: 3c570b7d-18cd-4297-a447-e9e1ad3dd89b
        label: jatkoehdon täyttyessä
      - id: 2dcd14c2-3036-421b-bf57-33a645205990
        source: 43db813c-1231-464c-9a63-357a37717be9
        target: 0b75b9a2-b851-4d7f-94b6-c76e5716be08
        label: jatkoehdon täyttyessä
      - id: 3063a831-7290-421d-be3c-8d0cdf59ba06
        source: be8841fd-a9db-48e4-a25f-07137839d6bd
        target: d47c5052-2234-49ee-b519-5534c4178099
        label: jatkoehdon täyttyessä
      - id: 625a8c9b-0d76-469c-b566-f49039bc2ae3
        source: 16cc53bc-ce21-4d4a-80c4-6c0a3418a1ee
        target: 2ea99370-dd50-483e-96b5-5af220b7b7eb
        label: esto tai poikkeus
      - id: 7f65839d-b1fe-4a0d-8048-986c7bb04a74
        source: 667068fb-0219-4a0a-b3c3-54fefeafb285
        target: 99bbb534-8e12-4171-8eb9-cf5a7a39e1f4
        label: näytetään
      - id: 83e18cb2-42a7-4a68-ab9d-ad55c7074245
        source: ad8c9126-3c85-4a50-afb3-e00d7bc02df6
        target: 7cf77bba-a3ba-45a4-90d4-1d316056916d
        label: jatkoehdon täyttyessä
      - id: a969b485-c772-44f5-97b2-bde0c98fa6a7
        source: d47c5052-2234-49ee-b519-5534c4178099
        target: 667068fb-0219-4a0a-b3c3-54fefeafb285
        label: tuottaa
      - id: aeca0d5d-6a9b-46da-aafe-3b8b1bae2bbc
        source: 0b75b9a2-b851-4d7f-94b6-c76e5716be08
        target: be8841fd-a9db-48e4-a25f-07137839d6bd
        label: tuottaa
      - id: b09f4795-4dac-4f0b-a459-f6b63ef825eb
        source: 7cf77bba-a3ba-45a4-90d4-1d316056916d
        target: 6d134227-074b-45c2-9ca6-ff0572ad1c95
        label: tuottaa
      - id: c4b9c0cc-3b94-4605-b9dc-329884b5433d
        source: 43db813c-1231-464c-9a63-357a37717be9
        target: 16cc53bc-ce21-4d4a-80c4-6c0a3418a1ee
        label: sääntö
      - id: df5a70d2-d359-47b1-85e8-fd176c220a23
        source: a03dcde1-2cda-4441-a623-39608e9146b7
        target: 2afd1ed1-209c-44e8-9dd1-924ce2f6e177
        label: aloittaa
      - id: e9e770c1-27a9-497e-b458-0f95e8b6c40e
        source: 2afd1ed1-209c-44e8-9dd1-924ce2f6e177
        target: ad8c9126-3c85-4a50-afb3-e00d7bc02df6
        label: tuottaa
    frames:
      - id: 30151f48-1e3a-418e-bde0-b9ad65638039
        title: Environment ja Action Agentit
        kind: process
        x: 0
        y: 0
        width: 1550
        height: 1040
  - id: db0094fb-775f-4552-bf8a-674564d177a0
    title: 6. Refinement ja continuation — vastuut
    level: software-design
    description: Nykyiseen arkkitehtuuriin sidottu vastuumalli. Kehys kuvaa nykyistä vastuualueen rajaa, ei ehdotusta uudeksi palveluksi tai bounded context -jaoksi.
    sourceBoardId: 3d075703-a410-4d75-b98f-942f9755e9a8
    placements:
      - id: 1c6c7b33-4a6b-4d70-9404-eaa3916f3856
        noteId: ab0b3c45-f6f6-42dc-b03e-10bc91c78af3
        x: 360
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: 1ffd867a-3fec-4cb5-8e78-fb7f40f9a018
        noteId: 022f9769-b5c0-4221-bebf-4cbd9ab4615c
        x: 920
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: 254e7b19-0499-4be6-9501-8f80c2348a60
        noteId: c88fc915-feab-41f7-9834-6d9b52f1834d
        x: 640
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: 53d88040-cde1-4c01-b0b0-ea466b2e9d3a
        noteId: 2c0de0f8-766a-4200-bda6-45fc115076b2
        x: 920
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: 5e884dde-ab97-4c6c-b9ec-7aa7fc0f828a
        noteId: e5f79a9f-7a2f-45de-95e4-c366420d40b9
        x: 100
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: 70dc70e8-6349-4e3f-9c5a-4a74d1b558f5
        noteId: 63c56006-52e4-4288-acd8-2e060add8f97
        x: 1030
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: 72936fde-47ea-4c54-858a-8d896e485714
        noteId: 6d46dbe1-b5f5-46e2-9b0d-f623544662ef
        x: 1200
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: 7d6054f7-4101-42fd-b9f0-286570b3cda6
        noteId: 48b2f633-a98d-48ea-b366-235c12f08ca7
        x: 640
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: 8054986e-afee-42b6-9b76-ebf16b3893f1
        noteId: 1fa6399d-307b-4105-bc0b-d61b54560411
        x: 740
        y: 1030
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: 819d84b6-ce73-42cd-891a-7df40cf0b472
        noteId: 4c898994-0a6d-4375-b25c-a934374b6fa4
        x: 450
        y: 70
        width: 224
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: 8b1135d0-2e69-4514-939c-96c9eeb862fc
        noteId: 11ca25a0-a066-4511-925e-b0c8bae79e66
        x: 80
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: a301f8c7-be7a-4df2-94ff-6b6d1841fb29
        noteId: f82b8f49-c1f2-4eb4-8b29-32ad8ff9cf7e
        x: 740
        y: 70
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: b4033caf-4392-4fdb-8267-efb625e80596
        noteId: f0a720d9-a2b3-4f60-b070-3f3738a450da
        x: 80
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: b90b4322-1b48-403a-8901-1d79bf24515f
        noteId: ebd5aa83-1e35-4632-b1e9-a0f14d30ac6e
        x: 1200
        y: 430
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
      - id: eec0e82f-c5c2-4b07-9399-ce3c98918bdc
        noteId: 360c1cee-30bb-4fec-b895-7777299d3b93
        x: 360
        y: 730
        width: 184
        height: 208
        pivotal: false
        frameId: 6a914ee2-2808-4814-90d8-80e96ab227c0
    connections:
      - id: 04fcd51b-a2e0-4809-ae40-3f422889f727
        source: b4033caf-4392-4fdb-8267-efb625e80596
        target: 70dc70e8-6349-4e3f-9c5a-4a74d1b558f5
        label: luettava fakta
      - id: 0c8d684d-bb54-4092-8428-40e1565051b9
        source: 8b1135d0-2e69-4514-939c-96c9eeb862fc
        target: b4033caf-4392-4fdb-8267-efb625e80596
        label: tulos
      - id: 1320006a-e7af-4e81-a964-656694495344
        source: 72936fde-47ea-4c54-858a-8d896e485714
        target: 70dc70e8-6349-4e3f-9c5a-4a74d1b558f5
        label: luettava fakta
      - id: 185b4efe-882c-472f-a902-fb80005fd022
        source: 819d84b6-ce73-42cd-891a-7df40cf0b472
        target: a301f8c7-be7a-4df2-94ff-6b6d1841fb29
        label: käsittelee
      - id: 1f1cd46e-f515-4240-8a6a-3a3cb7ade289
        source: 1c6c7b33-4a6b-4d70-9404-eaa3916f3856
        target: eec0e82f-c5c2-4b07-9399-ce3c98918bdc
        label: tulos
      - id: 2a28500f-71ea-4eb9-9340-299d76dc28e1
        source: 7d6054f7-4101-42fd-b9f0-286570b3cda6
        target: a301f8c7-be7a-4df2-94ff-6b6d1841fb29
        label: komennon omistus
      - id: 2f5e6c8b-07fa-46ac-a8f4-ac31ae3e61cf
        source: 5e884dde-ab97-4c6c-b9ec-7aa7fc0f828a
        target: a301f8c7-be7a-4df2-94ff-6b6d1841fb29
        label: rajoittaa
      - id: 46464469-172b-47ef-b49c-e020028b68eb
        source: a301f8c7-be7a-4df2-94ff-6b6d1841fb29
        target: 8054986e-afee-42b6-9b76-ebf16b3893f1
        label: invariantin estämä polku
      - id: 52780569-c712-4f23-a9d7-09d56b6f89c1
        source: 1ffd867a-3fec-4cb5-8e78-fb7f40f9a018
        target: 53d88040-cde1-4c01-b0b0-ea466b2e9d3a
        label: tulos
      - id: 60e13168-c98f-4001-8cb3-a62a0d25e395
        source: 254e7b19-0499-4be6-9501-8f80c2348a60
        target: 70dc70e8-6349-4e3f-9c5a-4a74d1b558f5
        label: luettava fakta
      - id: 70187155-d035-4ba1-9e3e-927438d49e5e
        source: eec0e82f-c5c2-4b07-9399-ce3c98918bdc
        target: 70dc70e8-6349-4e3f-9c5a-4a74d1b558f5
        label: luettava fakta
      - id: 7bc4a7c2-df7d-46d0-afea-c97df60994cb
        source: 53d88040-cde1-4c01-b0b0-ea466b2e9d3a
        target: 70dc70e8-6349-4e3f-9c5a-4a74d1b558f5
        label: luettava fakta
      - id: 93eb12e5-677a-4714-a31c-087e4c95e139
        source: 1ffd867a-3fec-4cb5-8e78-fb7f40f9a018
        target: a301f8c7-be7a-4df2-94ff-6b6d1841fb29
        label: komennon omistus
      - id: b244bb4e-ef5f-4943-8042-9a0d10417e17
        source: 7d6054f7-4101-42fd-b9f0-286570b3cda6
        target: 254e7b19-0499-4be6-9501-8f80c2348a60
        label: tulos
      - id: c0b21039-d50f-4df5-87c5-bec2e64eb20f
        source: a301f8c7-be7a-4df2-94ff-6b6d1841fb29
        target: 70dc70e8-6349-4e3f-9c5a-4a74d1b558f5
        label: projisoidaan
      - id: df9a5358-da65-4e09-b2fe-e5aa9d1f4040
        source: b90b4322-1b48-403a-8901-1d79bf24515f
        target: a301f8c7-be7a-4df2-94ff-6b6d1841fb29
        label: komennon omistus
      - id: e3ed2aca-c6a3-44af-b820-660fbdd9ed80
        source: 8b1135d0-2e69-4514-939c-96c9eeb862fc
        target: a301f8c7-be7a-4df2-94ff-6b6d1841fb29
        label: komennon omistus
      - id: eaa0cbc1-e37b-45a5-871b-8457eb062faf
        source: b90b4322-1b48-403a-8901-1d79bf24515f
        target: 72936fde-47ea-4c54-858a-8d896e485714
        label: tulos
      - id: f61c3eb2-d7e4-44d2-b5fa-a9cef6819e1b
        source: 1c6c7b33-4a6b-4d70-9404-eaa3916f3856
        target: a301f8c7-be7a-4df2-94ff-6b6d1841fb29
        label: komennon omistus
    frames:
      - id: 6a914ee2-2808-4814-90d8-80e96ab227c0
        title: Refinement ja continuation
        kind: bounded-context
        x: 0
        y: 0
        width: 1550
        height: 1300
---

# Balletin Event Storming

Tämä malli rekonstruoi 6.9.2026 dokumentoidun Balletin toiminnan. Se ei väitä, että työpaja olisi pidetty tai tarinat hyväksytty. Big Picture kokoaa kuusi rinnakkaista prosessia. Prosessitaulut tarkentavat komennot ja poikkeukset; ohjelmistosuunnittelutaulut näyttävät nykyiset vastuut ja invariantit.

Korttien sources-viitteet osoittavat nykyisiin User Storyihin, ADR-recordeihin ja arkkitehtuurin vastuunäkymään. Samat korttitunnisteet esiintyvät usealla taululla, mutta sijoittelu ja yhteydet kuuluvat taululle. Kehykset eivät lisää uusia alustan palveluita tai päätöksiä.

[Siirtokartoitus](../arc42/ADR-CONTENT-MAP.md) nimeää ADR:istä siirretyn tiedon omistajat.
