# Backend-agenttiohjeet

Nämä ohjeet koskevat `backend/`-hakemistoa. Noudata lisäksi repositorion juuren `AGENTS.md`-ohjeita.

## Vastuurajat

- Pidä yksi tiedosto yhdessä vastuussa. Tiedoston nimen pitää kuvata sen päävastuuta.
- Älä sekoita HTTP-reittejä, request-validaatiota, domain-päätöksiä, tietokantatallennusta ja ulkoisten työkalujen adaptereita samaan uuteen tiedostoon.
- Sijoita request-validaattorit `backend/http/validation/`-tasolle tai muuhun nimettyyn validaatiomoduuliin.
- Sijoita runtime-, policy-, markdown-, persistence- ja adapterilogiikka omiin nimettyihin moduuleihinsa.
- Sijoita frontendin kanssa jaetut tyypit, sopimukset ja pure domain -funktiot `shared/`-tasolle. Älä importtaa backendistä frontend-koodia.

## API-rajat

- Validoi kaikki `req.body`-data API-rajalla ennen service- tai storage-kerroksen kutsua.
- Älä castaa `req.body as Something` ilman schemaa, eksplisiittistä validatoria tai tyyppivahtia.
- Validatorin pitää tarkistaa vähintään objektimuoto, pakolliset kentät, kenttien perustyypit ja tunnetut enum- tai union-arvot.
- Kun validointi hyväksyy vain osan rakenteesta, palauta validatorista rajattu tyyppi eikä alkuperäistä body-objektia laajana domain-tyyppinä.
- Palauta validointivirheistä tunnettu HTTP-virhe, jonka reitti käsittelee ilman yleistä 500-virhettä.

## Kokorajat

- Pidä route handler -funktio alle 80 rivissä ja siirrä monivaiheinen työ serviceen tai pure moduuliin.
- Pidä utility- ja pure logic -moduuli alle 250 rivissä.
- Pidä service- tai adapterimoduuli alle 300 rivissä, ellei tiedoston alussa ole kirjattua syytä poikkeukselle.
- Yli 300 rivin tiedosto vaatii dokumentoidun syyn. Kirjaa syy tiedoston alkuun lyhyellä kommentilla tai jaa tiedosto ennen uuden toiminnallisuuden lisäämistä.
- Jos muutat olemassa olevaa liian suurta tiedostoa, älä kasvata sitä ilman samalla tehtävää pilkkomista tai kirjattua poikkeusta.

## Validointi

- Aja `npm run lint` backend-koodin, validaattoreiden, service-kerroksen, adaptereiden tai jaettujen sopimusten muutosten jälkeen.
- Aja `npm run build`, kun muutos vaikuttaa TypeScript-rajapintoihin, backend-importteihin, bundlaukseen tai `shared/`-sopimuksiin.
- Lisää tai päivitä backend-testi, kun muutat request-validaatiota, reittejä, runtime-logiikkaa, persistence-logiikkaa tai adapterikäyttäytymistä.
