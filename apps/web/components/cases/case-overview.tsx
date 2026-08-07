"use client";

import {
  Building2,
  Calendar,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";

export function CaseOverview() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-lg">

      <h2 className="mb-6 text-xl font-semibold">
        Aktenübersicht
      </h2>

      <div className="grid gap-8 md:grid-cols-2">

        <div>

          <h3 className="mb-4 font-semibold">
            Schuldner
          </h3>

          <div className="space-y-4">

            <InfoRow
              icon={<User className="h-4 w-4" />}
              label="Name"
              value="Max Mustermann"
            />

            <InfoRow
              icon={<MapPin className="h-4 w-4" />}
              label="Adresse"
              value="Musterstraße 12 · 77652 Offenburg"
            />

            <InfoRow
              icon={<Phone className="h-4 w-4" />}
              label="Telefon"
              value="+49 781 123456"
            />

            <InfoRow
              icon={<Mail className="h-4 w-4" />}
              label="E-Mail"
              value="max.mustermann@example.de"
            />

          </div>

        </div>

        <div>

          <h3 className="mb-4 font-semibold">
            Forderung
          </h3>

          <div className="space-y-4">

            <InfoRow
              icon={<Building2 className="h-4 w-4" />}
              label="Gläubiger"
              value="RisePay GmbH"
            />

            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label="Fällig seit"
              value="14.03.2026"
            />

            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label="Verjährung"
              value="31.12.2029"
            />

            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label="Bearbeitungsstand"
              value="Außergerichtliches Mahnverfahren"
            />

          </div>

        </div>

      </div>

    </section>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-4 rounded-xl border p-4">

      <div className="mt-1 text-primary">
        {icon}
      </div>

      <div>

        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>

        <p className="mt-1 font-medium">
          {value}
        </p>

      </div>

    </div>
  );
}