---
id: goal-007
title: Accessible factual operator workspace
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-08-29'
version: 5
tags: [tavoite, kayttokokemus, accessibility]
---

# Accessible factual operator workspace

## Tavoite

Ballet tarjoaa tiiviin cyber-industrial-työtilan, jossa Goals, ADRs, Constraints, Use Cases, Agents, Runtimes, Loop Engineering, Run Gate, Feedback, Critic, Refinement ja Run Evidence ovat selkeitä, factual ja saavutettavia.

## Käyttäjäarvo

Ihminen ymmärtää, mitä voidaan muokata, mikä on lukittu, miksi eteneminen estyy ja mitä exact approval vaikuttaa. Ydintoiminto ei riipu väristä, hiirestä tai leveästä näytöstä.

## Mitattavat success criteria

1. Canonical routejen deep link, back/forward ja invalid-ID recovery toimivat ilman rinnakkaista client-owned control statea.
2. Kaikki approval-komennot ovat keyboard-reachable, näyttävät revision/hash-vaikutuksen ja käyttävät tekstiä tai icon+label-statusta.
3. 1440×900- ja 390×844-viewporteissa page-level horizontal overflow, clipped core action ja alle 40 px mobile primary control ovat 0.
4. UI näyttää vain API/DTO-faktoja; force-done, invented progress/ETA ja agent approval -control ovat poissa.
