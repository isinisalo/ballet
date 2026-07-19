---
id: adr-014
title: Workflow-templatet ovat project-local dataa
status: accepted
createdAt: '2026-07-18T21:21:24.000Z'
updatedAt: '2026-07-19T05:44:00.000Z'
tags:
  - arkkitehtuuripäätös
  - workflow-templatet
  - projektidata
version: 2
---

# Workflow-templatet ovat project-local dataa

## Konteksti

Projektit tarvitsevat toistettavia lähtökohtia Loopeille, Stepeille, instructioneille ja skills-valinnoille. Ensimmäiseen versioon ei kuitenkaan tarvita uutta template-, pack-, Recipe- tai registry-mallia. Live-linkki Balletin toimittamaan templateen tekisi projektin executionista riippuvaisen asennetun Ballet-version muuttuvasta sisällöstä.

Balletin oman roadmap–milestone–release-ketjun pitää lisäksi olla tavallista repository-owned dataa, jotta se ei muutu muiden projektien oletusworkflow'ksi.

## Päätös

Workflow template on authoring-käsite, ei uusi runtime- tai persistence-entity.

- Suoritettava workflow koostuu projektin tavallisista Loopeista, Stepeistä, execution profile -viitteistä, Project- tai Built-in-primary instructioneista sekä valituista skills-tiedostoista.
- Projektissa käytettävän workflow'n Loop- ja Step-rakenne tallennetaan project-local konfiguraationa.
- Projektikohtaiset instructionit ja skillsit ovat repository-owned ja editable Project-resursseja.
- Ballet voi tarjota optional Built-in-lähteen kloonauksen lähtökohdaksi. Kloonaus luo itsenäisen Project-kopion, jolla on uusi Project-ID; kopio ei säilytä runtime-linkkiä tai automaattista päivityssuhdetta Built-in-lähteeseen.
- Kloonaus ei vaihda olemassa olevan Stepin viitettä hiljaisesti. `Clone and use` on yksi eksplisiittinen käyttäjätoiminto.
- Project workflow snapshotataan Runin alussa samalla tavalla riippumatta siitä, onko sen lähtökohta luotu käsin vai kloonattu.

Ensimmäiseen versioon ei lisätä template packia, template-versioresolveria, marketplacea, override-ketjua tai uutta Template/Recipe-entityä.

## Seuraukset

- Workflow näkyy Git-diffissä samoina tiedostoina, joita Run käyttää.
- Asennetun Ballet-version Built-in-muutos ei muuta jo kloonattua Project-workflow'ta.
- Projektit voivat eriyttää workflow'nsa ilman globaalin templaten ehtoja.
- Mahdollinen `clonedFrom`-metadata on vain provenancea eikä vaikuta executioniin.
- Balletin oma kehitysworkflow pysyy Ballet-repositoryn projektidatana eikä System- tai tuotebinaarikäytäntönä.
- Built-in-katalogin selaus ja kloonaus voidaan toteuttaa myöhemmin ilman pack-järjestelmää; Node editor ei ole kloonaus- tai template-editori.
- Päätös riippuu ADR-012:n composition-mallista ja ADR-013:n workflow-skill-rajasta sekä täsmentää ADR-002:n project-local data -periaatetta.

## Toteutuksen lähteet

- `.ballet/project.json`
- `.ballet/instructions/`
- `.agents/skills/`
- `.ballet/adr/adr-002-kannettava-projektimaaritys-ja-paikallinen-tila.md`
- `.ballet/adr/adr-004-loop-step-transition-run-domain-malli.md`
- `.ballet/outputs/execution-composition/DATA-MODEL.md`
- `.ballet/outputs/execution-composition/UI-DESIGN.md`
