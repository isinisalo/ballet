---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-06'
version: 57
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

Aktiivinen sopimus ja versiot: [ARCHITECTURE](../../ARCHITECTURE.md). Runtime: [STATE-CONTRACT](STATE-CONTRACT.md). UI: [DESIGN](../../DESIGN.md).

Viimeisin työ on käyttäjän hyväksymä [Event Stormingin yksinkertaistaminen](initiatives/event-storming-simplification/EVIDENCE.md). Event Storming on vapaaehtoinen prosessikartta: semantiikka on `model.json`-tiedostossa ja esitys erillisessä `layout.json`-tiedostossa. Kuuden prosessin 113 käsitettä ja aiemmat 13 esitystä säilyvät. Sama rajattu projektio palvelee HTTP:tä sekä checkoutin tai worktreen offline-CLI:tä. Story-linkit käyttävät nykyisiä tarinalähteitä ja estävät linkitetyn tarinan poiston; hyväksyntäsopimus säilyy.

Oletus-Environmentissa ovat Arc42, Design, Build ja Deploy järjestyksessä 1–4 sekä 18 Actionia. Kolme Event Storming Actionia ja kuusi niihin kuuluvaa agenttimääritystä on poistettu. Soveltuvat nykyiset Validation- ja Work-roolit lukevat valinnaisen `Action.input.eventStormingTarget`-kohteen Skill-ohjeen kautta. Yleinen runtime ja agenttien malliasetukset säilyvät.

Aiempi [ADR-recordien ja projektidomainin sisältötyö](initiatives/adr-records-event-storming/EVIDENCE.md) sekä [neljän Project-näkymän toteutus](initiatives/four-project-views/EVIDENCE.md) säilyvät historiallisena evidenssinä. Aktiivisia kolmirivisiä ADR:iä on 21 ja suomenkielisiä Draft-tarinoita 15. Tämän muutoksen yhteydessä tarinoiden sisältöä tai hyväksyntöjä ei muutettu. [Siirtokartoitus](ADR-CONTENT-MAP.md) kattaa lähtörevision ADR:t.

Aiemmat testimäärät ja startup-tulokset kuuluvat omiin revisioihinsa. Edeltävä STATUS säilyy Gitissä (`git show 1700e13b:.ballet/arc42/STATUS.md`). Runtime-baseline: [Environment orchestration](initiatives/environment-state-action-orchestration/EVIDENCE.md); paikallinen daemon: [checkout-local](initiatives/checkout-local-daemon/EVIDENCE.md); UI-historia: [Loop Engineering](initiatives/loop-engineering-three-level-dagre/EVIDENCE.md). Niiden tuloksia ei tulkita tämän checkoutin tuoreeksi testitulokseksi.
