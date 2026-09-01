# Zoho Desk Foundation

## Zweck und Systemgrenze

Zoho Desk wird als künftiger Kommunikations-Hub für Tickets, E-Mail und CTI angebunden. payveo bleibt das führende System für Parteien, Inkassoakten, Forderungen, Zahlungen, Dokumente, Aufgaben, Aktivitäten und die Kommunikationshistorie. P1 enthält ausschließlich Konfiguration, lesende Lookups und manuell ausgelöste Verknüpfungen. Es gibt weder automatische externe Mutationen noch Synchronisationsjobs, Webhooks oder CTI-Funktionen.

## OAuth-Konfiguration

Die Zugangsdaten werden ausschließlich im API-Prozess gelesen:

- `ZOHO_DESK_CLIENT_ID`
- `ZOHO_DESK_CLIENT_SECRET`
- `ZOHO_DESK_REFRESH_TOKEN`
- `ZOHO_DESK_ORG_ID`
- `ZOHO_DESK_REGION` (standardmäßig `EU`)

Der Client tauscht den Refresh Token serverseitig gegen einen kurzlebigen Access Token und hält diesen nur im Speicher. Tokens und OAuth-Secrets werden weder an das Frontend übertragen noch protokolliert. Für die Foundation sollten nur die erforderlichen lesenden Zoho-Desk-Scopes vergeben werden, insbesondere für Organisation, Kontakte, Tickets und Suche.

Die kontrollierten Regionen sind `EU`, `US`, `IN`, `AU`, `JP` und `CA`. Regionale OAuth-, API- und Web-Basis-URLs werden ausschließlich aus einer internen Allowlist abgeleitet. Eine URL aus Benutzereingaben wird nie als Request- oder Ticket-Ziel verwendet.

Referenzen: [Zoho Desk API](https://desk.zoho.com/DeskAPIDocument?src=rest-api), [Zoho OAuth Refresh Token](https://www.zoho.com/fsm/developer/help/api/access-refresh.html).

## Datenmapping und externe Identitäten

`ExternalIntegrationLink` speichert tenantgebundene externe Referenzen:

| Entity-Typ | payveo-Entität | Zoho-Entität | Kardinalität |
| --- | --- | --- | --- |
| `PARTY_CONTACT` | `Party` mit Rolle CLIENT oder DEBTOR | Desk Contact | höchstens ein Kontakt je Party |
| `CASE_TICKET` | `Case` | Desk Ticket | mehrere Tickets je Akte |
| `COMMUNICATION_MESSAGE` | `CommunicationEvent` | externe Nachricht | je externe ID eindeutig |
| `COMMUNICATION_ATTACHMENT` | `CommunicationEvent` | externer Anhang | je externe ID eindeutig |

Die Kombination aus Tenant, Provider, Entity-Typ und externer ID ist eindeutig. Dadurch kann dieselbe externe Nachricht später nicht doppelt importiert werden. Ein Datenbank-Check stellt zusätzlich sicher, dass jeder Link genau auf den zum Entity-Typ passenden lokalen Datensatz zeigt.

Die Metadaten eines Links sind nur ein kleiner, unkritischer Anzeigesnapshot. Zoho wird nicht zur zweiten Stammdatenwahrheit. Das Verknüpfen und Lösen erfolgt in P1 ausschließlich durch berechtigte Mitarbeitende.

## Matching

Die Matching Foundation arbeitet ausschließlich deterministisch und tenantgebunden:

1. vorhandene explizite External-Link-Zuordnung,
2. exakt übereinstimmende, kleingeschriebene E-Mail-Adresse,
3. exakt übereinstimmende normalisierte Telefonnummer.

Genau ein Treffer ergibt `MATCHED`. Mehrere Treffer ergeben `REVIEW_REQUIRED`; es erfolgt keine automatische Zuordnung. Ohne exakten Treffer gilt `NOT_FOUND`. Fuzzy Matching ist ausdrücklich nicht Bestandteil von P1.

## Kommunikation und Anhänge

Spätere importierte Nachrichten werden als bestehende `CommunicationEvent`-Datensätze mit Quelle `EXTERNAL` abgelegt. Die External-Link-Eindeutigkeit dient als Idempotenzschlüssel. Es wird keine zweite Kommunikationshistorie aufgebaut.

Anhänge werden bei einer späteren Synchronisierung zunächst kontrolliert heruntergeladen, validiert und anschließend über den bestehenden sicheren lokalen Document Storage abgelegt. Externe Zoho-URLs sind niemals dauerhafte Dateiquellen. P1 lädt keine Anhänge und legt keine CommunicationEvents an.

## Sicherheit und Berechtigungen

- `integration:read`: Status, Links und lesende Zoho-Suchen
- `integration:manage`: Verbindungstest sowie manuelles Verknüpfen und Lösen
- Tenant Owner und Administrator: Lesen und Verwalten
- Teamleiter: Lesen
- Sachbearbeitung, Buchhaltung und Lesen: kein Zugriff

Jeder lokale Lookup und jede Mutation wird mit der Tenant-ID des authentifizierten Staff-Kontexts eingeschränkt. Externe IDs werden validiert, API-Aufrufe haben ein festes Zeitlimit, und Fehler werden ohne Token- oder Secret-Inhalte normalisiert.

## Nächste Schritte

Ein Folgesprint kann nach technischer Prüfung folgende Funktionen einzeln ergänzen:

1. kontrollierten Ticket-/Mail-Import mit Idempotenz und Review Queue,
2. sichere Attachment-Übernahme in den Document Storage,
3. Webhook-Signatur- und Replay-Schutz oder kontrolliertes Polling,
4. ausgehende Ticket-/Kontaktaktionen mit expliziter Staff-Bestätigung,
5. getrennte CTI-Architektur für Anbieter, Screen Pop und Anrufereignisse.

SIP, WebRTC, Softphone, Recording, automatische Anrufannahme und Telefonieprovider sind nicht Teil der Foundation.
