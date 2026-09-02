# payveo Desk Mail Foundation P1

## Leitprinzip

`CommunicationEvent` bleibt die fachliche Kommunikationshistorie. `MailMessage` ergänzt genau ein Event um RFC-/Zustellmetadaten; `MailDraft` verweist ebenfalls auf sein zugehöriges Event. Es gibt keine zweite E-Mail-Timeline und keine automatische Anlage einer Inkassoakte.

## Eingehender Flow

```text
vertrauenswürdiger Provider-Adapter / kontrollierter .eml-Import
  → MailParserService
  → Idempotenzprüfung
  → Thread-, Party- und Aktenmatching
  → bestehendes oder neues DeskTicket
  → CommunicationEvent + MailMessage
  → Original-.eml und zulässige Anhänge im Document Storage
  → MailReviewItem bei jeder unsicheren Zuordnung
```

Der Import ist tenantgebunden und transaktional für Datenbankzustände. Eine gespeicherte Datei wird bei einem fehlgeschlagenen Datenbankvorgang wieder entfernt. Neue E-Mails markieren das Ticket als ungelesen und bleiben ohne eindeutige Zuordnung in der Review-Queue.

## Threading und Matching

Die Reihenfolge ist: vertrauenswürdiges explizites Ticket-Mapping, `In-Reply-To`, `References`/bekannte Message-ID-Kette, eindeutiges Aktenzeichen im Format `0000001/2026`, exakte aktive E-Mail-Adresse einer Party oder eines Mandanten-Ansprechpartners. Es gibt kein Fuzzy Matching. Mehrere Treffer erzeugen einen Review-Eintrag; eine Akte wird niemals automatisch erzeugt.

## Idempotenz

Normalisierte Message-IDs werden als SHA-256-Idempotenzschlüssel je Tenant gespeichert. Fehlt die Message-ID, ist SHA-256 über die unveränderten Rohdaten der deterministische Fallback. `@@unique([tenantId, idempotencyKey])` ist die letzte Absicherung gegen parallele Doppelimporte. Ausgehende Nachrichten verwenden einen stabilen, vom Draft abgeleiteten Schlüssel und erhalten beim Transport eine neue Message-ID.

## Parsing und HTML-Sicherheit

Der provider-neutrale Parser verarbeitet From, To, Cc, Subject, Date, Message-ID, In-Reply-To, References, Plaintext, HTML und Anhänge. Plaintext ist die primäre Darstellung. HTML wird serverseitig auf eine kleine Formatierungs-Allowlist reduziert. Scripts, Eventhandler, Styles, `iframe`, `object`, `embed`, JavaScript-URLs sowie Remote-/Tracking-Bilder werden nicht übernommen. Desk rendert kein unsaniertes E-Mail-HTML.

## Originalnachricht und Anhänge

Die unveränderte Nachricht wird als `ORIGINAL_MESSAGE` (`.eml`) im vorhandenen Storage gespeichert, nicht als Base64 in der Datenbank. Anhänge verwenden `CommunicationAttachment`, sichere Dateinamen, MIME-/Endungs-Allowlist, SHA-256, maximal zehn Dateien und 10 MB je Datei. Downloads laufen über den bestehenden tenant- und ticketgeprüften Desk-Download. Ausführbare Inhalte sind nicht zugelassen.

## Ausgehender Flow

```text
serverseitiger Draft
  → Restriction-/Kontaktpräferenz-/MailAccount-Prüfung
  → persistenter OutboundMailJob
  → provider-neutraler Transport (P1: MOCK/Log)
  → MailMessage PENDING → SENT oder FAILED
  → MailDraft QUEUED → SENT
  → ActivityEvent
```

Entwürfe sind serverseitig, versioniert und enthalten Empfänger, Cc, Betreff, Plaintext, optional saniertes HTML und sichere Attachments. `In-Reply-To` und `References` werden serverseitig aus dem Thread gebildet. Interne Notizen bleiben `CommunicationDirection.INTERNAL` und gelangen nie in die Outbound-Queue.

## Queue, Retry, Delivery und Rate Limits

