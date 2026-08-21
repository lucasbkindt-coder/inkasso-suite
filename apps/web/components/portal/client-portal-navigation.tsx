import { FilePlus2, FolderKanban, LayoutDashboard, ListPlus } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const items = [
  { href: "/portal/mandant", label: "Übersicht", icon: LayoutDashboard, exact: true },
  { href: "/portal/mandant/akten", label: "Inkassoakten", icon: FolderKanban },
  { href: "/portal/mandant/auftraege", label: "Aufträge", icon: FilePlus2 },
  { href: "/portal/mandant/auftraege/neu", label: "Neuer Auftrag", icon: ListPlus },
] as const;

export function ClientPortalNavigation({ pathname, token }: { pathname: string; token: string }) {
  return (
    <nav aria-label="Mandantenportal-Navigation" className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-8">
        {items.map((item) => {
          const active = ("exact" in item && item.exact)
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              href={`${item.href}?preview=${encodeURIComponent(token)}`}
              key={item.href}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
