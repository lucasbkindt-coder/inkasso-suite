type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

export function KpiCard({
  title,
  value,
  subtitle,
}: KpiCardProps) {
  return (
    <div className="rounded-2xl border bg-background p-6 shadow-sm transition-all hover:shadow-md">
      <p className="text-sm text-muted-foreground">
        {title}
      </p>

      <h2 className="mt-2 text-3xl font-bold tracking-tight">
        {value}
      </h2>

      {subtitle ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}