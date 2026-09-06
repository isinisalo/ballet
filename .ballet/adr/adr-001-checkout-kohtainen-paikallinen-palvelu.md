[ADR-001: Checkout-kohtainen paikallinen palvelu]
Decision: Balletin käyttöliittymä, HTTP-palvelin ja orkestrointi toimivat yhden Git-checkoutin omistamana paikallisena palveluna.
Scope: Koskee checkoutin palveluidentiteettiä ja eristettyä ajonaikaista tilaa; provider-suorituksen omistaa saman checkoutin daemon.
