---
id: goal-005
title: Safe and repeatable Git execution
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-08-29'
version: 4
tags: [tavoite, git, turvallisuus]
---

# Safe and repeatable Git execution

## Tavoite

Jokainen Environment Run ja hyväksytty Refinement-apply käyttää hash-sidottua, rajattua managed worktree -työtilaa. Agentti ei muuta käyttäjän aktiivista checkoutia eikä saa ulkoisen lifecycle-kirjoituksen valtuutta implisiittisesti.

## Käyttäjäarvo

Operaattori voi tarkastaa jokaisen onnistuneen paikallisen commitin, säilyttää epäonnistuneen diagnostiikan ja hylätä koko feature-haaran ilman runtime rollback -migraatiota.

## Mitattavat success criteria

1. Agentin workspace-write osuu aktiiviseen checkoutiin 0 kertaa ja allowlistin ulkopuolelle 0 kertaa.
2. Refinement proposal kirjoittaa 0 tiedostoa; validi hyväksytty apply tuottaa yhden paikallisen commitin ja yhden continuation Runin.
3. Merge-, push-, release-, deploy- ja external-write-operaatioita tapahtuu ilman erillistä exact human authorizationia 0 kertaa.
4. Stale hash, symlink, traversal tai osittainen validointivirhe tuottaa 0 projektitiedostomuutosta.
