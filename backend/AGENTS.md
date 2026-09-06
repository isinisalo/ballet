# Backend-agenttiohjeet

Noudata lisäksi juuren `AGENTS.md`-ohjeita.

- Pidä HTTP, request-validointi, domain, persistence ja provider/Git-adapterit erillisissä nimetyissä moduuleissa.
- Validoi jokainen request body API-rajalla ja palauta tunnettu 4xx-virhe. Älä castaa validoimatonta bodya domain-tyypiksi.
- `backend/orchestration` omistaa Environment Runin koostamisen; `shared/orchestration` omistaa jaetut sopimukset. Frontend ei importtaa backendistä.
- SQLite v24:n transaction boundary omistaa order/priority-gatet, dispatchin idempotenssin, local daemon claim/lease/fencingin, blocked+Feedbackin, approval-siirtymät ja continuation-linkin.
- Provider body tai agentin output ei saa valtuuttaa human operationia. Luotettu actor tulee paikallisesta request-contextista.
- Refinement-apply ei suorita proposalin komentoa eikä kirjoita nykyiseen checkoutiin.
- Pidä route handler alle 80, pure moduuli alle 250 ja service/adapteri alle 300 rivissä tai dokumentoi välttämätön poikkeus.
- Aja backend/shared-muutoksissa vähintään `npm run test`, `npm run lint` ja `npm run build`.
