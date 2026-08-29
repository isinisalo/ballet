---
id: arc42-section-03
title: Konteksti ja rajaus
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 8
tags: [arc42, context, interfaces]
arc42Section: 3
---

# 3. Konteksti ja rajaus

Ihminen authoroi ja hyväksyy direction-dokumentit sekä käyttää paikallista UI:ta. Ballet lukee Git-checkoutin project truthin, kutsuu valittua paikallista provider-adapteria, eristää Workin managed worktreehen ja tallentaa machine-local runtime truthin SQLiteen. Selain käyttää loopback HTTP/SSE -rajapintaa.

Järjestelmän ulkopuolelle jäävät käyttäjän Git remote, trackerit, julkaisu- ja deploy-kohteet. Niihin ei kirjoiteta ilman erillistä, täsmällistä valtuutusta. Providerin teksti on epäluotettua inputia eikä approval-komento.

Project truth: `.ballet/project.json`, Goals, ADR:t, Constraints, Use Caset, instructionit ja Skillit. Runtime truth: snapshotit, statukset, yritykset, eventit, Feedback, proposalit, approvalit ja continuation-lineage `.git/ballet`-alueella.
