[ADR-042: Actionin omat Validation- ja Work-agentit]
Decision: Jokainen Action omistaa kaksi Action-tunnisteesta ja roolista johdettua Codex-agenttia TOML-määritelmineen sekä roolikohtaisen Skill-valinnan; Root Snapshot jäädyttää niiden täsmällisen koostumuksen.
Scope: Koskee Actionin ohjeita, model/reasoning-valintoja ja atomista authorointia. Erillistä execution bindingia ei ole; oikeuksia ei määritellä TOMLissa, ja Refinement saa muuttaa vain sallittua developer_instructions-sisältöä.
