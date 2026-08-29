---
id: goal-006
title: Durable runtime truth and immutable evidence
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-08-29'
version: 3
tags: [tavoite, runtime, evidence]
---

# Durable runtime truth and immutable evidence

## Tavoite

Ballet säilyttää Environment-, State-, Action-, Agent-, Feedback-, Critic-, Refinement- ja approval-faktat checkout-local SQLite v16:ssa niin, että eteneminen, keskeytys ja lopputulos voidaan selittää prosessin uudelleenkäynnistyksen jälkeen.

## Käyttäjäarvo

Operaattori näkee factual statukset, yritykset, blockerit, approval-provenienssin, commitit ja continuation-lineagen ilman keksittyä edistymistä tai provider-proosaan sidottua totuutta.

## Mitattavat success criteria

1. Retry exhaustion tallentaa Action `blocked` -faktan ja yhden Feedback-entryn samassa transaktiossa, myös duplicate callbackin ja restartin jälkeen.
2. Critic occurrence, proposal ja human decision ovat idempotentteja ja restart-recoverableja; overlap-occurrenceja syntyy 0.
3. Parent Root Snapshot muuttuu continuationin jälkeen 0 tavua, ja lineage viittaa exact proposal-, approval- ja commit-identiteetteihin.
4. Product Snapshot syntyy vain terminal completed Runista ja jokainen sen fakta voidaan johtaa canonical storeista.
