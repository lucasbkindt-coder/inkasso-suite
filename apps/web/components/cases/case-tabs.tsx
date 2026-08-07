"use client";

import { useState } from "react";
import { Clock3, FileText, NotebookPen, Wallet } from "lucide-react";

type Tab = "overview" | "documents" | "payments" | "history";

const tabs: {
  id: Tab;
  label: string;
  icon: React.ElementType;
}[] = [
  {
    id: "overview",
    label: "Übersicht",
    icon: NotebookPen,
  },
  {
    id: "documents",
    label: "Dokumente",
    icon: FileText,
  },
  {
    id: "payments",
    label: "Zahlungen",
    icon: Wallet,
  },
  {
    id: "history",
    label: "Historie",
    icon: Clock3,
  },
];

export function CaseTabs() {
  const [active, setActive] = useState<Tab>("overview");

  return (
    <div className="rounded-2xl border bg-card p-2 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                active === tab.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
