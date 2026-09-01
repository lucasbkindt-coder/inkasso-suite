# payveo Desk – Foundation P0

## Zweck und Systemgrenze

payveo Desk ist eine zusätzliche Staff-Oberfläche für Tickets und interne Kommunikationsarbeit. Party, Inkassoakte, Aufgaben und Mitarbeitende bleiben in der bestehenden payveo-Datenbasis führend. Desk erzeugt deshalb weder eigene Kontakte noch eine zweite Akten- oder Kommunikationshistorie.

Das Modell `DeskTicket` ist tenantgebunden und kann optional genau eine bestehende `Party`, eine `Case`, eine aktive `TenantMembership` und ein `Team` referenzieren. Alle Kontextzuordnungen werden im Service gegen den aktiven Tenant geprüft. Ticketnummern folgen `D-JJJJ-NNNNNN`; `DeskTicketNumberSequence` erhöht den Zähler atomar pro Tenant und Kalenderjahr innerhalb derselben Prisma-Transaktion. Die Unique Constraints auf Nummer und Sequenz sind die zweite Absicherung gegen Kollisionen.

## Kommunikation, Dateien und Audit

Interne Ticketnotizen sind `CommunicationEvent` mit `direction=INTERNAL`, `channel=INTERNAL` und `deskTicketId`. Dadurch bleibt `CommunicationEvent` die zentrale Kommunikationswahrheit. Bestehende `CommunicationAttachment`-Datensätze nutzen unverändert den geschützten serverseitigen Document Storage; Downloads werden tenant- und ticketgebunden geprüft. P0 bietet keinen neuen Upload und versendet keine externe Nachricht.

Relevante Änderungen an Ticket, Status, Priorität, Bearbeitung, Party, Akte und internen Notizen werden über `ActivityEvent` protokolliert. Metadaten enthalten nur technische Referenzen und Zustandsänderungen, keine vollständigen Nachrichtentexte.

## Authentifizierung und Berechtigungen

Desk verwendet dieselbe `StaffSession`, dieselben Benutzer und denselben Tenant-Kontext wie der interne Arbeitsbereich. Es gibt keine zweite Passwort- oder Userverwaltung. Die Permissions sind:

- `desk:read`: Dashboard, Listen, Details und Anhänge lesen
- `desk:manage`: Tickets anlegen/ändern und interne Notizen erfassen
- `desk:assign`: Bearbeiter und Teams zuweisen

Tenant Owner und Administrator erhalten alle drei Rechte, Teamleitung ebenfalls, Sachbearbeitung `read/manage`. Buchhaltung und reine Leserechte erhalten standardmäßig keinen Desk-Zugriff.

Lokal vermittelt jede Next-App ihre API-Aufrufe über den eigenen `/api`-Rewrite. Der bestehende Host-only-Cookie funktioniert damit auf `localhost` ohne unsichere Domain-Ausweitung. Für `desk.payveo.de` ist später eine explizite Entscheidung nötig: zentraler Staff-Identity-Provider beziehungsweise kurzlebiger Subdomain-Austauschcode ist gegenüber einem pauschalen `.payveo.de`-Cookie zu bevorzugen. P0 weitet Cookie-Domains nicht auf.

## DSGVO und Verarbeitungseinschränkung

Desk-Tickets und Ticketkommunikation werden beim bestehenden Party-Auskunftsexport als eigenständige Ticketdaten beziehungsweise CommunicationEvents erfasst. Die vorhandene Erasure-Review bleibt maßgeblich; P0 führt keine automatische physische Löschung ein. Eine aktive Verarbeitungseinschränkung wird in Desk sichtbar. Interne Dokumentation bleibt möglich. Externe Automatisierung oder Versand existiert in P0 nicht und muss später vor jeder Ausführung serverseitig gegen die Restriktion geprüft werden.

## Konfiguration

`DESK_PUBLIC_BASE_URL` steuert die URL, die der interne Arbeitsbereich für kontrollierte Desk-Links verwendet. Lokal ist dies `http://localhost:3002`, später beispielsweise `https://desk.payveo.de`. Die URL wird ausschließlich über einen authentifizierten, permission-geschützten Konfigurationsendpunkt ausgeliefert und nicht in Fachlogik verteilt.
