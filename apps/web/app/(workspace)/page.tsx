import {
  Activity,
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  FileWarning,
  Users,
} from "lucide-react";

const stats = [
  {
    title: "Offene Akten",
    value: "148",
    change: "+12",
    icon: FileWarning,
  },
  {
    title: "Forderungsvolumen",
    value: "487.235 €",
    change: "+8 %",
    icon: CircleDollarSign,
  },
  {
    title: "Aktive Schuldner",
    value: "321",
    change: "+4",
    icon: Users,
  },
  {
    title: "Wiedervorlagen",
    value: "18",
    change: "Heute",
    icon: Clock3,
  },
];

const activities = [
  {
    title: "Neue Akte angelegt",
    text: "0000007/2026 · Muster GmbH",
  },
  {
    title: "Zahlung eingegangen",
    text: "1.248,53 €",
  },
  {
    title: "Mahnung erstellt",
    text: "0000003/2026",
  },
  {
    title: "E-Mail versendet",
    text: "Max Mustermann",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          Willkommen zurück
        </p>

        <h1 className="text-4xl font-bold tracking-tight">
          Dashboard
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {item.title}
                  </p>

                  <h2 className="mt-3 text-3xl font-bold">
                    {item.value}
                  </h2>

                  <p className="mt-2 text-sm text-emerald-600">
                    {item.change}
                  </p>
                </div>

                <div className="rounded-xl bg-primary/10 p-3">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border bg-card p-6 xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Forderungsentwicklung
            </h2>

            <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex h-72 items-end gap-4">
            {[30, 45, 50, 80, 60, 95, 120].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-xl bg-primary transition hover:opacity-80"
                style={{ height: `${h * 2}px` }}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-6 text-xl font-semibold">
            Letzte Aktivitäten
          </h2>

          <div className="space-y-5">
            {activities.map((item) => (
              <div
                key={item.title}
                className="flex gap-4"
              >
                <div className="mt-1 rounded-full bg-primary/10 p-2">
                  <Activity className="h-4 w-4 text-primary" />
                </div>

                <div>
                  <p className="font-medium">
                    {item.title}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}