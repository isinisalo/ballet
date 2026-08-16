---
id: goal-010
title: Asennettavat ja vietävät yhden Loopin moduulit
status: accepted
createdAt: '2026-08-16T00:00:00.000Z'
updatedAt: '2026-08-16T00:00:00.000Z'
tags:
  - tavoite
  - loop-moduulit
  - siirrettavyys
version: 1
---

# Asennettavat ja vietävät yhden Loopin moduulit

## Tavoite

Balletin käyttäjä voi lisätä yhden ymmärrettävän Loopin versionhallittavasta Loop Librarysta, tuoda paikallisen `.ballet-loop.json`-tiedoston, luoda tyhjän Loopin ja viedä nykyisen custom Loopin siirrettäväksi moduuliksi.

Asennettu moduuli on tavallista project-local runtime-dataa: sen Loop materialisoidaan `.ballet/project.json`-tiedostoon ja sen instruction- ja skill-resurssit projektin nykyisiin resurssihakemistoihin. Root Run ei ratkaise, lataa tai suorita packagea.

## Tarkoitus

Yhden Loopin paketti tekee toistettavan toimintakyvyn jaettavaksi ilman, että projekti menettää omistajuuden varsinaisesta flow- tai repair-graafista, ExecutionProfileista, käyttöoikeuksista tai versionhallittavasta runtime-määrittelystä.

## Kyvykkyydet

- Strict `LoopModulePackageV1` yhdelle Loopille, module-local ID:ille, resursseille, profile-sloteille, State-contractille, capabilityille ja suositelluille yhteyksille.
- Paikallisen package-sisällön inspection, deterministinen install plan, eksplisiittinen hyväksyntä ja nykytilaa vasten revalidoitu commit.
- Turvallinen project-local materialisointi, provenance/ownership-metadata ja sisällöstä laskettu `exact | modified | missing-resources` -status.
- Loopin ja sen transitiivisesti viittaamien instructionien ja skillsien kanoninen export ilman ExecutionProfileja tai konekohtaista tilaa.
- Provenance-aware remove, joka ei poista aktiivista Loopia eikä jaettua resurssia.
- All Loops -näkymän Loop Library -polku ilman erillistä marketplace-pääaluetta.
- Seitsemän itsenäisesti asennettavaa arc42 Method -starter-moduulia.

## Rajaukset

- V1:ssä ei ole remote registryä, marketplacea, automaattista päivitystä, script hookeja, post-install-komentoja tai paketissa suoritettavaa koodia.
- Paketissa on täsmälleen yksi Loop eikä Orchestratoria, project-global `loopEdges`-yhteyksiä tai ExecutionProfileja.
- External writes on paketissa aina `false`; network- ja profile-slot-yhteensopivuus on fail-closed.
- Tuonti ei hyväksy palvelimen mielivaltaista tiedostopolkua. Selain lukee paikallisen tiedoston ja lähettää JSON-sisällön loopback-API:lle.
- Olemassa olevat Loopit säilyvät custom Loopeina. Project config pysyy strict v10:nä.

## Todentaminen

Tavoite toteutuu, kun turvallinen package voidaan inspectoida, asentaa tyhjään projektiin, suoritusvalmistella nykyisen strict-v10-polun kautta, exportata semanttisesti vastaavaksi packageksi ja poistaa ilman config/resource-rikkoa; epäkelpo, liian suuri, ristiriitainen, aktiivinen tai oikeusrajaan sopimaton operaatio epäonnistuu täsmällisellä virhekoodilla ja ilman osittaista runtime-viitettä.
