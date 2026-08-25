"use client";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { useParams } from "next/navigation";
import * as React from "react";
import { PartyDialog } from "@/components/parties/party-dialog";
import { type PartyDetail } from "@/components/parties/party-api";
import { Button } from "@/components/ui/button";
import { PortalPreviewButton } from "@/components/portal/portal-preview-button";
const API = "/api";
type Party = {
  displayName: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  person: {
    salutation: string | null;
    title: string | null;
    firstName: string;
    lastName: string;
    birthDate: string | null;
  } | null;
  company: {
    companyName: string;
    legalForm: string | null;
    vatId: string | null;
    taxNumber: string | null;
    commercialRegister: string | null;
    registerNumber: string | null;
  } | null;
  roles: { role: string }[];
  addresses: {
    street: string;
    houseNumber: string | null;
    postalCode: string;
    city: string;
    country: string;
    isPrimary: boolean;
  }[];
  contacts: { type: string; value: string; label: string | null; isPrimary: boolean }[];
};
export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [party, setParty] = React.useState<Party | null>(null);
  const [error, setError] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  React.useEffect(() => {
    void fetch(`${API}/parties/${id}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Partei wurde nicht gefunden.");
        setParty(await response.json());
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Partei konnte nicht geladen werden."),
      );
  }, [id]);
  if (error) return <p className="text-destructive">{error}</p>;
  if (!party) return <p className="text-muted-foreground">Partei wird geladen …</p>;
  const profile: [string, string | null | undefined][] = party.person
    ? [
        ["Anrede", party.person.salutation],
        ["Titel", party.person.title],
        ["Vorname", party.person.firstName],
        ["Nachname", party.person.lastName],
        ["Geburtsdatum", party.person.birthDate],
      ]
    : [
        ["Firmenname", party.company?.companyName],
        ["Rechtsform", party.company?.legalForm],
        ["USt-ID", party.company?.vatId],
        ["Steuernummer", party.company?.taxNumber],
        ["Handelsregister", party.company?.commercialRegister],
        ["Registernummer", party.company?.registerNumber],
      ];
  return (
    <section className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        href="/parteien"
      >
        <ArrowLeft className="size-4" /> Parteien
      </Link>
      <header>
        <p className="text-sm font-medium text-primary">payveo · Arbeitsbereich</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {party.displayName}
        </h2>
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {party.type === "PERSON" ? "Person" : "Unternehmen"} ·{" "}
            {party.deletedAt ? "Gelöscht" : "Aktiv"}
          </p>
          <Button onClick={() => setEditOpen(true)} variant="outline">
            <Pencil className="size-4" /> Bearbeiten
          </Button>
          {party.roles.some((role) => role.role === "CLIENT") ? <PortalPreviewButton id={id} kind="client" label="Mandantenportal öffnen" /> : null}
          {party.roles.some((role) => role.role === "DEBTOR") ? <PortalPreviewButton id={id} kind="debtor" label="Schuldnerportal öffnen" /> : null}
        </div>
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Stammdaten">
          {profile.map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
        </Section>
        <Section title="Rollen">
          {party.roles.map((role) => (
            <span
              className="mr-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
              key={role.role}
            >
              {role.role}
            </span>
          ))}
        </Section>
        <Section title="Anschriften">
          {party.addresses.map((address, index) => (
            <p className="text-sm" key={`${address.street}-${index}`}>
              {address.isPrimary ? "Primär · " : ""}
              {address.street} {address.houseNumber}, {address.postalCode} {address.city},{" "}
              {address.country}
            </p>
          ))}
        </Section>
        <Section title="Kontakt">
          {party.contacts.map((contact) => (
            <p className="text-sm" key={`${contact.type}-${contact.value}`}>
              {contact.isPrimary ? "Primär · " : ""}
              {contact.type}: {contact.value}
            </p>
          ))}
        </Section>
        <Section title="Metadaten">
          <Row
            label="Angelegt"
            value={new Intl.DateTimeFormat("de-DE").format(new Date(party.createdAt))}
          />
          <Row
            label="Aktualisiert"
            value={new Intl.DateTimeFormat("de-DE").format(new Date(party.updatedAt))}
          />
        </Section>
      </div>
      <PartyDialog
        onOpenChange={setEditOpen}
        onSaved={(updated) => setParty(updated as unknown as Party)}
        open={editOpen}
        party={party as unknown as PartyDetail}
      />
    </section>
  );
}
function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <article className="rounded-xl border bg-card p-6 shadow-sm">
      <h3 className="mb-4 font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </article>
  );
}
function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}