Jobs sind persistent. Der Worker-Lauf sperrt den Job logisch, zählt Versuche und plant bei Fehlern einen begrenzten exponentiellen Backoff bis maximal drei Versuche. Status sind `QUEUED`, `PROCESSING`, `SENT`, `FAILED`, `RETRY`, `CANCELLED`; Nachrichten unterscheiden `PENDING`, `SENT`, `DELIVERED`, `BOUNCED`, `FAILED`. Das accountbezogene Feld `outboundRateLimit` bildet spätere Providerlimits ab. Bounce-Webhooks kommen erst mit einem Provideradapter; das Modell kann dann Zustellstatus aktualisieren, ohne Party-Stammdaten automatisch zu verändern.

## Mailkonten, Credentials und Providervertrag

`MailAccount` enthält nur öffentliche Konfiguration. SMTP-/IMAP-Credentials liegen getrennt in `MailAccountCredential` und werden mit AES-256-GCM sowie `APP_SECRET_ENCRYPTION_KEY` authentifiziert verschlüsselt. Secret, Refresh-/Access-Tokens oder Kennwörter werden weder an Browser noch Activity/Logs ausgeliefert. Ohne Key und Credentials startet die Anwendung weiterhin; ein generisches Konto bleibt kontrolliert `NOT_CONFIGURED`. P1 öffnet keine produktive Providerverbindung.

Ein späterer Adapter implementiert mindestens Connection-Test, normalisierten Inbound-Import, Versand mit Message-ID/Provider-ID und später Delivery-/Bounce-Ereignisse. Er darf keine fachliche Zuordnung treffen, Tenant-Kontext ableiten oder die `CommunicationEvent`-Historie umgehen.

## Signaturen, Antwortvorlagen und Präferenzen

Tenant- und optionale Usersignaturen werden serverseitig ergänzt; HTML wird saniert. Tenantgebundene, aktive `DeskCannedResponse`-Datensätze unterstützen manuell ausgewählte Antworten, aber keinen automatischen Versand. `EMAIL_ALLOWED`, `EMAIL_BLOCKED` und `UNKNOWN` bereiten Kontaktpräferenzen vor. Eine aktive `processingRestrictedAt`-Einschränkung hat Vorrang: Draft ja, Queue/Versand nein.

## Loop Protection

`Auto-Submitted`, `Precedence` und `X-Auto-Response-Suppress` werden als Metadaten erfasst. Eigene Message-IDs sind über Idempotenz/Threading bekannt. P1 versendet nie automatisch eine Antwort; ein späterer Auto-Responder muss diese Felder zwingend auswerten.

## Audit, RBAC und Tenant-Isolation

Import, Ticketerzeugung, Reviewauflösung, Draft-Erstellung/-Änderung, Queue, Versand, Fehler, Attachment-Import und Gelesen-Markierung werden ohne Body-/Secretinhalt auditiert. Bestehende `desk:read`, `desk:manage` und `desk:assign` bleiben maßgeblich; es entstehen keine parallelen Mailpermissions. Jeder Querypfad prüft den aktiven Tenant, und manuelle Review-Ziele werden erneut tenantgebunden validiert.

## DSGVO und Aufbewahrungsinventar

Der bestehende Access-Export enthält relevante `CommunicationEvent`s sowie Mailmetadaten und Attachment-Metadaten, jedoch keine MailAccount-Credentials, Storage-Bytes oder Encryptiondaten. Roh-.eml wird nur als vorhandene Archivdatei ausgewiesen und nicht in JSON eingebettet. Für die manuelle Erasure-/Retention-Prüfung gehört Desk Mail zur Kategorie `COMMUNICATIONS`; getrennt zu bewerten sind Nachrichtenmetadaten, Body, Attachments, Roh-.eml und Deliverylogs. P1 löscht davon nichts automatisch.

## Bestehender Dokumentversand

Die vorhandene `DocumentDelivery`-E-Mail-Logik und `MAIL_TRANSPORT=log` für Consumer-/Business-Zahlungsaufforderungen bleiben unverändert. Sie werden nicht automatisch auf Desk Mail umgestellt.

## Produktionseinführung

Vor einem produktiven Adapter sind Providerwahl, Inbound-Signatur/Authentisierung, Workerbetrieb, Monitoring, Dead-Letter-Behandlung, Virenscan, Retentionregeln und Bounce-Verarbeitung festzulegen. Zusätzlich müssen Absenderdomains mit SPF, DKIM und DMARC korrekt eingerichtet und kontrolliert ausgerollt werden.
