---
id: goal-023
title: Selkeä Markdown-authoring ja agentin daemon-sidottu suoritus
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-09-05'
version: 2
tags:
  - tavoite
  - markdown
  - agents
  - daemon
---

# Selkeä Markdown-authoring ja agentin daemon-sidottu suoritus

## Tavoite

Ballet palauttaa versionhallittavan Markdownin ensisijaiseksi Goals-, ADR-, Constraints-, Use Case- ja Instructions-authoring-kokemukseksi, palauttaa Agentin projektitotuudeksi ja sitoo jokaisen Agentin eksplisiittisesti yhden paritetun Computerin CLI-runtimeen. Environment → State → Action ja Validation-first-looppi säilyvät, mutta niitä authoroidaan yhdessä Loop Engineering -työtilassa.

## Käyttäjäarvo

- Käyttäjä muokkaa dokumentin YAML-frontmatteria ja Markdown-runkoa suoraan yhdessä editorissa ilman rinnakkaista preview-näkymää.
- Goals ja ADRs ovat omat löydettävät näkymänsä, ja Use Case -lista säilyy kompaktina.
- Agentilla on näkyvä Computer → Provider → Model → Reasoning -sidonta; Copilot CLI ja Codex CLI toimivat saman daemon-protokollan kautta.
- Feedbackin ihmisrajapinta sisältää vain kategorian ja kommentin; järjestelmä lisää teknisen provenienssin.
- Tekninen loppuevidenssi näkyy Runissa eikä esiinny käyttäjälle erillisenä Product-domainina.

## Mitattavat success criteria

1. Goals-, ADR-, Constraints-, Use Cases-, Instructions- ja Skills-authoring säilyttää tuntemattoman validin frontmatterin ja bodyn byte-stabiilisti, varoittaa dirty-navigationista ja näyttää vain editorin ilman Markdown-previewtä.
2. Canonical reitistö sisältää erilliset `/project/goals` ja `/project/adrs` -reitit sekä 0 `/configure/*`- tai `/products/*`-reittiä.
3. Jokainen Environment Run preflightaa kaikki sen Agentit samalle online-laitteelle, samaan checkoutiin ja hyväksyttyyn config-hashiin; mixed/offline/dirty/auth/model/policy-tilat dispatchaavat 0 taskia.
4. Daemonin claim/lease/fencing- ja terminal callback -testit tuottavat restartissa ja replayllä täsmälleen yhden terminal outcome -faktan.
5. Sekä Codex CLI- että Copilot CLI -adapteri läpäisevät capability/preflight/dispatch-testit yhden AgentExecutionBindingin kautta.
6. Human Feedback POST hyväksyy vain `category` ja `comment`; ylimääräinen tai puuttuva kenttä hylätään strictisti.
7. Refinement proposal voi nimetä vain `.ballet/agents/**`, `.ballet/instructions/**` ja `.agents/skills/**`; muutostarve muualla tuottaa `blocked`-tilan ja 0 repository-kirjoitusta.
8. Aktiivisessa skeemassa, API:ssa, UI:ssa ja docs-contractissa on 0 Product/ProductSnapshot-entityä; successful Run sisältää immutable Run Evidence -projektion.
9. UI:ssa on 0 page-level vaakaylivuotoa ja kaikki ydintoiminnot ovat näppäimistöllä käytettäviä 1440×900- ja 390×844-viewporteissa.
10. Strict target on Project Config v21, Root Snapshot v14, Task Envelope/outcome v11, composition v12, ExecutionSpec v13, SQLite v17 sekä Feedback/Critic/Refinement v2 ilman migration/read/alias/dual-write-polkuja.

## Rajaus

Tavoite ei muuta Environment-järjestystä, Validation-first-semanttiikkaa, retry-kaavaa, immutable continuationia tai human approval -rajaa. Tuotteen deploy dev-ympäristöön jää projektikohtaiseksi myöhemmäksi kyvykkyydeksi; tässä muutoksessa ei luoda Product-entityä eikä tehdä deployta.

## Ihmispäätös

Projektin omistajan 2026-08-29 palaute hyväksyi vanhan Markdown-, Agents-, Environment-menu- ja daemon-kokemuksen palauttamisen, nykyisen Environment-runtime-semanttiikan säilyttämisen, Feedbackin kaksikenttäisen rajan, resurssirajatun Refinementin ja Product-näkymän poistamisen. Projektin omistajan 2026-09-05 pyyntö hyväksyi Markdown-previewn poistamisen kaikista kuudesta jaettua workbenchiä käyttävästä näkymästä. Valtuutus kattaa paikalliset commitit, ei pushia, mergeä, releasea tai deployta.
