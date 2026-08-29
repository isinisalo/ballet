---
id: goal-002
title: Version-controlled project truth
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-08-29'
version: 5
tags: [tavoite, versionhallinta, projektimalli]
---

# Version-controlled project truth

## Tavoite

Balletin Direction, approved Use Caset, Environment, agenttien composition, instructionit ja Skills ovat repositoryn mukana siirtyvää, katselmoitavaa ja toistettavaa projektitotuutta. Konekohtainen runtime-totuus ei vuoda repositoryyn.

## Käyttäjäarvo

Ihminen pystyy ymmärtämään WHAT/WHY:n, suoritusrakenteen ja agenttien valitut resurssit tavallisesta Git-diffistä. Sama checkout voidaan ladata toisella koneella ilman alkuperäisen koneen run historya tai absoluuttisia polkuja.

## Mitattavat success criteria

1. Strict Project Config v21, kaikki viitatut Direction-, Agent-, instruction- ja Skill-dokumentit latautuvat yhdestä repository-closuresta ilman puuttuvia tai orpoja runtime-resursseja.
2. Runtime completion-, attempt-, approval- ja schedule-faktoja tallennetaan projektikonfiguraatioon 0 kertaa.
3. Balletin oma viiden Staten Environment käyttää samoja geneerisiä platform-primitivejä kuin compact fixture; platform source sisältää 0 Ballet-workflow-ID-haaraa.

## Rajaus

Salaisuudet, palveluprosessi, absoluuttiset polut, SQLite, Run history ja managed worktreet ovat machine-local truthia. Strict cut ei sisällä migration-, reader-, alias- tai dual-write-polkuja.
