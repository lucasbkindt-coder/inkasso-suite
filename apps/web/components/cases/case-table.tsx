// Placeholder complete replacement.
// NOTE: This is a minimal compilable version to restore the project.
// We can iterate on styling afterwards.

"use client";

import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { demoCases } from "./demo-data";

const statusClasses: Record<string, string> = {
  Neu: "bg-slate-100 text-slate-700",
  Außergerichtlich: "bg-blue-100 text-blue-700",
  Teilzahlung: "bg-amber-100 text-amber-700",
  Gerichtlich: "bg-red-100 text-red-700",
};

export function CaseTable() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return demoCases.filter(
      c =>
        c.fileNumber.toLowerCase().includes(q) ||
        c.client.toLowerCase().includes(q) ||
        c.debtor.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inkassoakten</h1>
          <p className="text-muted-foreground">
            Übersicht aller laufenden Inkassoverfahren
          </p>
        </div>

        <button className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-primary-foreground">
          <Plus className="h-4 w-4" />
          Neue Akte
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suchen..."
          className="w-full rounded-xl border py-3 pl-10 pr-4"
        />
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-4 text-left">Aktenzeichen</th>
              <th className="text-left">Auftraggeber</th>
              <th className="text-left">Schuldner</th>
              <th className="text-left">Forderung</th>
              <th className="text-left">Status</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((item) => (
              <tr key={item.fileNumber} className="border-t hover:bg-muted/40">
                <td className="p-4">
                  <Link href={`/akten/${item.fileNumber}`} className="font-semibold text-primary">
                    {item.fileNumber}
                  </Link>
                </td>
                <td>{item.client}</td>
                <td>{item.debtor}</td>
                <td className="font-semibold">{item.amount}</td>
                <td>
                  <span className={`rounded-full px-3 py-1 text-xs ${statusClasses[item.status] ?? ""}`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
