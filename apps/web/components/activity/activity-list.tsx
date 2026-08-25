"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

export type ActivityItem = {
  id: string;
  title: string;
  description: string | null;
  actor: string;
  createdAt: string;
};
type ActivityResponse = { items: ActivityItem[]; page: number; totalPages: number };

export function ActivityList({ load }: { load: (page: number) => Promise<ActivityResponse> }) {
  const [items, setItems] = React.useState<ActivityItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const fetchPage = React.useCallback(async (nextPage: number, append = false) => {
    setLoading(true);
    try {
      const response = await load(nextPage);
      setItems((current) => append ? [...current, ...response.items] : response.items);
      setPage(response.page);
      setTotalPages(response.totalPages);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aktivitäten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [load]);
  React.useEffect(() => { void fetchPage(1); }, [fetchPage]);
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">Aktivitäten</h2>
        <p className="mt-1 text-sm text-muted-foreground">Fachlich relevante Vorgänge dieser Arbeitsakte.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading && !items.length ? <p className="text-sm text-muted-foreground">Aktivitäten werden geladen …</p> : null}
      {!loading && !items.length ? <p className="text-sm text-muted-foreground">Noch keine Aktivitäten vorhanden.</p> : null}
      <ol className="space-y-0">
        {items.map((item) => (
          <li className="border-l border-border py-3 pl-4 last:pb-0" key={item.id}>
            <p className="text-sm font-medium">{item.title}</p>
            {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {item.actor} · {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
            </p>
          </li>
        ))}
      </ol>
      {page < totalPages ? <Button className="mt-5" disabled={loading} onClick={() => void fetchPage(page + 1, true)} variant="outline">Mehr laden</Button> : null}
    </section>
  );
}
