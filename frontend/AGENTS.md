# Frontend-agenttiohjeet

Noudata lisäksi juuren `AGENTS.md`- ja `DESIGN.md`-sopimuksia.

- React-komponentti renderöi tilan ja välittää tapahtumat. Ordering, normalisointi, validointi, reititys ja derived-status kuuluvat pure `.ts` -moduuleihin.
- Käytä saman käyttötarkoituksen UI:ssa ensisijaisesti olemassa olevia shadcn- ja repositorioprimitivejä sekä niiden variantteja. Älä tee uutta markup-, tyyli- tai komponenttikieltä, jos nykyinen primitive voidaan koostaa tehtävään.
- Hookit omistavat API-kutsut, SSE-kuuntelun, selaintapahtumat ja monivaiheisen UI-tilan. Käytä olemassa olevia `useWorkspaceNavigation`- ja orchestration-hookkeja ennen uuden sivuvaikutuspolun lisäämistä.
- URL omistaa workspace- ja entity-valinnan. Selainhistoria, deep link ja back/forward eivät saa nojata piilotettuun client-tilaan.
- Näytä approvalissa exact hashit, diffi, impact ja current revision. Client ei päätä hyväksynnän kelpoisuutta tai muodosta uusia runtime-faktoja.
- Säilytä vähintään 40 px narrow-kontrollit, näkyvä focus, reduced-motion ja tekstilabelit jokaiselle semanttiselle värille.
- Frontend ei importtaa backendistä. Jaetut DTO:t ja pure sopimukset kuuluvat `shared/orchestration`-tasolle.
- Pidä React-komponentti alle 150, hook alle 120 ja pure moduuli alle 250 rivissä tai dokumentoi välttämätön poikkeus.
- Aja frontend-muutoksissa `npm run test`, `npm run lint`, `npm run build` ja soveltuva desktop/narrow-selain-QA.
