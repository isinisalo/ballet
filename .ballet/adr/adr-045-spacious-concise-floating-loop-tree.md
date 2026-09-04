---
id: adr-045
title: Loop-puu käyttää väljää ja kevyesti kaareutuvaa esitystä
status: accepted
createdAt: '2026-09-04'
updatedAt: '2026-09-04'
version: 4
tags: [arkkitehtuuripaatos, loop-engineering, react-flow, dagre, accessibility]
---

# Loop-puu käyttää väljää ja kevyesti kaareutuvaa esitystä

## Konteksti

ADR-044 toi canonical STATE -> ACTION -> AGENTS -puun, mutta sen name + exact ID -labelit, tiivis välistys ja kiinteä reititys tekivät haarasta levottoman. Projektin omistajan steering täsmensi hyväksytyn esityksen: väljemmät nodet, aina näkyvä valitun Staten Action-haara, lyhyet nimet ilman näkyviä ID:itä tai toistuvaa State-etuliitettä, oikea–vasen floating-ankkurointi näkyvin connection point -ympyröin, yksi kevyt kaari ilman suoraa tai monikulmaista "matoa" sekä React Flow -attribuutiobadgen poisto.

## Päätös

ADR-044:n React Flow + Dagre -rakenne, canonical järjestys, URL-owned valinta/luonti, yhteinen Action-draft ja strict planet/Action-flow removal säilyvät. Sarakkeiden välissä on noin yhden nodeleveyden rank-gap ja peräkkäisten nodejen välissä selvä tokenisoitu tyhjä tila. Valittu State keskitetään Action-ryhmän ympärille ja Agent-pari valitun Actionin ympärille. Kaikki State -> Action -edget säilyvät näkyvinä myös Action-valinnan jälkeen. Valittu node ja edge näkyvät täydellä opacitylla; kaikki ei-valitut nodet sekä order-/branch-katkoviivat näkyvät 25 % opacitylla.

Canvas-node ja vasemman Loop Engineering -menun Action-rivi näyttävät vain lyhyen nimen. Actionista poistetaan näyttöä varten täsmällinen omistavan Staten `State name - ` -etuliite. State-, Action- ja Agent-ID:t sekä Actionin täysi canonical nimi säilyvät URL:ssa, saavutettavassa nimessä ja asetuspaneelissa, mutta eivät tiiviin navigaation näkyvässä tekstissä.

Risti-rankin yhteyspiste sijaitsee lähdenoden oikean laidan ja kohdenoden vasemman laidan geometrisella keskellä. Connection point -ympyrä piirretään samalla linjalla 8 px irti noden reunasta, ja Bézier-path alkaa lähtöympyrän keskeltä sekä päättyy kohdeympyrän keskelle; ympyrän ja noden välissä ei ole edgeä. "Floating" tarkoittaa nimenomaan tätä irrotettua ympyrää, ei reunaa pitkin liikkuvaa ankkuria. Edge on yksi 1.5 px Bézier-kaari: kevyt vaikutelma syntyy geometriasta ja valinnan opacity-hierarkiasta, ei langanohuesta strokesta. Monimutkaista smoothstep-siksakkia tai nodejen ylä-/alareunaan vaihtavaa reittiä ei käytetä. Pystyjärjestyksen State-edget ja sisarhaarat säilyvät hillittyinä katkoviivoina. React Flow -attribuutiobadge piilotetaan komponentin asetuksella.

ADR-045 supersedoi ADR-044:n node-label-, spacing- ja edge-esityspäätökset. Se ei muuta domainia, configia, APIa, persistenssiä, runtimea, Agent-identiteettejä tai saavutettavaa navigointia.

## Seuraukset

- Valittu haara on luettavissa ilman toistuvia teknisiä tunnisteita.
- Suurempi välistys, keskitetyt ryhmät, fokuspolku ja yksi kaari vähentävät edge-risteyksiä ja mutkia.
- Irrotetut floating-ympyrät näyttävät kiinteät sivukeskikohdat mutta eivät tee graphista muokattavaa.
- ID:t pysyvät ohjelmallisesti ja asetuksissa saatavilla.

## Hylätyt vaihtoehdot

- **Suora edge:** liian mekaaninen eikä vastaa hyväksyttyä smooth-esitystä.
- **React Flow smoothstep:** useat ortogonaaliset käännökset muodostavat tiheässä fan-outissa matomaisen reitin.
- **ID jokaisessa nodessa:** toistaa asetuspaneelin ja URL:n teknisen tiedon sekä heikentää nimihierarkiaa.
- **Kiinteä keskihandle:** kasaaisi useat yhteydet samaan pisteeseen eikä ilmaisisi floating-liittymää.

## Evidenssi ja review trigger

Trace on `goal-023` / `REQ-023`, QS-033, adr-045 / CON-016, BB-016/BB-018, RT-029, TEST-033 ja EVID-033 / LTD-evid-005.

Uusi ADR vaaditaan, jos edgeistä tulee muokattavia domain-yhteyksiä, nodekoordinaatit tallennetaan tai esitys alkaa näyttää useita State-haaroja yhtä aikaa.
