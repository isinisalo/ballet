---
id: goal-011
title: Balletin kehittäminen Balletilla
status: proposed
createdAt: '2026-07-18T21:21:24.000Z'
updatedAt: '2026-07-18T21:21:24.000Z'
tags:
  - tavoite
  - ballet-kehitys
  - projektityönkulku
version: 1
---

# Balletin kehittäminen Balletilla

## Tavoite

Ballet-repositoryn oma kehitystyö voidaan määrittää ja suorittaa samoilla project-local Loopeilla, Stepeillä, instructioneilla ja skills-tiedostoilla, joita muutkin Ballet-projektit käyttävät.

Käyttäjän pitää voida katselmoida Balletin kehitysworkflow Git-diffistä ja muuttaa sitä ilman System-ohjeen, tuotebinaarin tai erillisen template packin muuttamista.

## Tarkoitus

Balletin oman kehitysprosessin käyttäminen tavallisena projektidatana todentaa, että yleinen execution-malli riittää oikeaan monivaiheiseen työhön. Roadmap-, milestone-, issue-, release- ja deploy-menettelyt pysyvät projektin valintoina eivätkä muutu kaikille projekteille pakolliseksi piilokäyttäytymiseksi.

## Kyvykkyydet

- Balletin kehitys-Loopien ja Steppien säilyttäminen repository-owned projektidatana.
- Kehitysworkflow'n menettelyjen jakaminen Step-kohtaisesti valittuihin Project-skills-tiedostoihin.
- Yleisten primary instructionien käyttäminen yhdessä projektikohtaisten workflow-skillsien kanssa.
- Workflow'n muutosten katselmointi ennen seuraavaa Root Runia.
- Balletin oman Runin todentaminen samoilla composition- ja snapshot-evidensseillä kuin muiden projektien Runien.

## Tuotteen rajaukset

- System-origin ei sisällä roadmap-, milestone-, release-, deploy- tai muuta ohjelmistokehityksen toimitusmenettelyä.
- Workflow template ei ole ensimmäisessä versiossa uusi entity, pack, registry tai live-linkki.
- Built-in-lähde voidaan kloonata projektin lähtökohdaksi, mutta kloonattu workflow on itsenäistä Project-dataa.
- Balletin oma kehitysworkflow ei saa ohittaa ihmisen päätöksiä, projektin oikeusrajoja tai tavallista Run-snapshotointia.

## Todentaminen

Tavoite toteutuu, kun Balletin repositorykohtainen kehitys-Loop voidaan lukea ja katselmoida projektitiedostoista, sen workflow-yksityiskohdat löytyvät valituista Project-skills-tiedostoista, System-ohje pysyy geneerisenä ja seuraava Root Run tallentaa käytetyt lähteet tavalliseen evidenssiin ilman Ballet-erikoispolkua.
