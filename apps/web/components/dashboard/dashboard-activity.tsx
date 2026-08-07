import { FileText, FolderOpen, Phone, Wallet } from "lucide-react";

const activities = [
  {
    id: 1,
    icon: Wallet,
    title: "Zahlung verbucht",
    description: "750,00 € von Max Mustermann",
    time: "vor 12 Minuten",
    color: "text-emerald-600",
  },
  {
    id: 2,
    icon: FolderOpen,
    title: "Neue Akte angelegt",
    description: "AKT-2026-000149",
    time: "vor 25 Minuten",
    color: "text-blue-600",
  },
  {
    id: 3,
    icon: FileText,
    title: "Mahnung erstellt",
    description: "Mahnstufe 1 erzeugt",
    time: "vor 1 Stunde",
    color: "text-orange-600",
  },
  {
    id: 4,
    icon: Phone,
    title: "Telefonnotiz",
    description: "Schuldner telefonisch erreicht",
    time: "vor 2 Stunden",
    color: "text-violet-600",
  },
];

export function DashboardActivity() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Letzte Aktivitäten</h2>

        <p className="text-sm text-muted-foreground">Die neuesten Ereignisse im System</p>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = activity.icon;

          return (
            <div
              key={activity.id}
              className="flex items-start gap-4 rounded-xl border p-4 transition hover:bg-muted/40"
            >
              <div className="rounded-xl bg-muted p-3">
                <Icon className={`h-5 w-5 ${activity.color}`} />
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{activity.title}</h3>

                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
