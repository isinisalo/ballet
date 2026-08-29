---
id: goal-003
title: Usean palveluntarjoajan paritettu Agent-suoritus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-08-17T00:00:00.000Z'
tags:
  - tavoite
  - node-suoritus
  - palveluntarjoajat
version: 5
---

# Usean palveluntarjoajan paritettu Agent-suoritus

## Tavoite

Ballet suorittaa Codex CLI- ja Copilot CLI -pohjaiset Work-, Validation-, Critic- ja Refinement-roolit samalla paritetun daemonin toimintamallilla säilyttäen palveluntarjoajakohtaiset ominaisuudet ja valmiustiedot näkyvinä.

Käyttäjän pitää voida ylläpitää Agentin identiteetti ja resurssit Markdownina sekä valita sille machine-local Computer → CLI backend → model → reasoning → policy -binding. Ennen Runia käyttöliittymä näyttää, onko täsmälleen tämä binding suorituskelpoinen.

## Tarkoitus

Agent Markdown kuvaa vakaan roolin, instructionin ja Skills-valinnat. Machine-local binding kuvaa vain, missä ja miten Agent suoritetaan. Tämä erottaa Gitissä jaettavan projektitotuuden koneen credentialeista ja capabilityista.

Yhteinen suorituskokemus estää automaatiota sitoutumasta yhden palveluntarjoajan tapahtuma- tai tulosmuotoon. Eksplisiittiset valinnat tekevät Root Runin lähtökohdista toistettavia eivätkä peitä provider-vaihtoja oletusten taakse.

## Kyvykkyydet

- Codex CLI:n ja GitHub Copilot CLI:n asennuksen, version, autentikoinnin ja kyvykkyyksien tarkistaminen.
- Computerin ja sen ilmoittaman Codex- tai Copilot-backendin valitseminen Agentille.
- Mallin, reasoning effortin, network-policyn ja read-only roots -rajojen sitominen ilmoitettuihin capabilityihin.
- Täsmälleen yhden Project-primary instructionin ja nollan tai useamman eksplisiittisen Project-Skillin valitseminen Agentille tai Action-roolille.
- Pakollisen ja minimaalisen System-ohjeen lisääminen jokaiseen suoritukseen muuttumattomasta Ballet-katalogista ilman käyttäjän valintaa. Katalogin read-only-luonne ei muuta Root Runin worktree-oikeutta.
- Vain luku -juurien ratkaiseminen konekohtaisesta policysta Agent Markdownin ja Action-compositionin ulkopuolella.
- Palveluntarjoajasta riippumattomien tehtävätilojen, konsolitapahtumien ja strukturoitujen lopputulosten näyttäminen.
- System-ohjeen, primary instructionin, ID:n mukaan järjestettyjen skillsien, task envelopen ja output scheman koostaminen versionoiduiksi sectioneiksi sekä exact promptin, sen SHA-256:n ja käytettyjen lähteiden originin, ID:n, relative pathin ja source SHA-256:n säilyttäminen evidenssissä ilman redundantteja täyssisältökopioita.
- Yhden Environment Runin kaikkien tehtävien sitominen samaan online-laitteeseen ja immutable checkout/config-snapshottiin.
- Asennus-, autentikointi- ja yhteensopivuusongelmien selkeä näyttäminen ennen Runia.

## Tuotteen rajaukset

- Ballet ei valitse palveluntarjoajaa, mallia tai reasoning effortia automaattisella varavalinnalla.
- Autentikointi tulee palveluntarjoajan CLI:stä tai sen tukemasta ympäristöstä; Ballet ei pyydä eikä tallenna palveluntarjoajan tunnuksia.
- Tuettu execution-ympäristö on ihmisen parittama macOS-daemon; kone valitaan eksplisiittisesti Agent-bindingissä.
- Palveluntarjoajan raakaa tapahtumamuotoa tai piilotettua reasoning-sisältöä ei näytetä sellaisenaan käyttöliittymässä.
- Agent Markdown ei sisällä deviceId:tä, backend-ID:tä, provider-tunnuksia tai machine-local policyä.
- Binding-editori ei muuta Agent Markdownia; Action editor valitsee Agentin eikä kopioi provider-asetuksia.
- Additional instructions ei kuulu nykyiseen skeemaan, ja vain Node-roolille eksplisiittisesti valitut skillsit osallistuvat koostamiseen.
- Instruction- tai skill-sisältöä ei typistetä hiljaisesti kokorajan täyttämiseksi.
- Yksi Project-primary instruction ja yksi Project-skill saavat olla enintään 128 KiB; Balletin koko muodostama prompt saa olla enintään 512 KiB.
- Balletin evidenssi todistaa Balletin muodostaman promptin, ei providerin koko sisäistä tai ambient-kontekstia.

## Todentaminen

Tavoite toteutuu, kun vähintään yksi Codex CLI- ja yksi Copilot CLI -backend voidaan ilmoittaa samasta daemonista, Agent voidaan sitoa kumpaan tahansa ilman Project Config -muutosta, mixed-device Run estyy preflightissa ja samasta Root Snapshotista sekä Task Envelopesta muodostuu tavutasolla sama instruction bundle. Evidenssistä voidaan tarkistaa jokainen käytetty lähde ilman implisiittistä provider- tai konevaihtoa.
