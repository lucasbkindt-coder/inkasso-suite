import type { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
}

export function DashboardCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
}: DashboardCardProps) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight">{value}</h2>

          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="rounded-xl bg-muted p-3">
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}
