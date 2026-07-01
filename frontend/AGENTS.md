# Frontend-agenttiohjeet

Nämä ohjeet koskevat `frontend/`-hakemistoa. Noudata lisäksi repositorion juuren `AGENTS.md`-ohjeita. Kun muutat käyttöliittymää, komponentteja, layoutia tai tyylejä, lue ensin juuren `DESIGN.md`.

## Vastuurajat

- Pidä yksi tiedosto yhdessä vastuussa. Tiedoston nimen pitää kuvata sen päävastuuta.
- Älä sijoita domain-algoritmia React-komponenttiin. Komponentti renderöi tilan ja välittää tapahtumat.
- Sijoita graafin muodostus, datan normalisointi, validointi, reititys ja layout-algoritmit pure function -moduuleihin `.ts`-tiedostoissa.
- Sijoita DOMia tarvitsematon logiikka ensin `.ts`-moduuliin ja testaa se ilman React-renderöintiä, kun logiikka vaikuttaa käyttäytymiseen.
- Älä lisää YAML-, TOML-, Markdown- tai muuta parserointilogiikkaa yleisiin sovelluskomponentteihin. Sijoita parserit nimettyihin dokumentti- tai adapterimoduuleihin.
- Älä importtaa frontendistä `backend/`-hakemistoa. Jaetut tyypit, sopimukset ja pure domain -funktiot kuuluvat `shared/`-tasolle.

## Komponentit ja hookit

- Komponentti saa omistaa vain renderöinnin, paikallisen UI-tilan ja tapahtumien välittämisen.
- Hookki omistaa sivuvaikutukset, kuten API-kutsut, stream-kuuntelun, selaintapahtumat, tallennusajastukset ja monivaiheisen käyttöliittymätilan.
- Käytä olemassa olevia hook-rajoja ennen uuden sivuvaikutuspolun lisäämistä. Hyviä rajoja ovat esimerkiksi `useRuntimeStream`, `useWorkspaceNavigation` ja `useAgentEditor`.
- Nimeä uusi hookki sen omistaman sivuvaikutuksen tai tilakokonaisuuden mukaan.
- Älä tee komponentista väliaikaista säiliötä logiikalle, joka kuuluu hookkiin tai pure `.ts`-moduuliin.

## Kokorajat

- Pidä React-komponentti alle 150 rivissä.
- Pidä hook alle 120 rivissä.
- Pidä utility- ja pure logic -moduuli alle 250 rivissä.
- Yli 300 rivin tiedosto vaatii dokumentoidun syyn. Kirjaa syy tiedoston alkuun lyhyellä kommentilla tai jaa tiedosto ennen uuden toiminnallisuuden lisäämistä.
- Jos muutat olemassa olevaa liian suurta tiedostoa, älä kasvata sitä ilman samalla tehtävää pilkkomista tai kirjattua poikkeusta.

## Validointi

- Aja `npm run lint` frontend-koodin, komponenttien, hookkien, CSS:n tai Tailwind-luokkien muutosten jälkeen.
- Aja `npm run build`, kun muutos vaikuttaa frontend-koodiin, komponenttien rajapintoihin, CSS:ään, Tailwind-luokkiin tai bundlaukseen.
- Lisää tai päivitä DOMiton yksikkötesti pure logic -moduulille, kun siirrät komponentista algoritmista logiikkaa `.ts`-tiedostoon.
