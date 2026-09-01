"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { staffAuthApi, type StaffSession } from "@/lib/staff-auth-api";

export function StaffProfile() {
  const router = useRouter(); const [session, setSession] = React.useState<StaffSession | null>(null);
  React.useEffect(() => { void staffAuthApi.session().then(setSession).catch(() => undefined); }, []);
  const name = session?.user.displayName ?? session?.user.email ?? "Arbeitsbereich";
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <div className="flex items-center gap-2 border-l border-border pl-3"><div className="hidden text-right sm:block"><p className="max-w-36 truncate text-sm font-medium">{name}</p><p className="max-w-36 truncate text-xs text-muted-foreground">{session?.tenant.name ?? "Arbeitsbereich"}</p></div><div className="grid size-8 place-items-center rounded-full bg-muted text-xs font-semibold">{initials}</div><Button aria-label="Abmelden" onClick={() => void staffAuthApi.logout().finally(() => { router.replace("/"); router.refresh(); })} size="icon" title="Abmelden" variant="ghost"><LogOut className="size-4" /></Button></div>;
}
