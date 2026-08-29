---
id: arc42-section-11
title: Riskit ja tekninen velka
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 20
tags: [arc42, risks, technical-debt]
arc42Section: 11
---

# 11. Riskit ja tekninen velka

| ID | Riski | Kontrolli | Jäännösriski |
| --- | --- | --- | --- |
| RISK-023 | ordering/retry drift, approval replay, stale refinement, shared Skill impact, schedule recovery tai liian aikainen worktree cleanup rikkoo immutable control trailin | strict schemas, SQLite transactionit ja unique keys, expected hash/revision, reverse impact closure, durable schedules, retained commit/artifact refs ja TEST-028–TEST-032 | oikean providerin pitkä production-like occurrence ja ihmisen final visual verdict jäävät erikseen ajettaviksi |

Fresh-v16 cut poistaa runtime down-migration -riskin mutta vaatii paikallisen epäyhteensopivan tietokannan arkistoinnin/poiston. Rollback on feature-haaran hylkääminen tai pre-cutover-commitin checkout, ei schema downgrade.
