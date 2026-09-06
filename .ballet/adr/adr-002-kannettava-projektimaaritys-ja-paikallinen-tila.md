[ADR-002: Projektimäärityksen ja ajonaikaisen tilan erottaminen]
Decision: Projektimääritys, projektidokumentit, Agent-TOMLit ja Skillit versionhallitaan Gitissä; konekohtaiset runtime-faktat ja väliaikaiset työtilat säilytetään erillään projektimäärityksestä.
Scope: Koskee projektin siirrettävyyttä ja tietojen omistusta. SQLite ja paikalliset asetukset eivät ole projektin intention rinnakkainen lähde.
