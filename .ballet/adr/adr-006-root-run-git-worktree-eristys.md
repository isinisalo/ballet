---
id: adr-006
title: Root Runin Git-worktree-eristys ja todennettava lähtötila
status: accepted
createdAt: '2026-07-18T00:00:00.000Z'
updatedAt: '2026-07-18T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - git-työpuu
  - suorituseristys
version: 1
---

# Root Runin Git-worktree-eristys ja todennettava lähtötila

## Konteksti

Agentit tarvitsevat kirjoitusoikeuden projektin tiedostoihin, mutta Run ei saa muuttaa käyttäjän aktiivista checkoutia tai vaihtaa lähtötilaansa kesken monivaiheisen suorituksen. Onnistunut tulos pitää voida yksilöidä commit-SHA:lla, ja epäonnistunut työ pitää säilyttää tutkittavana.

## Päätös

Jokainen Root Run suoritetaan omassa Git-worktreessä ja omalla haaralla tiivisteellä todennetusta käynnistyslähtötilasta.

- Runin käynnistys tarkistaa checkoutin juuren, HEAD-commitin ja lähdekoodin Git-tilan.
- Likaiset lähdekoodimuutokset estävät käynnistyksen; `.ballet`, `.codex/agents` ja `.agents/skills` saavat sisältää tilannekuvaan sisällytettäviä muutoksia.
- Root Runille luodaan haara `ballet/run/<root-run-id>` ja worktree `.git/ballet/worktrees/<root-run-id>`.
- Worktree luodaan Runin alussa havaitusta HEAD-commitista.
- Versionhallittu ja commitoimaton konfiguraatioaineisto luetaan tavallisina tiedostoina. Aineistosta muodostetaan manifesti tilannekuvatiivisteen laskemista varten, tiiviste tallennetaan ja tiedostot kopioidaan Runin kirjoitettavaan worktreehen käynnistyslähtötilaksi.
- Runin ExecutionSpec sitoo tehtävän HEADiin, konfiguraatio- ja tilannekuvatiivisteisiin, agenttiohjeisiin sekä ajoaikaisiin valintoihin.
- Saman Root Runin agentti-Stepien muutokset kertyvät samaan worktreehen niiden suoritusjärjestyksessä.
- `completed`-tilaan päättyvän Root Runin muutokset commitoidaan Ballet-identiteetillä, jos muutoksia on. Finalisointi raportoi joka tapauksessa worktreen nykyisen commit-SHA:n ja yrittää siivota worktreen; epäonnistunutta siivousta yritetään uudelleen palvelun käynnistyessä.
- `blocked`-, `failed`- ja `cancelled`-tilaan päättyvä Root Run finalisoidaan ilman commitia ja sen worktree säilytetään.
- Ballet ei yhdistä Run-haaraa eikä lähetä sitä etärepositoryyn.

## Seuraukset

- Käyttäjän aktiivinen checkout ei muutu agenttisuorituksen aikana.
- Saman Root Runin myöhempi Step näkee aikaisempien Steppien tiedostomuutokset.
- Konfiguraation muuttaminen aktiivisessa checkoutissa ei muuta jo käynnissä olevan Runin sisältöä.
- Worktree on tarkoituksella kirjoitettava: siellä tehty konfiguraatiomuutos voi vaikuttaa saman Root Runin myöhempään orkestrointiin. Käynnistyksen tallennettuina vertailuarvoina säilyvät tilannekuvatiiviste ja lähtöcommit.
- Finalisointi tarkistaa, että worktree ja haara vastaavat tallennettua Runia ja että tallennettu `headSha` on worktreen nykyisen HEADin esi-isä.
- Onnistuneen Runin raportti sisältää commit-SHA:n ja muuttuneet tiedostot; uusi commit syntyy vain, jos Git-indeksin diff ei ole tyhjä. Muun terminaalitilan raportti sisältää säilytetyn worktreen.
- Säilytettyjen worktree-tilojen siivoaminen on eksplisiittinen ylläpitotoimi, ei automaattinen onnistumispolku.

## Toteutuksen lähteet

- `backend/execution/git/LocalWorkspaceManager.ts`
- `backend/runs/LocalRunService.ts`
- `backend/runs/RootFinalizationCoordinator.ts`
- `backend/runs/RootRunStore.ts`
- `shared/domain/runtime.ts`
