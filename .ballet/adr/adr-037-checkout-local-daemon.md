[ADR-037: Yksi paikallinen daemon checkoutia kohti]
Decision: Saman checkoutin paikallinen daemon omistaa Codex CLI -prosessit ja valmiustarkistukset; palvelin omistaa työjonon, leaset, worktreet, finalisoinnin ja evidenssin.
Scope: Koskee vain loopbackin kautta checkout-kohtaisella bearer-tokenilla toimivaa daemonia. Etälaitteita, paritusta tai toista suorituskohdetta ei ole.
