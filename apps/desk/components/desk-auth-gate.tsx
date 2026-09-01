"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { staffAuthApi, type StaffSession } from "@/lib/staff-auth-api";

export const DeskSessionContext = React.createContext<StaffSession | null>(null);

export function DeskAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = React.useState<StaffSession | null>(null);
  const [forbidden, setForbidden] = React.useState(false);

  React.useEffect(() => {
    void staffAuthApi.session().then((value) => {
      if (value.passwordMustChange) { router.replace("/change-password"); return; }
      if (!value.permissions.includes("desk:read")) { setForbidden(true); return; }
      setSession(value);
    }).catch(() => router.replace("/login"));
  }, [router]);

  if (forbidden) return <main className="grid min-h-screen place-items-center p-6"><section className="max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm"><h1 className="text-xl font-semibold">Kein Desk-Zugriff</h1><p className="mt-2 text-sm text-muted-foreground">Für diese Anwendung ist die Berechtigung desk:read erforderlich. Wechseln Sie zurück in den payveo Arbeitsbereich.</p></section></main>;
  if (!session) return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">Desk-Zugang wird geprüft …</main>;
  return <DeskSessionContext.Provider value={session}>{children}</DeskSessionContext.Provider>;
}
