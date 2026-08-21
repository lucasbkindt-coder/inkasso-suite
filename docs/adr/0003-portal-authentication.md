# Portal authentication foundation

## Status

Accepted

## Decision

`PortalAccount` is separate from `Party` and has exactly one record per
tenant, party and portal type. Activation and session secrets are random bearer
secrets; only SHA-256 hashes are persisted. Passwords use Argon2id hashes.
Internal preview tokens remain an independent, short-lived mechanism and are
not accepted as real portal sessions.

## Security controls

Login is limited to eight attempts per source IP and activation to six attempts
per source IP within one minute. Exceeding either threshold blocks that source
for fifteen minutes and returns HTTP 429. The in-memory throttle store is
appropriate for local development only; a shared store and monitoring are
required before horizontal production deployment.

State-changing portal authentication requests additionally require an Origin
matching the local origins or the configured RISEPAY_LAN_ORIGIN /
PORTAL_PUBLIC_BASE_URL. This complements SameSite=Lax cookies and the
same-origin Next.js /api proxy. It is intentionally not a replacement for a
full CSRF-token design if cross-site workflows are introduced later.

Cookies are HttpOnly, SameSite=Lax, path-scoped to /, server-validated and
revoked on logout. They are Secure when NODE_ENV=production; local HTTP and
LAN development therefore remain possible. Login creates a new random session,
so no pre-existing session token is reused.

There is no production deployment yet. PORTAL_PUBLIC_BASE_URL remains
configuration only (a later production value may be
https://portal.payveo.de). Before deployment behind nginx or Caddy, TLS must
be terminated correctly and Express must trust only the explicitly configured
reverse-proxy hops so client-IP rate limiting cannot be spoofed. No blanket
trust proxy setting is used locally.
