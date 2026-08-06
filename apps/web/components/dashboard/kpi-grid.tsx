import { KpiCard } from "./kpi-card";

const kpis = [
  {
    title: "Offene Inkassoakten",
    value: "326",
    subtitle: "+12 seit gestern",
  },
  {
    title: "Offene Forderungen",
    value: "2.843.218 €",
    subtitle: "Gesamtvolumen",
  },
  {
    title: "Zahlungseingänge heute",
    value: "14",
    subtitle: "Noch nicht verbucht",
  },
  {
    title: "Wiedervorlagen",
    value: "22",
    subtitle: "5 überfällig",
  },
];

export function KpiGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          subtitle={kpi.subtitle}
        />
      ))}
    </div>
  );
}