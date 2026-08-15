---
id: adr-014
title: Workflow-templatet ovat project-local dataa
status: accepted
createdAt: '2026-07-18T21:21:24.000Z'
updatedAt: '2026-07-19T06:45:37.000Z'
tags:
  - arkkitehtuuripäätös
  - workflow-templatet
  - projektidata
version: 3
---

# Workflow-templatet ovat project-local dataa

## Konteksti

Projektit tarvitsevat toistettavia lähtökohtia Loopeille, Stepeille, instructioneille ja skills-valinnoille. Ensimmäiseen versioon ei kuitenkaan tarvita uutta template-, pack-, Recipe- tai registry-mallia. Live-linkki Balletin toimittamaan templateen tekisi projektin executionista riippuvaisen asennetun Ballet-version muuttuvasta sisällöstä.

Balletin oman roadmap–milestone–release-ketjun pitää lisäksi olla tavallista repository-owned dataa, jotta se ei muutu muiden projektien oletusworkflow'ksi.

## Päätös

Workflow template on authoring-käsite, ei uusi runtime- tai persistence-entity.

- Suoritettava V1-workflow koostuu projektin tavallisista Loopeista, Stepeistä, execution profile -viitteistä, Project-primary instructioneista sekä valituista Project-skills-tiedostoista.
- Projektissa käytettävän workflow'n Loop- ja Step-rakenne tallennetaan project-local konfiguraationa.
- Projektikohtaiset instructionit ja skillsit ovat repository-owned ja editable Project-resursseja.
- Project workflow snapshotataan Root Runin alussa suoraan repository-owned lähteistä.

Ensimmäiseen versioon ei lisätä template packia, template-versioresolveria, marketplacea, registryä, clone-to-project-toimintoa, override-ketjua tai uutta Template/Recipe-entityä.

## Seuraukset

- Workflow näkyy Git-diffissä samoina tiedostoina, joita Run käyttää.
- Projektit voivat eriyttää workflow'nsa ilman globaalin templaten ehtoja.
- Balletin oma kehitysworkflow pysyy Ballet-repositoryn projektidatana eikä System- tai tuotebinaarikäytäntönä.
- Node editor ei ole kloonaus- tai template-editori eikä V1:n käyttöliittymässä ole Built-in-katalogia.
- Päätös riippuu ADR-012:n composition-mallista ja ADR-013:n workflow-skill-rajasta sekä täsmentää ADR-002:n project-local data -periaatetta.

## Toteutuksen lähteet

- `.ballet/project.json`
- `.ballet/instructions/`
- `.agents/skills/`
- `.ballet/adr/adr-002-kannettava-projektimaaritys-ja-paikallinen-tila.md`
- `.ballet/adr/adr-004-loop-step-transition-run-domain-malli.md`
- `.ballet/outputs/execution-composition/DATA-MODEL.md`
- `.ballet/outputs/execution-composition/UI-DESIGN.md`
