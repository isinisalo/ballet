---
id: goal-003
title: Usean palveluntarjoajan koostettava Node-suoritus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-08-17T00:00:00.000Z'
tags:
  - tavoite
  - node-suoritus
  - palveluntarjoajat
version: 4
---

# Usean palveluntarjoajan koostettava Node-suoritus

## Tavoite

Ballet suorittaa Codex- ja Copilot-pohjaiset Work-, Validation- ja Orchestrator-roolit samalla paikallisella toimintamallilla säilyttäen palveluntarjoajakohtaiset ominaisuudet ja valmiustiedot näkyvinä.

Käyttäjän pitää voida valita suoritettavalle Node-roolille nimetty ExecutionProfile, yksi primary instruction ja tarvittavat skillsit sekä nähdä ennen Runia, voidaanko profilen provider-, model-, reasoning effort- ja network access -yhdistelmä suorittaa.

## Tarkoitus

ExecutionProfile kuvaa vain, miten suoritus ajetaan. Providerilla suoritettava Work Node, Validation Node tai Loop Orchestrator omistaa tehtävän sekä instruction- ja skill-valinnat, joten samaa runtime-konfiguraatiota voidaan käyttää uudelleen kopioimatta workflow-sisältöä tai sitomatta Nodeja toisiinsa.

Yhteinen suorituskokemus estää automaatiota sitoutumasta yhden palveluntarjoajan tapahtuma- tai tulosmuotoon. Eksplisiittiset valinnat tekevät Root Runin lähtökohdista toistettavia eivätkä peitä provider-vaihtoja oletusten taakse.

## Kyvykkyydet

- Codex CLI:n ja GitHub Copilot CLI:n asennuksen, version, autentikoinnin ja kyvykkyyksien tarkistaminen.
- Nimetyn, provider-, model-, reasoning effort- ja network access -valinnat sisältävän ExecutionProfilen valitseminen Node-roolille yhdellä viitteellä.
- Täsmälleen yhden Project-primary instructionin ja nollan tai useamman eksplisiittisen Project-skillin valitseminen Node-roolille.
- Pakollisen ja minimaalisen System-ohjeen lisääminen jokaiseen suoritukseen muuttumattomasta Ballet-katalogista ilman käyttäjän valintaa. Katalogin read-only-luonne ei muuta Root Runin worktree-oikeutta.
- Checkout-kohtaisten vain luku -juurien ratkaiseminen konekohtaisesta policysta ExecutionProfilen ja Node-compositionin ulkopuolella.
- Palveluntarjoajasta riippumattomien tehtävätilojen, konsolitapahtumien ja strukturoitujen lopputulosten näyttäminen.
- System-ohjeen, primary instructionin, ID:n mukaan järjestettyjen skillsien, task envelopen ja output scheman koostaminen versionoiduiksi sectioneiksi sekä exact promptin, sen SHA-256:n ja käytettyjen lähteiden originin, ID:n, relative pathin ja source SHA-256:n säilyttäminen evidenssissä ilman redundantteja täyssisältökopioita.
- Saman palveluntarjoajan ajojen hallittu eteneminen ja eri palveluntarjoajien ajojen mahdollinen rinnakkaisuus.
- Asennus-, autentikointi- ja yhteensopivuusongelmien selkeä näyttäminen ennen Runia.

## Tuotteen rajaukset

- Ballet ei valitse palveluntarjoajaa, mallia tai reasoning effortia automaattisella varavalinnalla.
- Autentikointi tulee palveluntarjoajan CLI:stä tai sen tukemasta ympäristöstä; Ballet ei pyydä eikä tallenna palveluntarjoajan tunnuksia.
- Tuettu suoritusympäristö on nykyisen checkoutin paikallinen macOS-isäntä; erillistä konevalintaa ei ole.
- Palveluntarjoajan raakaa tapahtumamuotoa tai piilotettua reasoning-sisältöä ei näytetä sellaisenaan käyttöliittymässä.
- ExecutionProfile sisältää vain ID:n, nimen, providerin, modelin, reasoning effortin ja network access -valinnan; se ei sisällä instructioneita, skills-valintoja, tehtäväkuvausta, Edgejä, LoopEdgejä tai workspace-oikeutta.
- ExecutionProfile-editori näyttää ja vaatii provider-, model-, reasoning effort- ja network access -valinnat; Node editor valitsee vain nimetyn profilen eikä muokkaa näitä arvoja.
- Additional instructions ei kuulu nykyiseen skeemaan, ja vain Node-roolille eksplisiittisesti valitut skillsit osallistuvat koostamiseen.
- Instruction- tai skill-sisältöä ei typistetä hiljaisesti kokorajan täyttämiseksi.
- Yksi Project-primary instruction ja yksi Project-skill saavat olla enintään 128 KiB; Balletin koko muodostama prompt saa olla enintään 512 KiB.
- Balletin evidenssi todistaa Balletin muodostaman promptin, ei providerin koko sisäistä tai ambient-kontekstia.

## Todentaminen

Tavoite toteutuu, kun kaksi Node-roolia voi käyttää samaa ExecutionProfilea eri primary instructioneilla ja skills-valinnoilla, käyttäjä näkee valitun palveluntarjoajan todellisen valmiuden ja samasta Root Runin snapshotista sekä Task Envelopesta muodostuu tavutasolla sama instruction bundle. Evidenssistä voidaan tarkistaa jokainen käytetty lähde ilman implisiittistä palveluntarjoajan vaihtoa.
