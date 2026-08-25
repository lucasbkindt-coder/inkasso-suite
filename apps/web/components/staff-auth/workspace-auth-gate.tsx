"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { staffAuthApi } from "@/lib/staff-auth-api";

export function WorkspaceAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const pathname = usePathname(); const [ready, setReady] = React.useState(false);
  React.useEffect(() => { void staffAuthApi.session().then((session) => { if (session.passwordMustChange) router.replace("/change-password"); else setReady(true); }).catch(() => router.replace(`/login?next=${encodeURIComponent(pathname)}`)); }, [pathname, router]);
  if (!ready) return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Arbeitsbereich wird geprüft …</main>;
  return <>{children}</>;
}
