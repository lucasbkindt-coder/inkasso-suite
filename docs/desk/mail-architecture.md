# Desk-Mail – spätere Architektur

P0 verändert den vorhandenen `MAIL_TRANSPORT=log` nicht und ruft keine Postfächer ab. Die spätere Mailintegration soll die bestehende Kommunikations- und Dateiablage verwenden.

## Eingang

```text
Mail Provider / IMAP / Provider API
  → validierter Inbound-Adapter
  → tenantgebundenes Matching
  → DeskTicket
  → CommunicationEvent (EMAIL, INBOUND)
  → CommunicationAttachment im bestehenden Document Storage
```

Matching darf Absender oder Betreff nie ungeprüft als Tenant-/Party-Autorität behandeln. Unklare Nachrichten bleiben nicht zugewiesen. Dateityp-, Größen-, Malware- und Dateinamenprüfungen müssen vor Persistenz greifen.

## Ausgang

```text
Desk
  → serverseitige Mail Queue
  → Restriction-/RBAC-/Tenant-Prüfung
  → Provider
  → Delivery Status
  → CommunicationEvent / ActivityEvent
```

Der Browser übergibt später nur fachliche Eingaben. Credentials, Provider-Tokens und Versand bleiben serverseitig. Nachrichten werden erst nach erfolgreicher Queue-Annahme unveränderlich dokumentiert; Zustellstatus wird getrennt fortgeschrieben.
