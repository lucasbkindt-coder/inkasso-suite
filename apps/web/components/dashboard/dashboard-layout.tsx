import { DashboardActions } from "./dashboard-actions";
import { DashboardActivity } from "./dashboard-activity";
import { DashboardChart } from "./dashboard-chart";
import { DashboardDeadlines } from "./dashboard-deadlines";
import { DashboardKpis } from "./dashboard-kpis";
import { DashboardLastPayments } from "./dashboard-last-payments";
import { DashboardTopDebtors } from "./dashboard-top-debtors";

export function DashboardLayout() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <header>
        <p className="text-sm font-medium text-primary">RisePay · Arbeitsbereich</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Überblick über Forderungen, Zahlungen und anstehende Aufgaben.
        </p>
      </header>
      <DashboardKpis />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DashboardChart />
        </div>
        <DashboardActions />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardActivity />
        <DashboardDeadlines />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardTopDebtors />
        <DashboardLastPayments />
      </div>
    </div>
  );
}
