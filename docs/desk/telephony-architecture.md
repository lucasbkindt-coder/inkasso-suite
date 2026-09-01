# Desk-Telefonie – spätere Architektur

P0 enthält keine SIP-Verbindung, keine Zugangsdaten, keine Aufzeichnung und keine CTI-Automatik. Vor einer Implementierung müssen Provider, Datenschutz, Einwilligung, Aufbewahrung und Notrufanforderungen geklärt werden.

## Variante A: WebRTC beim SIP-Provider

```text
Browser
  → WebRTC / SIP over WSS
  → SIP-Provider
```

Der Provider stellt eine browserfähige Signalisierung und Medienverbindung bereit. Kurzlebige Zugangsdaten müssten serverseitig ausgegeben werden; dauerhafte SIP-Credentials gehören niemals in den Browser. CommunicationEvents würden erst nach einem bestätigten Gespräch serverseitig geschrieben.

## Variante B: klassisches SIP über payveo Gateway

```text
Browser
  → WebRTC
  → payveo SIP Gateway / PBX / SBC
  → klassischer SIP-Provider
```

Ein kontrolliertes Gateway übersetzt WebRTC in klassisches SIP und übernimmt Netzwerk-, Authentifizierungs- und Medienregeln. Diese Variante erhöht Betriebs- und Sicherheitsaufwand, ermöglicht aber Providerunabhängigkeit und zentrale Richtlinien.

Es wird in P0 weder ein Anbieter festgelegt noch ein Credential-Modell geschaffen.
