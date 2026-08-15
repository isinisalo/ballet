---
id: adr-002
title: Kannettava projektimääritys ja paikallinen ajonaikainen tila
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-19T06:45:37.000Z'
tags:
  - arkkitehtuuripäätös
  - projektimääritys
  - paikallinen-tila
version: 3
---

# Kannettava projektimääritys ja paikallinen ajonaikainen tila

## Konteksti

Balletin execution profilet, automaatio ja projektin intentio pitää voida versionhallita ja siirtää kloonista toiseen. Suoritushistoria, palveluidentiteetti, absoluuttiset polut ja Git-worktreet ovat sen sijaan kone- ja kloonikohtaisia eivätkä saa näkyä repositoryn muutoksina.

## Päätös

Ballet erottaa kannettavan projektimäärityksen checkout-kohtaisesta ajonaikaisesta tilasta.

Versionhallittua projektimääritystä ovat:

- `.ballet/project.json`, joka sisältää tiukan v9-konfiguraation, ExecutionProfilet ja Loopit Step-kohtaisine execution composition -viitteineen;
- `.ballet/theme.json`, joka sisältää projektin yhden Loop-teeman;
- `.ballet`-puun `.md`-projektidokumentit, mukaan lukien `.ballet/instructions/**/*.md`-polun eksplisiittisellä frontmatter-ID:llä osoitettavat Project-primary instructionit; sekä
- `.agents/skills/**/SKILL.md`, jotka sisältävät repositoriokohtaiset taidot.

Suoritettava Agent- ja Scheduled-Step omistaa viitteet yhteen ExecutionProfileen, yhteen Project-primary instructioniin ja valittuihin Project-skilleihin. Pre-release v8 -aineisto muunnetaan repositoryssä suoraan; `.codex/agents/*.toml` ei kuulu v9-kohdemalliin tai runtime-resoluutioon.

Kone- ja kloonikohtainen tila sijoitetaan checkoutin Git-hakemiston `.git/ballet`-alihakemistoon:

- `state.sqlite` sisältää Runit, Stepit, tehtävät, tapahtumat ja ajastustilan;
- `settings.json` sisältää palveluntarjoajakomentojen ohitukset ja checkout-kohtaiset absoluuttiset vain luku -juuret;
- `service.json` ja `instance-id` sisältävät palvelun identiteetin ja portin;
- `worktrees/` sisältää Root Run -työtilat; ja
- `logs/` sisältää paikallisen palvelulokin.

Konekohtainen policy ei kuulu ExecutionProfileen tai Step-compositioniin. V9:n local settings käyttää vain checkout-kohtaista `readOnlyRoots: string[]` -kenttää. Legacy `agentReadOnlyRoots` estää Runin ja näyttää arvot säilyttävän eksplisiittisen remediation-ohjeen; Ballet ei poista tai tulkitse kenttää hiljaisesti.

## Seuraukset

- Projektin intentio ja automaatio voidaan katselmoida tavallisena Git-diffinä.
- Uusi klooni saa versionhallittavan konfiguraation mutta aloittaa omalla tyhjällä ajohistoriallaan ja paikallisilla asetuksillaan.
- Ajonaikainen käyttö ei lisää tiedostoja Git-statukseen.
- Absoluuttisia konepolkuja ei saa kirjoittaa `.ballet/project.json`-tiedostoon, Project-instructioneihin tai skilleihin.
- Root Run ratkaisee kaikki saavutettavat Step-compositionit samasta versionhallittavan projektimäärityksen tilannekuvasta, vaikka siinä olisi sallittuja commitoimattomia konfiguraatiomuutoksia.
- Projektidokumentit löydetään suoraan `.ballet`-puun Markdown-tiedostoista; erillistä Goal- tai ADR-indeksiä ei ylläpidetä.

## Toteutuksen lähteet

- `README.md`
- `backend/project/ProjectContext.ts`
- `backend/project-config/ProjectConfigurationRepository.ts`
- `backend/execution/LocalSettingsRepository.ts`
- `backend/storage/LocalDatabase.ts`
