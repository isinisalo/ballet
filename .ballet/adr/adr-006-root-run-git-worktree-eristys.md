[ADR-006: Runin eristetty Git-työtila]
Decision: Environment Runin kirjoittava työ suoritetaan palvelimen hallitsemassa Git-worktreessä todennetusta lähtöcommitista ja muuttumattomasta Root Snapshotista.
Scope: Koskee Work-suoritusta, paikallista finalisointia ja Refinement-applyta; käyttäjän aktiivinen checkout ja parent Run säilyvät muuttumattomina.
