[ADR-007: SQLite ajonaikaisen tilan omistajana]
Decision: Checkout-kohtainen SQLite on suoritusten, jonojen, tapahtumien, ajastusten sekä Critic- ja Refinement-hyväksyntöjen kestävä tallennuspaikka; toisiinsa sidotut tilamuutokset tehdään transaktioissa.
Scope: Koskee runtime-totuutta ja palautumista prosessikatkoksista. Projektidokumentit säilyvät Gitissä, eikä epäyhteensopivaa paikallista tietokantaa migroida.
