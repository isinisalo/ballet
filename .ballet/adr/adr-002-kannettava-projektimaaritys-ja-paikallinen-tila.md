---
id: adr-002
title: Kannettava projektimääritys ja paikallinen ajonaikainen tila
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - projektimääritys
  - paikallinen-tila
version: 1
---

# Kannettava projektimääritys ja paikallinen ajonaikainen tila

## Konteksti

Balletin agentit, automaatio ja projektin intentio pitää voida versionhallita ja siirtää kloonista toiseen. Suoritushistoria, palveluidentiteetti, absoluuttiset polut ja Git-worktreet ovat sen sijaan kone- ja kloonikohtaisia eivätkä saa näkyä repositoryn muutoksina.

## Päätös

Ballet erottaa kannettavan projektimäärityksen checkout-kohtaisesta ajonaikaisesta tilasta.

Versionhallittua projektimääritystä ovat:

- `.ballet/project.json`, joka sisältää tiukan v8-konfiguraation, agenttien ajoaikaiset valinnat ja Loopit;
- `.ballet/theme.json`, joka sisältää projektin yhden Loop-teeman;
- `.ballet`-puun `.md`-projektidokumentit enintään kahdella alihakemistotasolla;
- `.codex/agents/*.toml`, jotka sisältävät agenttien määritelmät ja ohjeet; sekä
- `.agents/skills/**/SKILL.md`, jotka sisältävät repositoriokohtaiset taidot.

Kone- ja kloonikohtainen tila sijoitetaan checkoutin Git-hakemiston `.git/ballet`-alihakemistoon:

- `state.sqlite` sisältää Runit, Stepit, tehtävät, tapahtumat ja ajastustilan;
- `settings.json` sisältää palveluntarjoajakomentojen ohitukset ja absoluuttiset vain luku -juuret;
- `service.json` ja `instance-id` sisältävät palvelun identiteetin ja portin;
- `worktrees/` sisältää Root Run -työtilat; ja
- `logs/` sisältää paikallisen palvelulokin.

Ballet ei tallenna palveluntarjoajien tunnuksia. Autentikointi tulee palveluntarjoajan CLI:stä tai sen tukemasta ympäristöstä.

## Seuraukset

- Projektin intentio ja automaatio voidaan katselmoida tavallisena Git-diffinä.
- Uusi klooni saa versionhallittavan konfiguraation mutta aloittaa omalla tyhjällä ajohistoriallaan ja paikallisilla asetuksillaan.
- Ajonaikainen käyttö ei lisää tiedostoja Git-statukseen.
- Absoluuttisia konepolkuja ei saa kirjoittaa `.ballet/project.json`-tiedostoon tai agenttien versionhallittuihin määritelmiin.
- Run ottaa tilannekuvan versionhallittavasta projektimäärityksestä, vaikka siinä olisi sallittuja commitoimattomia konfiguraatiomuutoksia.
- Projektidokumentit löydetään suoraan `.ballet`-puun Markdown-tiedostoista; erillistä Goal- tai ADR-indeksiä ei ylläpidetä.

## Toteutuksen lähteet

- `README.md`
- `backend/project/ProjectContext.ts`
- `backend/project-config/ProjectConfigurationRepository.ts`
- `backend/execution/LocalSettingsRepository.ts`
- `backend/storage/LocalDatabase.ts`
