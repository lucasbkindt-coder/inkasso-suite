import { Briefcase, CalendarClock, Euro, Wallet } from "lucide-react";

import { DashboardCard } from "./dashboard-card";

export function DashboardKpis() {
  return (
    <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <DashboardCard
        title="Forderungsvolumen"
        value="4.825.350 €"
        subtitle="+3,8 % zum Vormonat"
        icon={Euro}
        iconColor="text-emerald-600"
      />

      <DashboardCard
        title="Offene Akten"
        value="148"
        subtitle="12 neue diese Woche"
        icon={Briefcase}
        iconColor="text-blue-600"
      />

      <DashboardCard
        title="Zahlungseingänge"
        value="18.450 €"
        subtitle="Heute"
        icon={Wallet}
        iconColor="text-violet-600"
      />

      <DashboardCard
        title="Wiedervorlagen"
        value="41"
        subtitle="7 überfällig"
        icon={CalendarClock}
        iconColor="text-orange-600"
      />
    </section>
  );
}
