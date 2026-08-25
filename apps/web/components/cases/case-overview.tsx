import { Building2, Calendar, Mail, MapPin, Phone, User } from "lucide-react";

import type { Case, CaseParty } from "@/types/case";

import { formatCurrency, formatDate } from "./case-ui";

export function CaseOverview({ caseRecord }: { caseRecord: Case }) {
  const claim = caseRecord.claim;
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-semibold">Aktenübersicht</h2>
      <div className="grid gap-8 xl:grid-cols-3">
        <PartySection party={caseRecord.debtorParty} title="Schuldner" />
        <PartySection party={caseRecord.clientParty} title="Mandant" />
        <div>
          <h3 className="mb-4 font-semibold">Forderung</h3>
          <div className="space-y-3">
            <Info
              icon={<Building2 className="size-4" />}
              label="Auftraggeber"
              value={caseRecord.clientParty.displayName}
            />
            <Info
              icon={<Calendar className="size-4" />}
              label="Rechnungsnummer"
              value={claim?.invoiceNumber ?? "—"}
            />
            <Info
              icon={<Calendar className="size-4" />}
              label="Rechnungsdatum"
              value={formatDate(claim?.invoiceDate)}
            />
            <Info
              icon={<Calendar className="size-4" />}
              label="Fälligkeit"
              value={formatDate(claim?.dueDate)}
            />
            <Info
              icon={<Calendar className="size-4" />}
              label="Verzug"
              value={formatDate(claim?.defaultDate)}
            />
            <Info
              icon={<User className="size-4" />}
              label="Hauptforderung"
              value={claim ? formatCurrency(claim.principalAmount, claim.currency) : "—"}
            />
            <Info
              icon={<User className="size-4" />}
              label="Beschreibung"
              value={claim?.description || "—"}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PartySection({ party, title }: { party: CaseParty; title: string }) {
  const address = party.addresses[0];
  const phone = party.contacts.find((contact) => ["PHONE", "MOBILE"].includes(contact.type));
  const email = party.contacts.find((contact) => contact.type === "EMAIL");
  const addressText = address
    ? [address.street, address.houseNumber, address.postalCode, address.city]
        .filter(Boolean)
        .join(" · ")
    : "—";
  return (
    <div>
      <h3 className="mb-4 font-semibold">{title}</h3>
      <div className="space-y-3">
        <Info icon={<User className="size-4" />} label="Name" value={party.displayName} />
        <Info icon={<MapPin className="size-4" />} label="Adresse" value={addressText} />
        <Info icon={<Phone className="size-4" />} label="Telefon" value={phone?.value ?? "—"} />
        <Info icon={<Mail className="size-4" />} label="E-Mail" value={email?.value ?? "—"} />
      </div>
    </div>
  );
}
function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-xl border p-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
