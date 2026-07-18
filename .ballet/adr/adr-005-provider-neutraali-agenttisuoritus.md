---
id: adr-005
title: Palveluntarjoajariippumaton Codex- ja Copilot-suoritus
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - agenttisuoritus
  - palveluntarjoajarajapinta
version: 1
---

# Palveluntarjoajariippumaton Codex- ja Copilot-suoritus

## Konteksti

Codex CLI ja GitHub Copilot CLI tarjoavat erilaiset protokollat, tapahtumat, mallit ja käyttöoikeuskyvykkyydet. Balletin Run-, Loop- ja konsolimallien pitää säilyä samoina riippumatta siitä, kumpi palveluntarjoaja suorittaa yksittäisen agentin.

## Päätös

Codex ja Copilot integroidaan yhteisen paikallisen suoritussovittimen rajapinnan kautta.

- Codex-adapteri käyttää Codex app-serverin JSON-RPC-protokollaa ja Copilot-adapteri GitHub Copilot SDK:ta.
- Agentin kannettava ajoaikainen intentio määrittää eksplisiittisesti palveluntarjoajan, mallin, reasoning effortin ja verkkopolitiikan.
- Palveluntarjoajakomennon ohitus ja absoluuttiset vain luku -juuret ratkaistaan konekohtaisista asetuksista.
- Ennakkotarkistus tarkistaa asennuksen, CLI-version, autentikoinnin, mallin, reasoning-valinnan ja vaaditut käyttöoikeuskyvykkyydet ennen tehtävän jonotusta.
- Ballet normalisoi palveluntarjoajatapahtumat yhteiseen `ExecutionEvent`-muotoon.
- Agentin lopputulos validoidaan yhteistä strukturoitua `AgentOutcome`-skeemaa vasten.
- Codexilla ja Copilotilla on erilliset FIFO-kaistat. Yksi palveluntarjoaja suorittaa vain yhtä tehtävää kerrallaan, mutta eri palveluntarjoajat voivat toimia rinnakkain.
- Ballet ei tallenna palveluntarjoajan tunnuksia. Autentikointi tulee palveluntarjoajan CLI:stä tai sen tukemasta ympäristöstä, eikä palveluntarjoajaprosessi saa Balletin palvelutunnuksia.

## Seuraukset

- Loop-tilakone ja Run-käyttöliittymä eivät käsittele palveluntarjoajakohtaisia raakamuotoja.
- Uuden palveluntarjoajan lisääminen vaatii sovittimen, kyvykkyystarkistuksen, tapahtumanormalisoinnin ja strukturoidun lopputuloksen tuen.
- Agentti ei käynnisty, jos eksplisiittinen ajoaikainen valinta puuttuu tai paikallinen palveluntarjoaja ei pysty täyttämään sitä.
- Ballet ei vaihda palveluntarjoajaa, mallia tai reasoning effortia automaattisesti.
- Piilotettua päättelyketjua ei tallenneta tai näytetä; konsoli käyttää vain palveluntarjoajan julkaisemia tapahtumia ja reasoning-yhteenvetoja.
- Sovitintestit käyttävät testiaineistoja eivätkä edellytä asennettujen CLI-työkalujen ajamista.

## Toteutuksen lähteet

- `backend/execution/providers/CliRuntimeAdapter.ts`
- `backend/execution/providers/codex/CodexAppServerAdapter.ts`
- `backend/execution/providers/copilot/CopilotSdkAdapter.ts`
- `backend/execution/LocalExecutionQueue.ts`
- `shared/api/runtime-schemas.ts`
