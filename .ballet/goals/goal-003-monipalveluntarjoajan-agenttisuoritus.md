---
id: goal-003
title: Usean palveluntarjoajan koostettava Step-suoritus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-19T05:44:00.000Z'
tags:
  - tavoite
  - step-suoritus
  - palveluntarjoajat
version: 2
---

# Usean palveluntarjoajan koostettava Step-suoritus

## Tavoite

Ballet suorittaa Codex- ja Copilot-pohjaiset Stepit samalla paikallisella toimintamallilla säilyttäen palveluntarjoajakohtaiset ominaisuudet ja valmiustiedot näkyvinä.

Käyttäjän pitää voida valita suoritettavalle Stepille nimetty ExecutionProfile, yksi primary instruction ja tarvittavat skillsit sekä nähdä ennen Runia, voidaanko profilen provider-, model-, reasoning effort- ja network access -yhdistelmä suorittaa.

## Tarkoitus

ExecutionProfile kuvaa vain, miten suoritus ajetaan. Step omistaa tehtävän sekä instruction- ja skill-valinnat, joten samaa runtime-konfiguraatiota voidaan käyttää uudelleen kopioimatta workflow-sisältöä tai sitomatta Steppejä toisiinsa.

Yhteinen suorituskokemus estää automaatiota sitoutumasta yhden palveluntarjoajan tapahtuma- tai tulosmuotoon. Eksplisiittiset valinnat tekevät Root Runin lähtökohdista toistettavia eivätkä peitä provider-vaihtoja oletusten taakse.

## Kyvykkyydet

- Codex CLI:n ja GitHub Copilot CLI:n asennuksen, version, autentikoinnin ja kyvykkyyksien tarkistaminen.
- Nimetyn, provider-, model-, reasoning effort- ja network access -valinnat sisältävän ExecutionProfilen valitseminen Stepille yhdellä viitteellä.
- Täsmälleen yhden Built-in- tai Project-originin primary instructionin ja nollan tai useamman eksplisiittisen skillin valitseminen Stepille.
- Pakollisen ja minimaalisen System-ohjeen lisääminen jokaiseen suoritukseen muuttumattomasta Ballet-katalogista ilman käyttäjän valintaa. Katalogin read-only-luonne ei muuta Root Runin worktree-oikeutta.
- Checkout-kohtaisten vain luku -juurien ratkaiseminen konekohtaisesta policysta ExecutionProfilen ja Step-compositionin ulkopuolella.
- Palveluntarjoajasta riippumattomien tehtävätilojen, konsolitapahtumien ja strukturoitujen lopputulosten näyttäminen.
- Instructionien ja skillsien koostaminen versionoidussa, deterministisessä järjestyksessä Root Runin tilannekuvasta sekä käytettyjen lähteiden originin, ID:n, version, sisällön ja SHA-256-tiivisteen säilyttäminen evidenssissä.
- Saman palveluntarjoajan ajojen hallittu eteneminen ja eri palveluntarjoajien ajojen mahdollinen rinnakkaisuus.
- Asennus-, autentikointi- ja yhteensopivuusongelmien selkeä näyttäminen ennen Runia.

## Tuotteen rajaukset

- Ballet ei valitse palveluntarjoajaa, mallia tai reasoning effortia automaattisella varavalinnalla.
- Autentikointi tulee palveluntarjoajan CLI:stä tai sen tukemasta ympäristöstä; Ballet ei pyydä eikä tallenna palveluntarjoajan tunnuksia.
- Tuettu suoritusympäristö on nykyisen checkoutin paikallinen macOS-isäntä; erillistä konevalintaa ei ole.
- Palveluntarjoajan raakaa tapahtumamuotoa tai piilotettua reasoning-sisältöä ei näytetä sellaisenaan käyttöliittymässä.
- ExecutionProfile sisältää vain ID:n, nimen, providerin, modelin, reasoning effortin ja network access -valinnan; se ei sisällä instructioneita, skills-valintoja, tehtäväkuvausta, Transitioneita tai workspace-oikeutta.
- ExecutionProfile-editori näyttää ja vaatii provider-, model-, reasoning effort- ja network access -valinnat; Node editor valitsee vain nimetyn profilen eikä muokkaa näitä arvoja.
- Additional instructions ei kuulu ensimmäisen version skeemaan, ja vain Stepille eksplisiittisesti valitut skillsit osallistuvat koostamiseen.
- Instruction- tai skill-sisältöä ei typistetä hiljaisesti kokorajan täyttämiseksi.

## Todentaminen

Tavoite toteutuu, kun kaksi Stepiä voi käyttää samaa ExecutionProfilea eri primary instructioneilla ja skills-valinnoilla, käyttäjä näkee valitun palveluntarjoajan todellisen valmiuden ja samasta Root Runin tilannekuvasta muodostuu tavutasolla sama instruction bundle. Evidenssistä voidaan tarkistaa jokainen käytetty lähde ilman implisiittistä palveluntarjoajan vaihtoa.
