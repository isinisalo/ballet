---
id: arc42-section-11
title: Riskit ja tekninen velka
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 21
tags: [arc42, risks, technical-debt]
arc42Section: 11
---

# 11. Riskit ja tekninen velka

| ID | Riski | Kontrolli | Jäännösriski |
| --- | --- | --- | --- |
| RISK-023 | ordering/retry drift, approval replay, stale refinement, shared Skill impact, schedule recovery tai liian aikainen worktree cleanup rikkoo immutable control trailin | strict schemas, SQLite transactionit ja unique keys, expected hash/revision, reverse impact closure, durable schedules, retained commit/artifact refs ja TEST-028–TEST-032 | oikean providerin pitkä production-like occurrence ja ihmisen final visual verdict jäävät erikseen ajettaviksi |
| RISK-024 | daemon impersonation/replay, mixed checkout truth, Markdown field loss, unsafe resource path tai duplicate finalization rikkoo execution- tai audit-rajan | pairing token hash/keychain, TLS/loopback gate, heartbeat+same-device preflight, fenced lease, strict Markdown round-trip, allowlist+symlink+preimage checks ja TEST-033–TEST-037 | oikean kahden CLI:n pitkä production-like occurrence jää erilliseksi operatiiviseksi evidenssiksi |
| RISK-025 | local daemon katoaa kesken CLI:n, token vuotaa tai restart toistaa epäselvän sivuvaikutuksen | checkout-specific 0600 token, loopback-only API, one-time claim, lease/fencing, no requeue after claim, idempotent callbacks and TEST-038–TEST-040 | pitkä oikean CLI:n crash occurrence jää operatiiviseksi evidenssiksi |

Fresh-v18 cut poistaa runtime down-migration -riskin mutta vaatii paikallisen epäyhteensopivan tietokannan/control-plane-staten arkistoinnin tai poiston. Rollback on feature-haaran hylkääminen tai pre-cutover-commitin checkout, ei schema downgrade.
