---
id: goal-002
title: Versionhallittu projektimalli
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-19T05:44:00.000Z'
tags:
  - tavoite
  - versionhallinta
  - projektimalli
version: 2
---

# Versionhallittu projektimalli

## Tavoite

Balletin projektimääritykset ja työnkulut ovat repositoryn mukana siirtyvää, katselmoitavaa ja toistettavaa aineistoa.

Käyttäjän pitää voida ymmärtää projektin tavoitteet, päätökset, Loopit, Stepit, ExecutionProfilet, instructionit ja skillsit suoraan checkoutin tiedostoista sekä muokata niitä Balletin Configure-tilassa.

## Tarkoitus

Projektin intentio ja automaatio kuuluvat samaan versionhallintaan kuin lähdekoodi. Näin muutokset voidaan tarkastaa diffistä, jakaa kloonien välillä ja ottaa mukaan Root Runin todennettavaan käynnistyslähtötilaan.

Konekohtainen tila erotetaan kannettavasta projektiaineistosta, jotta absoluuttiset polut, prosessitiedot ja paikallinen historia eivät vuoda repositoryyn.

Balletin oman repositoryn kehitystyönkulku on tavallista project-local dataa. Sen roadmap-, milestone-, issue-, release- ja deploy-menettelyt eivät muodosta tuotteeseen sisäänrakennettua erikoispolkua.

## Kyvykkyydet

- Looppien ja nimettyjen ExecutionProfilejen säilyttäminen strict v9 -muotoisessa `.ballet/project.json`-tiedostossa.
- Suoritettavan Stepin tehtäväkuvauksen, `executionProfileId`-, `primaryInstructionId`- ja `skillIds`-viitteiden sekä Transitionien säilyttäminen Loopin project-local datana.
- Goals-, ADR-, instruction-, skill- ja teema-aineistojen säilyttäminen checkoutin versionhallituissa tiedostoissa.
- Projektiaineistojen selaaminen, muokkaaminen ja katselmointi samoina tiedostoina, jotka siirtyvät repositoryn mukana.
- Syötteiden validointi ja tallennus niiden omiin versionhallittuihin tiedostoihin ennen uuden projektitilan käyttämistä.
- Balletin kehitys-Loopien ja workflow-menettelyjä kuvaavien Project-skillsien ylläpito tavallisena repository-owned projektidatana.
- Versionhallittujen, vielä commitoimattomien projektimääritysten ottaminen mukaan seuraavan Root Runin tilannekuvaan.

## Tuotteen rajaukset

- Palveluntarjoajakomentojen konekohtaiset ohitukset, absoluuttiset vain luku -juuret ja ajohistoria eivät kuulu versionhallittuun projektimalliin.
- Palveluntarjoajien tunnuksia, tokeneita tai muita salaisuuksia ei tallenneta projektiaineistoon.
- Kohdemallissa ei ole top-level Agentin runtime-omistajuutta, `agentId`-viitettä eikä standalone Agent Runia; `agent` säilyy Step-tyyppinä.
- `.codex/agents` on vain eksplisiittisen migraation lähde, ei kanoninen projektimääritys. Historialliset Agent-snapshotit säilyvät read-only-historiana.
- System-ohje ei sisällä Balletin tai muun projektin ohjelmistotoimitusmenettelyä, vaan workflow-järjestys kuuluu project-local Loop-dataan ja menettelyt Stepeille eksplisiittisesti valittuihin Project-skillseihin.
- Workflow-template ei ole uusi entity, pack, registry tai live-linkki. Built-in-lähteestä projektin lähtökohdaksi kloonattu workflow on itsenäistä Project-dataa.
- Ballet löytää Goal- ja ADR-dokumentit niiden kanonisista Markdown-tiedostoista; erillinen indeksi ei ole tietolähde.
- Virheellinen konfiguraatio voidaan näyttää ja korjata Configure-tilassa, mutta sitä ei saa suorittaa Runina.

## Todentaminen

Tavoite toteutuu, kun projektin Goals, ADR:t, Loopit, Stepit, ExecutionProfilet, instructionit, skillsit ja teema voidaan katselmoida Git-diffistä, kloonata toiselle koneelle ja ladata Balletiin ilman alkuperäisen kloonin paikallista ajonaikaista tilaa. Sama malli riittää Balletin oman kehitystyönkulun kuvaamiseen ilman System-ohjeeseen, tuotebinaariin tai erilliseen template packiin lisättyä erikoispolkua.
