---
id: goal-001
title: Paikallinen agenttikomentokeskus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-08-29T00:00:00.000Z'
tags:
  - tavoite
  - paikallinen-käyttö
  - komentokeskus
version: 4
---

# Paikallinen agenttikomentokeskus

## Tavoite

Ballet tarjoaa yhden Git-checkoutin paikallisen selainkäyttöisen komentokeskuksen projektimääritysten, Environment-suoritusten ja seurannan hallintaan.

Käyttäjän pitää voida käynnistää Ballet checkoutin juuresta ja hallita saman projektikontekstin Goals-, ADR-, Constraint-, Use Case-, Agent-, Environment-, instruction- ja Skill-projektitotuutta, daemon-valmiutta sekä Runeja yhdestä käyttöliittymästä.

## Tarkoitus

Ballet kokoaa projektin authoringin ja orchestrationin checkout-kohtaiseen palveluun. Valittu paritettu daemon suorittaa Validation-, Work-, Critic- ja Refinement-roolit, jotta konfiguraatio, konekohtainen binding, suorituksen lähtötila ja lopputulos pysyvät eroteltuina ja ymmärrettävinä. Checkout on projektitotuuden ensisijainen omistus- ja eristysraja.

Paikallinen control plane pitää projektitotuuden ja ajonaikaisen tilan käyttäjän hallinnassa. Provider-tunnukset säilyvät valitulla daemon-koneella ja daemon-token OS keychainissa.

## Kyvykkyydet

- Git-checkoutin juuren ja olemassa olevan HEAD-commitin tarkistaminen ennen palvelun käynnistystä.
- Markdown-työtilat versionhallittujen Goals-, ADR-, Constraint-, Use Case-, Agent-, instruction- ja Skill-aineistojen muokkaamiseen.
- Loop Engineering Environmentin, järjestettyjen Statejen ja priorisoitujen Actionien authoringiin.
- Run Gate vain kokonaisen Environment Runin käynnistämiseen, seuraamiseen ja peruuttamiseen.
- Paritettujen tietokoneiden Codex CLI- ja Copilot CLI -valmiuden sekä Agent-bindingien näyttäminen.
- Useiden checkoutien samanaikainen käyttö toisistaan eristetyillä palveluilla, porteilla ja tiloilla.
- Checkout-kohtainen käyttöliittymä, ajastus, control plane, kestävä tallennus ja Git-projektiraja sekä erillinen lease-suojattu daemon-suoritus.

## Tuotteen rajaukset

- Yksi Ballet-palvelu hallitsee vain yhtä tarkkaa Git-checkoutia.
- Tuotteessa ei ole pilvitiliä eikä keskitettyä moniprojektipalvelua. Daemon paritetaan lyhytikäisellä koodilla täsmälleen tähän checkout-control-planeen.
- Ballet ei hallitse palveluntarjoajien tunnuksia eikä siirrä niitä omaan tietovarastoonsa.
- Ballet ei yhdistä Run-branchia eikä lähetä sitä etärepositoryyn automaattisesti.

## Todentaminen

Tavoite toteutuu, kun käyttäjä voi käynnistää Balletin commitoidun checkoutin juuresta, avata paikallisen käyttöliittymän, ylläpitää Environmentia ja Markdown-projektitotuutta, parittaa execution-koneen, sitoa Agentin valmiiseen Codex- tai Copilot-backendiin ja suorittaa kokonaisen Environment Runin. Toinen checkout voi toimia samanaikaisesti vaikuttamatta ensimmäisen tilaan.
