---
id: goal-009
title: Continuous traceable arc42 architecture method
status: accepted
createdAt: '2026-08-16T00:00:00.000Z'
updatedAt: '2026-08-29'
version: 2
tags: [tavoite, arc42, maintainability]
---

# Continuous traceable arc42 architecture method

## Tavoite

Ballet-projekti ylläpitää Goals/Requirements → quality scenario → ADR/Constraint → building block → runtime/deployment → executable test → evidence -ketjua kanonisessa arc42-rakenteessa ilman dokumenttiduplikaatiota.

## Käyttäjäarvo

Ihminen ja agentit löytävät samasta repository-totuudesta hyväksytyn suunnan, nykyisen arkkitehtuurin, mitattavat riskit, toteutusevidenssin ja seuraavan rajatun päätöksen.

## Mitattavat success criteria

1. Jokaisella canonical Use Casella on vähintään yksi executable test/evidence -linkki ja relevantti Goal/ADR-viite.
2. `npm run validate:arc42` löytää puuttuvia stable ID-, local link-, status-, resource- ja trace-ketjuja 0 hyväksytyssä revisionissa.
3. Initiative merkitään complete/accepted vain, kun priority-1 acceptance evidence on passed; dokumentin olemassaolo yksin kattaa 0 Use Casea.
4. Platform-koodissa on 0 project-local arc42-polku- tai workflow-ID-haaraa.
