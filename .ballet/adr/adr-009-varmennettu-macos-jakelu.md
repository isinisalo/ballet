[ADR-009: Varmennettu macOS-jakelu]
Decision: Ballet jaetaan natiiveina macOS arm64- ja x64-paketteina; suora julkaisuasennus ja päivitys tarkistavat SHA-256:n ja GitHub Artifact Attestationin ennen atomista aktivointia.
Scope: Koskee julkaistuja paketteja. Homebrew käyttää formulaansa sidottua tarkistussummaa ja omaa elinkaartaan; lähdecheckoutilla on erillinen paikallinen koonti- ja asennuspolku.
