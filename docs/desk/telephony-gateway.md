# Provider-neutrale Telefoniearchitektur

## Betriebsmodi

Direkter Modus:

`Browser → WebRTC über WSS + DTLS-SRTP → externer SIP/WebRTC-Provider`

Gateway-Modus:

`Browser → WebRTC über WSS + DTLS-SRTP → payveo SBC/PBX/Gateway → SIP/TLS + SRTP → externer SIP-Provider`

Die Foundation legt keine konkrete Gatewaysoftware fest. Auswahlkriterien sind sichere WebRTC-Terminierung, Mandantentrennung, kurzlebige Browser-Tokens, SIP-TLS/SRTP, HA, Metriken und ein nachvollziehbarer Eventkanal.

## Sicherheitsgrenzen

- Dauerhafte SIP- und TURN-Passwörter liegen AES-256-GCM-verschlüsselt ausschließlich serverseitig.
- API-Antworten liefern nur `credentialsConfigured`; Klartextwerte können gesetzt, ersetzt oder gelöscht, aber nie gelesen werden.
- Der Gateway-Modus liefert keine Providerpasswörter an Browser.
- Ein künftiger direkter Modus darf nur kurzlebige, eng begrenzte Provider-Tokens verwenden.
- Browsertelefonie benötigt Mikrofonfreigabe, WSS, ICE, STUN/TURN und DTLS-SRTP. Unverschlüsselte Medien sind ausgeschlossen.
- Telefonnummern und Providerpayloads werden nicht in allgemeinen Logs abgelegt.

## Accountauflösung

Jeder Mitarbeiter kann mehrere `StaffTelephonyAccount`-Datensätze besitzen. Effektive Verbindungsparameter werden je Feld aus dem Mitarbeiter-Override und anschließend dem Tenant-Default der `TelephonyProviderConfig` ermittelt. Credentials bleiben separat in `StaffTelephonyCredential`.

Calls referenzieren sowohl `agentMembershipId` als auch `staffTelephonyAccountId`. So bleiben Mitarbeiter, verwendete Nebenstelle und Providerkonfiguration revisionsfähig nachvollziehbar.

## Echtzeit und mehrere Tabs

Für Produktion ist ein tenant- und accountbezogener WebSocket- oder SSE-Kanal für eingehende Calls, Status, Presence und Screen-Pop erforderlich. `registrationSessionId` und `registrationSessionExpiresAt` bilden die Persistenzgrundlage für Session Ownership.

Vor einer echten SIP-Registrierung wird eine Leader-Election benötigt:

1. Ein Tab erwirbt serverseitig atomar die zeitlich begrenzte Account-Lease.
2. Nur der Lease-Inhaber registriert das SIP-Konto und sendet Heartbeats.
3. Weitere Tabs spiegeln Zustände über BroadcastChannel plus Serverevents, registrieren aber nicht erneut.
4. Bei Ablauf oder sauberer Freigabe darf ein anderer Tab übernehmen.

Der P1-MOCK führt keine Netzwerkregistrierung aus. Die gespeicherten Leasefelder dürfen daher noch nicht als produktive Sperre interpretiert werden.

## Normalisierte Events

Provideradapter bilden auf `INCOMING_CALL`, `OUTGOING_CALL`, `RINGING`, `ANSWERED`, `HELD`, `RESUMED`, `ENDED` und `FAILED` ab. Das UI kennt keine providerspezifischen Zustände. Die eindeutige Kombination aus Tenant, Providerkonfiguration und `providerCallId` verhindert doppelte Calls.

## Kommunikation und Datenschutz

Beendete sowie verpasste Calls erzeugen genau ein `CommunicationEvent` mit Kanal `PHONE`. Party, Case und Ticket bleiben die führenden Fachobjekte. Call-Metadaten fließen in den DSGVO-Auskunftssnapshot und in die bestehende Erasure-Inventur ein; eine automatische Löschung wird nicht vorgenommen.

Gesprächsaufzeichnung ist ausdrücklich nicht implementiert. Sie erfordert vor einer späteren Umsetzung eine separate rechtliche Prüfung, Hinweis-/Einwilligungslogik, Retention Policy, verschlüsselten Storage, eigene Zugriffsrechte sowie Regeln für Auskunft und Löschung.
