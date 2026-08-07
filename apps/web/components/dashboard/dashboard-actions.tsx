import { FolderPlus, Users } from "lucide-react";
import Link from "next/link";

const actions = [
  { title: "Neue Akte", href: "/akten", icon: FolderPlus },
  { title: "Schuldner anlegen", href: "/schuldner", icon: Users },
];

export function DashboardActions() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-semibold">Schnellaktionen</h2>
      <div className="grid gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              className="flex items-center gap-4 rounded-xl border p-4 transition hover:bg-muted hover:shadow-md"
              href={action.href}
              key={action.title}
            >
              <div className="rounded-xl bg-primary/10 p-3">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium">{action.title}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
