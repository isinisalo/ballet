---
id: arc42-project-status
title: Balletin arkkitehtuuristatus ja handoff
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-09-06'
version: 56
tags: [arc42, status, handoff]
---

# Balletin arkkitehtuuristatus ja handoff

Aktiivinen sopimus ja versiot: [ARCHITECTURE](../../ARCHITECTURE.md). Runtime: [STATE-CONTRACT](STATE-CONTRACT.md). UI: [DESIGN](../../DESIGN.md).

Viimeisin työ on käyttäjän hyväksymä [suomenkielisten ADR-recordien, korttikäyttöliittymän ja Event Stormingin toteutus](initiatives/adr-records-event-storming/EVIDENCE.md). Aktiivisia kolmirivisiä ADR:iä on 21. Nykyiset vaatimukset ovat 15 suomenkielisessä Draft-tarinassa hyväksymiskriteereineen; ihmishyväksyntöjä ei ole luotu. Event Storming sisältää yhden Big Picture -taulun, kuusi prosessitaulua ja kuusi ohjelmistosuunnittelutaulua. [Siirtokartoitus](ADR-CONTENT-MAP.md) kattaa lähtörevision kaikki ADR:t. Tarinoiden hyväksyntä ei ole Run-portti. Aiempi [neljän Project-näkymän toteutus](initiatives/four-project-views/EVIDENCE.md) ja sen muuttumaton hyväksyntäarkisto säilyvät historiallisena evidenssinä.

Aiemmat testimäärät ja startup-tulokset kuuluvat omiin revisioihinsa. Edeltävä STATUS säilyy Gitissä (`git show 1700e13b:.ballet/arc42/STATUS.md`). Runtime-baseline: [Environment orchestration](initiatives/environment-state-action-orchestration/EVIDENCE.md); paikallinen daemon: [checkout-local](initiatives/checkout-local-daemon/EVIDENCE.md); UI-historia: [Loop Engineering](initiatives/loop-engineering-three-level-dagre/EVIDENCE.md). Niiden tuloksia ei tulkita tämän checkoutin tuoreeksi testitulokseksi.
