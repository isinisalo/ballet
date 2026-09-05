---
id: adr-047
title: Project Markdown authoring on editor-only
status: accepted
createdAt: '2026-09-05'
updatedAt: '2026-09-05'
version: 1
tags: [arkkitehtuuripaatos, markdown, ui, strict-removal]
---

# Project Markdown authoring on editor-only

## Konteksti

ADR-035 palautti Goals-, ADR-, Constraints-, Use Cases- ja Instructions-näkymiin yhteisen MarkdownWorkbench-sopimuksen, jossa editorin rinnalla oli renderöity preview. Skills käytti samaa workbenchiä. Projektin omistaja pyysi 2026-09-05 poistamaan previewn Goals-, ADR- ja vastaavista näkymistä ja vahvisti rajaukseksi kaikki kuusi yhteistä Markdown-näkymää.

## Päätösajurit

- `goal-023` / `REQ-023` ja QS-045.
- Yksi suora editointipinta pitää versionhallittavan Markdown-lähteen ensisijaisena totuutena.
- Preview ei saa pienentää editorin käytettävää tilaa desktop- tai narrow-näkymässä.
- Tallennuksen, validoinnin, dirty-navigation guardin, approvalin ja canonical URL -valinnan pitää säilyä muuttumattomina.

## Päätös

Goals, ADRs, Constraints, Use Cases, Instructions ja Skills käyttävät yhtä täysleveää editor-only `MarkdownWorkbench`-pintaa. Workbench näyttää YAML-frontmatter- ja Markdown body -editorit, validoinnin, metriikat ja olemassa olevat komennot, mutta ei renderöityä Markdown-previewtä.

Preview-komponentit, preview-kohtainen layout ja CSS sekä niiden yksinomaiset runtime-riippuvuudet poistetaan aktiivisesta toteutuksesta. API-, DTO-, repository-, hash-, approval- ja reitityssopimukset eivät muutu.

## Hylätyt vaihtoehdot

- **Preview säilytetään Skillsissä:** rikkoisi vahvistetun kuuden näkymän yhdenmukaisen rajauksen.
- **Preview piilotetaan togglella:** säilyttäisi pyytämättömän tilan, koodin ja riippuvuudet.
- **Preview vain desktopissa:** tekisi näkymäsopimuksesta viewport-riippuvaisen ilman käyttäjätarvetta.

## Seuraukset

- Editorilla on enemmän vaakasuoraa tilaa ja sama rakenne molemmissa hyväksytyissä viewporteissa.
- Käyttäjä arvioi tallennettavan Markdownin lähteenä; Ballet ei tarjoa näissä workbencheissä renderöityä esikatselua.
- `react-markdown`- ja `remark-gfm`-riippuvuuksia ei tarvita aktiivisessa frontendissä.

## Supersession

ADR-047 supersedoi ADR-035:n Authoring ja informaatiarkkitehtuuri -päätöksestä vain preview-vaatimuksen. ADR-035:n Markdown-lähde, erilliset canonical reitit, tallennus ja dirty-navigation guard sekä kaikki runtime-, Feedback-, Refinement- ja Run Evidence -päätökset säilyvät.

## Evidenssi ja review trigger

Trace on `goal-023` / `REQ-023`, QS-045, `adr-047` / CON-016, BB-016, RT-029, TEST-045, EVID-045 ja RISK-024. Päätös arvioidaan uudelleen vain, jos projektin omistaja pyytää renderöidyn Markdown-esityksen takaisin authoring-workspaceen.
