# ADR 0001: Party as canonical master data

## Status

Accepted

## Context

Auftraggeber und Schuldner sind beides Parteien im Forderungsmanagement. Separate,
langfristig unabhängige Stammdatensilos würden doppelte Adressen, Kontakte und
uneinheitliche Identitäten erzeugen.

## Decision

`Party` ist die tenantgebundene kanonische Stammdatenwurzel. Eine Party ist entweder
eine `PERSON` oder eine `COMPANY` und besitzt genau ein passendes Profil (`Person`
beziehungsweise `Company`). Rollen wie `CLIENT` und `DEBTOR` werden über `PartyRole`
als kontextuelle Eigenschaften modelliert. Adressen und Kontakte gehören der Party.

Die technische Invariante, dass eine `PERSON` nur ein `Person`-Profil und eine
`COMPANY` nur ein `Company`-Profil besitzt, wird später im Service-Layer validiert.
Prisma kann die Übereinstimmung von `Party.type` und dem vorhandenen Profil nicht
vollständig deklarativ erzwingen.

## Consequences

Die bestehende Tabelle `Debtor` bleibt zunächst unverändert parallel bestehen. Eine
spätere Datenmigration von `Debtor` zu `Party` wird separat geplant und durchgeführt;
sie ist ausdrücklich nicht Bestandteil dieser Einführung.
