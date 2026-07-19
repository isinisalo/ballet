---
id: goal-009
title: Yksinkertainen Loopin määrittely
status: proposed
createdAt: '2026-07-18T21:21:24.000Z'
updatedAt: '2026-07-18T21:21:24.000Z'
tags:
  - tavoite
  - automaatio
  - loop-määrittely
version: 1
---

# Yksinkertainen Loopin määrittely

## Tavoite

Balletin käyttäjä määrittää Loopin Stepeistä, joiden tehtävä ja kaksi mahdollista jatkopolkua ovat ymmärrettävissä suoraan Canvasilta ja Node editorista.

Käyttäjän pitää voida kuvata, mitä Step tekee, millä valinnoilla se suoritetaan ja mihin `Approved`- tai `Rejected`-tulos johtaa ilman, että hänen täytyy tuntea palveluntarjoajan runtime-rakennetta.

## Tarkoitus

Loop on työn näkyvä ohjausrakenne. Step kokoaa yhden tehtävän suorittamiseen tarvittavat valinnat, ja Transitionit näyttävät päätöksen jälkeisen etenemisen. Määrittely pysyy pienenä, jotta sama rakenne voidaan ymmärtää ennen Runia, sen aikana ja evidenssiä tarkastettaessa.

## Kyvykkyydet

- Loopin aloitus-Stepin ja suoritettavien Steppien määrittely.
- Stepin task descriptionin sekä `Approved target`- ja `Rejected target` -kohteiden muokkaaminen samassa Node editorissa.
- Execution profilen, yhden primary instructionin ja nollan tai useamman skillin valitseminen suoritettavalle Stepille.
- Human- ja Scheduled-Steppien säilyttäminen samassa Loop-rakenteessa ilman rinnakkaista workflow-mallia.
- Canvasin Transitionien ja Run-tilan näyttäminen toisistaan erillisinä käsitteinä.

## Tuotteen rajaukset

- Ensimmäiseen versioon ei lisätä Role-, Preset-, Policy- tai Recipe-entityä.
- Node editor ei ole execution profilejen settings-sivu eikä palveluntarjoajan asetuseditori.
- Stepillä on täsmälleen kaksi semanttista tulospolkua: `approved` ja `rejected`.
- Runtime-virhe, blokkaus tai peruutus ei muodosta hiljaista `rejected`-tulosta.
- Appearance ja Advanced pysyvät toissijaisina, oletuksena suljettuina osioina.

## Todentaminen

Tavoite toteutuu, kun uusi käyttäjä voi Node editorista tunnistaa Stepin tehtävän, execution profilen, primary instructionin, valitut skillsit sekä molemmat jatkokohteet ja ennustaa Canvasilta, mitä `Approved`- ja `Rejected`-tuloksista seuraa ilman provider-, model-, reasoning- tai runtime-käsitteiden tuntemusta.
