# SIP-Provideranforderungen für payveo Desk

Status: Foundation P1, noch keine Providerentscheidung und keine produktiven Zugangsdaten.

Vor der Anbindung eines Telefonieanbieters werden folgende Angaben und Fähigkeiten benötigt:

- SIP Registrar und SIP Proxy
- Benutzername, Passwort und gegebenenfalls separate Auth-ID
- SIP Domain und Ports
- unterstützte Transporte: UDP, TCP und insbesondere TLS
- SIP over WebSocket (WSS): Verfügbarkeit und WSS-URL
- native WebRTC-Unterstützung
- Medienverschlüsselung über DTLS-SRTP beziehungsweise SRTP
- unterstützte Codecs (mindestens genaue Liste und Priorisierung)
- STUN-/TURN-Anforderungen, URLs und Credential-Verfahren
- eingehende Rufnummern (DID)
- erlaubte ausgehende Caller IDs sowie CLIP/CLIR-Verhalten
- maximale gleichzeitige Gespräche pro Account und Tenant
- Blind-/Rückfragetransfer und SIP-REFER-Unterstützung
- DTMF-Verfahren (RFC 2833/4733, SIP INFO, Inband)
- API-/SIP-Rate-Limits
- IP-Allowlisting, feste Quell-IP oder andere Netzrestriktionen
- Trunk-Modell gegenüber individuellen Nebenstellen/Accounts
- Provider-Call-ID und Ereignissemantik für idempotente Verarbeitung
- Failover-, Wartungs- und Statusschnittstellen

## Entscheidungsregel

`DIRECT_WEBRTC` ist nur zulässig, wenn der Anbieter WebRTC über WSS und verschlüsselte Medien vollständig unterstützt und ein kurzlebiges, browsergeeignetes Credential-Verfahren anbietet. Dauerhafte SIP-Passwörter werden nicht an Browser ausgeliefert.

Fehlt eine dieser Voraussetzungen, wird `GATEWAY_REQUIRED` verwendet. `MOCK` bleibt ausschließlich Entwicklungs- und Testmodus.

## Noch benötigte Providerdaten

Für den nächsten Integrationsschritt sind die obigen technischen Werte, ein Test-DID, getrennte Test-Nebenstellen, die genaue TLS-/WSS-Zertifikatskette und die Dokumentation der Call-/Registration-Events erforderlich. Secrets werden ausschließlich über serverseitige Secret-Konfiguration übergeben.
