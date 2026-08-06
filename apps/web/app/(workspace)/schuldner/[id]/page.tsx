"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
type Debtor = {
  type: "PERSON" | "COMPANY";
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
};

export default function DebtorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [debtor, setDebtor] = React.useState<Debtor | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    void fetch(`${API}/debtors/${id}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Schuldner wurde nicht gefunden.");
        setDebtor(await response.json());
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Schuldner konnte nicht geladen werden."),
      );
  }, [id]);
  const name =
    debtor?.type === "COMPANY"
      ? debtor.companyName
      : [debtor?.firstName, debtor?.lastName].filter(Boolean).join(" ");
  return (
    <section className="space-y-6">
      <Link
        className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-accent"
        href="/schuldner"
      >
        <ArrowLeft className="size-4" /> Zurück zur Liste
      </Link>
      {error ? (
        <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
      ) : !debtor ? (
        <p className="text-muted-foreground">Schuldner wird geladen …</p>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium text-primary">Schuldner</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {debtor.type === "COMPANY" ? "Unternehmen" : "Natürliche Person"}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail label="E-Mail" value={debtor.email} />
            <Detail label="Telefon" value={debtor.phone} />
            <Detail
              label="Adresse"
              value={[
                debtor.street,
                [debtor.postalCode, debtor.city].filter(Boolean).join(" "),
                debtor.country,
              ]
                .filter(Boolean)
                .join(", ")}
            />
          </div>
        </>
      )}
    </section>
  );
}
function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <article className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-medium">{value || "—"}</p>
    </article>
  );
}
