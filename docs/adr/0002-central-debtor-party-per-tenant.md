# Central debtor party per tenant

## Status

Accepted

## Decision

`Party` is the central debtor master record within a tenant. A `Case` is a
separate collection matter and references its `debtorPartyId`; it does not own
or duplicate debtor master data. Therefore several cases for different CLIENT
parties may reference the same active DEBTOR party in the same tenant.

Candidate matching is an internal decision aid only. `STRONG` means exact,
comparison-normalized identity attributes (person: first name, last name and
complete address; company: company name and complete address). It never merges
or changes parties automatically. A deliberate new record despite a STRONG
candidate requires a confirmation and a reason, which are retained on the
source `ClientSubmission` with the candidate IDs and timestamp.

## Consequences

- A new claim or a different client does not by itself justify a new DEBTOR
  party.
- Existing parties remain unchanged when selected for an acceptance.
- The later authenticated membership identity can be added to the existing
  review/audit context; no authentication identity is inferred in development.
