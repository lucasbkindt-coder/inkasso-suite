"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PartyDialog } from "./party-dialog";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";
type Party = {
  id: string;
  type: "PERSON" | "COMPANY";
  displayName: string;
  updatedAt: string;
  roles: { role: string }[];
  addresses: { city: string; isPrimary: boolean }[];
  contacts: { value: string; isPrimary: boolean }[];
};
type Result = { items: Party[]; meta: { total: number } };
export function PartiesClient() {
  const router = useRouter();
  const [data, setData] = React.useState<Result>({ items: [], meta: { total: 0 } });
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("");
  const [error, setError] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const load = React.useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter === "PERSON" || filter === "COMPANY") params.set("type", filter);
      if (["CLIENT", "DEBTOR"].includes(filter)) params.set("role", filter);
      const response = await fetch(`${API}/parties?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Parteien konnten nicht geladen werden.");
      setData(await response.json());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unbekannter Fehler");
    }
  }, [filter, search]);
  React.useEffect(() => {
    void load();
  }, [load]);
  const remove = async (party: Party) => {
    if (!window.confirm(`„${party.displayName}“ löschen?`)) return;
    const response = await fetch(`${API}/parties/${party.id}`, { method: "DELETE" });
    if (response.ok) void load();
    else setError("Partei konnte nicht gelöscht werden.");
  };
  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">payveo · Arbeitsbereich</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Parteien</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Auftraggeber, Schuldner und weitere Stammdaten verwalten.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> Neue Partei
        </Button>
      </div>
      <PartyDialog
        onOpenChange={setDialogOpen}
        onSaved={(party) => router.push(`/parteien/${party.id}`)}
        open={dialogOpen}
      />
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, Kontakt oder Ort suchen"
              value={search}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["", "Alle"],
              ["CLIENT", "Auftraggeber"],
              ["DEBTOR", "Schuldner"],
              ["PERSON", "Personen"],
              ["COMPANY", "Unternehmen"],
            ].map(([value, label]) => (
              <Button
                key={value}
                onClick={() => setFilter(value)}
                variant={filter === value ? "default" : "outline"}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        {error ? (
          <p className="p-4 text-sm text-destructive">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Typ</th>
                  <th className="px-4 py-3">Rollen</th>
                  <th className="px-4 py-3">Ort</th>
                  <th className="px-4 py-3">Kontakt</th>
                  <th className="px-4 py-3">Aktualisiert</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((party) => (
                  <tr className="border-b last:border-0" key={party.id}>
                    <td className="px-4 py-4 font-medium">
                      <Link href={`/parteien/${party.id}`}>{party.displayName}</Link>
                    </td>
                    <td className="px-4 py-4">
                      {party.type === "PERSON" ? "Person" : "Unternehmen"}
                    </td>
                    <td className="px-4 py-4">
                      {party.roles.map((role) => role.role).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-4">
                      {party.addresses.find((address) => address.isPrimary)?.city || "—"}
                    </td>
                    <td className="px-4 py-4">
                      {party.contacts.find((contact) => contact.isPrimary)?.value || "—"}
                    </td>
                    <td className="px-4 py-4">
                      {new Intl.DateTimeFormat("de-DE").format(new Date(party.updatedAt))}
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        aria-label="Partei löschen"
                        onClick={() => void remove(party)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
