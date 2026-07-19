---
id: goal-010
title: Koostettava Step execution
status: proposed
createdAt: '2026-07-18T21:21:24.000Z'
updatedAt: '2026-07-18T21:21:24.000Z'
tags:
  - tavoite
  - step-suoritus
  - koostaminen
version: 1
---

# Koostettava Step execution

## Tavoite

Ballet muodostaa jokaisen suoritettavan Stepin executionin toisistaan riippumattomista runtime-, instruction-, skill- ja task-valinnoista.

Käyttäjän pitää voida käyttää samaa execution profilea eri Stepeissä, vaihtaa yhden Stepin primary instructionia tai skills-valintoja vaikuttamatta muihin Steppeihin ja todentaa myöhemmin täsmälleen, millä sisällöllä Run suoritettiin.

## Tarkoitus

Execution profile kuvaa vain, miten suoritus ajetaan. Step omistaa sen, mitä työssä tehdään ja mitä ohje- sekä skill-lähteitä käytetään. Näin runtime-konfiguraation uudelleenkäyttö ei kopioi workflow-sisältöä eikä yhteisen instructionin muutos sido toisiinsa muuten erillisiä Steppejä.

## Kyvykkyydet

- Nimetyn execution profilen valitseminen Stepille yhdellä viitteellä.
- Täsmälleen yhden Built-in- tai Project-originin primary instructionin valitseminen Stepille.
- Nollan tai useamman Built-in- tai Project-originin skill-tiedoston valitseminen Stepille.
- Pakollisen, minimaalisen ja read-only System-ohjeen lisääminen jokaiseen executioniin ilman käyttäjän valintaa.
- Instructionien ja skillsien koostaminen versionoidussa, deterministisessä järjestyksessä.
- Kaikkien saavutettavien Steppien valittujen lähteiden snapshottaaminen Root Runin alussa.
- Jokaisen käytetyn instruction- ja skill-lähteen version, SHA-256-tiivisteen ja executioniin käytetyn sisällön säilyttäminen Run-evidenssissä.

## Tuotteen rajaukset

- Execution profile sisältää vain ID:n, nimen, providerin, modelin, reasoning effortin ja network access -valinnan.
- Execution profile ei sisällä instructioneita, skills-valintoja, task descriptionia, Transitioneita tai workspace-oikeutta.
- Additional instructions ei kuulu ensimmäisen version skeemaan tai käyttöliittymään; sille voidaan suunnitella myöhempi Advanced-capability.
- Vain Stepille eksplisiittisesti valitut skillsit osallistuvat compositioniin.
- Instruction- tai skill-sisältöä ei typistetä hiljaisesti kokorajan täyttämiseksi.

## Todentaminen

Tavoite toteutuu, kun kaksi Stepiä voi käyttää samaa execution profilea eri primary instructioneilla ja skills-valinnoilla, samasta Run-snapshotista muodostuu tavutasolla sama instruction bundle ja Run-evidenssistä voidaan tarkistaa jokaisen käytetyn lähteen origin, ID, versio, sisältö ja SHA-256.
