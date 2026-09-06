[ADR-003: Yhteinen TypeScript-sovellusarkkitehtuuri]
Decision: Ballet käyttää Node.js- ja TypeScript-sovellusta, React-käyttöliittymää, Express-HTTP-palvelinta ja yhteisiä tyypitettyjä sopimuksia frontend-, backend- ja shared-alueilla.
Scope: Koskee sovelluskerrosten vastuunjakoa ja rajapintoja. Frontend ei tuo backend-moduuleja; shared omistaa yhteiset puhtaat sopimukset.
