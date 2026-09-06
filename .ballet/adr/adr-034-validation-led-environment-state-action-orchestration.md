[ADR-034: Validationin ohjaama Environment-suoritus]
Decision: Kanoninen domain on Environment → State → Action. Palvelin suorittaa Statet order- ja Actionit priority-järjestyksessä; Validation päättää työn tarpeesta ja hyväksyy alisteisen Workin tuloksen.
Scope: Koskee koko Environment Runia, retry-rajaa, atomista blocked-Feedbackia ja muuttumatonta continuationia. Myöhempi State odottaa kaikkien edeltävien Actionien done-tilaa; erillisiä State- tai Action-ajoja ei ole.
