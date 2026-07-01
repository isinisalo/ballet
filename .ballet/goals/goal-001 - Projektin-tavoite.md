---
id: goal-001
title: Projektin tavoite
created_date: 2026-06-06 07:19
updated_date: 2026-06-23
status: accepted
tags:
  - intent
  - goal
version: 1
---

# Projektin tavoite

## GOAL

Rakenna selainkäyttöinen yritysseurantapalvelu suomalaisille yrityksille.

Käyttäjä lisää yrityksen seurannan kohteeksi kerran. Sen jälkeen palvelu näyttää yrityksen koontinäkymässä perustiedot, EODHD-markkinadatan, Inderes Forum -keskusteluaineiston ja tiedonkeruun tilan niin, ettei käyttäjän tarvitse hakea samaa tietoa käsin erillisistä lähteistä.

## INTENT

Agenttien tulee tehdä ratkaisuja kohti keskitettyä yritysseurantapalvelua. Palvelu ei ole yleinen CRM, yritysrekisteri, sijoitusneuvontatyökalu, kaupankäyntipalvelu eikä yleinen sosiaalisen median keräin.

Kun agentti joutuu valitsemaan kattavuuden ja jäljitettävyyden välillä, jäljitettävyys voittaa. Käyttäjän pitää nähdä mistä tieto on peräisin, milloin se on haettu ja mitä keruun tilasta voidaan päätellä.

## PRODUCT SCOPE

Järjestelmän tavoitealueet ovat:

- Autentikointi: käyttäjän rekisteröinti, kirjautuminen, sähköpostivahvistus, salasanan resetointi ja hallintakäyttäjän käyttäjähallinta.
- Viestintä: käyttäjälle tarkoitettujen viestien muodostaminen, kirjaaminen ja toimitustilan näyttäminen.
- Yritysseuranta: seurattavat suomalaiset yritykset, yritysten tunnisteet, PRH/YTJ-perustiedot ja käyttäjän seuranta-asetukset.
- Markkinadata: seurattavien yritysten EODHD-markkinadatan haku, yhdenmukaistaminen, tallennus, lähdeattribuutio ja näyttäminen.
- Keskusteluaineisto: yrityskohtaisesti rajatun Inderes Forum -keskusteluaineiston haku, deduplikointi, tallennus, lähdeattribuutio ja näyttäminen.
- Tiedonkeruun ajastus: yrityskohtaisten EODHD- ja Inderes Forum -keruiden tiheyden määrittäminen, erääntyneiden keruiden käynnistäminen ja keruutilan näyttäminen.
- Tuotteen UX: moderni, nopea ja helppokäyttöinen web-sovellus, jossa käyttäjä löytää yritysseurannan olennaiset tiedot ilman turhaa kitkaa.

Osa-alueiden tavoitteet ovat näissä dokumenteissa:

- `specs/goals/goal-002 - Autentikointi.md`
- `specs/goals/goal-003 - Viestinta.md`
- `specs/goals/goal-004 - Yritysseuranta.md`
- `specs/goals/goal-005 - Markkinadata.md`
- `specs/goals/goal-006 - Keskusteluaineisto.md`
- `specs/goals/goal-007 - Tiedonkeruun-ajastus.md`
- `specs/goals/goal-008 - Tuotteen-UX.md`

## PRODUCT LIMITS

- Järjestelmä ei tuota sijoitusneuvontaa, osto- tai myyntisuosituksia, automaattisia kaupankäyntipäätöksiä eikä kaupankäyntitoiminnallisuutta.
- Reaaliaikainen jatkuva markkinadatavirta ei kuulu alkuvaiheen tavoitteeseen.
- Inderes Forum -aineisto rajataan seurattavaan yritykseen liittyvään keskusteluun; palvelusta ei tehdä yleistä keskusteluarkistoa.

## EVIDENCE

Tavoite on oikealla suunnalla, kun kirjautunut käyttäjä voi lisätä seurattavan suomalaisen yrityksen ja nähdä samasta selainnäkymästä yrityksen perustiedot, markkinadatan, keskusteluaineiston, lähteet, hakuajankohdat ja tiedonkeruun viimeisimmän tilan ilman arkaluonteisen tiedon vuotoa.
