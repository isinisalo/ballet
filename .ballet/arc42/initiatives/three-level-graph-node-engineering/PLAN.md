---
id: three-level-graph-node-engineering-plan
title: Kolmitasoisen Graph Node Engineeringin PLAN
status: draft
createdAt: '2026-08-22'
updatedAt: '2026-08-22'
version: 1
tags:
  - arc42
  - initiative
  - graph-node
  - plan
---

# Kolmitasoisen Graph Node Engineeringin PLAN

## Toteutusjärjestys

| Step ID | Goal/REQ | QS | ADR/CON | BB | RT/DEP | Files/interfaces | Test/monitor | Completion evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TGNE-step-001 | goal-015 / REQ-015 | QS-019 | adr-023 / CON-011 | BB-003 / BB-009 | RT-014 / DEP-001 | shared domain/config/module schemas, `.ballet/project.json`, 14 packages | strict schema + module roundtrip | TGNE-EVID-001 |
| TGNE-step-002 | goal-015 / REQ-015 | QS-019 | adr-023 / CON-002 / CON-003 / CON-011 | BB-004–BB-006 | RT-014 / RT-015 / DEP-002 | snapshot v7, envelope/outcome v7, composition v8, spec v9, runtime | routing/composition/runtime matrix | TGNE-EVID-002 |
| TGNE-step-003 | goal-015 / REQ-015 | QS-019 | adr-023 / CON-002 / CON-010 / CON-011 | BB-004 / BB-005 / BB-010 | RT-015 / DEP-002 | SQLite v10, restart/cancel, repair frames, tracker boundary | persistence + fail-closed v9 | TGNE-EVID-003 |
| TGNE-step-004 | goal-015 / REQ-015 | QS-020 | adr-023 / CON-005 / CON-011 | BB-001 / BB-002 | RT-014 / DEP-001 | canonical routes, canvases, inspector/Sheet, breadcrumb | routing/UI/a11y/browser QA | TGNE-EVID-004 |
| TGNE-step-005 | goal-015 / REQ-015 | QS-019 / QS-020 | adr-023 / CON-011 | BB-001–BB-010 | RT-014 / RT-015 / DEP-001 / DEP-002 | docs, DESIGN, AGENTS, source boundaries | arc42, test, lint, build, module, design, search, diff gates | TGNE-EVID-005 |

## Riippuvuudet ja migration

Domain ja shared contractit muuttuvat ensin, sitten runtime/persistence, application/API, UI ja project data. Version cut on koordinoitu eikä sisällä compatibility-readeria tai dual-writeä. SQLite v9 jää muuttamatta; käyttäjä arkistoi vanhan machine staten remediation-ohjeen mukaan ennen v10-käynnistystä.

## Legacy removal

Poistetaan aktiivisesta `backend/`, `frontend/src/`, `shared/`, project configista, instructioneista ja module library'sta Loop/Workflow/schedule/Edge/start-ID-domain. Historialliset dokumentit säilyvät auditointia varten, mutta nykyiset indeksit ja source-of-truth-näkymät viittaavat v14-rajaan.

## Riskit

- Scoped candidate-validointi voi päästää foreign targetin, ellei jokainen route validoida unionia ja parent-scopea vasten.
- Radiaalinen layout voi overlapata 40/64-nodella tai narrow-viewportissa.
- Repair voi vahingossa nollata retryn, palata väärään Validationiin tai laajentaa aktiivista route-joukkoa.
- Laaja hard cut voi jättää julkisen reitin, tyypin tai UI-labelin eloon.
- Tracker/worktree/restart-invariantti voi driftata runtime-uudelleenkirjoituksessa.

## Portit

`npm run validate:arc42`, `npm run test`, `npm run lint`, `npm run build`, Graph Node Module -roundtrip, `npx @google/design.md lint DESIGN.md`, platform/project-boundary- ja active legacy -haut sekä `git diff --check`. Browser-QA kattaa 1440×900 ja 390×844 sekä 1/5/40 GraphNode- ja 1/17/64 JobNode -fixturet. Ihmisen visual verdict kirjataan erikseen.

## Non-goals ja valtuutus

Tämä PLAN ei lisää schedulointia, standalone JobNode Runia, provider-fallbackia, automaattista runtime-migraatiota tai ulkoisen kirjoituksen lupaa. Merge, push, deploy ja release eivät kuulu toteutukseen.

## Avoimet kysymykset

Teknistä toteutusta muuttavaa avointa kysymystä ei ole; käyttäjän hyväksymä suunnitelma ratkaisee WHAT/WHY:n ja merkittävän ADR:n. Visual verdict odottaa selainevidenssiä.
