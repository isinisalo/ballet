[ADR-008: Paikallinen HTTP-raja ja roolien oikeudet]
Decision: HTTP-palvelin rajataan loopbackiin ja validoituihin pyyntöihin; ihmisen toimivalta saadaan luotetusta paikallisesta rajasta ja agentin oikeudet johdetaan sen roolista.
Scope: Koskee HTTP-, SSE-, daemon- ja provider-rajoja. Providerin tuloste tai pyynnön sisältö ei myönnä ihmisen hyväksyntävaltaa eikä laajenna oikeuksia.
