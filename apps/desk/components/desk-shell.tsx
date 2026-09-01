"use client";

import { Headphones, Inbox, LayoutDashboard, LogOut, Moon, Plus, Sun, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";

import { staffAuthApi } from "@/lib/staff-auth-api";
import { DeskSessionContext } from "./desk-auth-gate";

const nav = [
  { label: "Übersicht", href: "/", icon: LayoutDashboard, view: null },
  { label: "Meine Tickets", href: "/tickets?mine=true", icon: UserRoundCheck, view: "mine" },
  { label: "Alle Tickets", href: "/tickets", icon: Inbox, view: "all" },
  { label: "Nicht zugewiesen", href: "/tickets?unassigned=true", icon: Inbox, view: "unassigned" },
] as const;

export function DeskShell({ children }: { children: React.ReactNode }) {
  const session = React.useContext(DeskSessionContext);
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const canManage = session?.permissions.includes("desk:manage") ?? false;

  async function logout() {
    await staffAuthApi.logout().catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  function active(view: (typeof nav)[number]["view"]) {
    if (view === null) return pathname === "/";
    if (pathname !== "/tickets") return false;
    if (view === "mine") return search.get("mine") === "true";
    if (view === "unassigned") return search.get("unassigned") === "true";
    return !search.get("mine") && !search.get("unassigned");
  }

  return <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_1fr]">
    <aside className="border-b bg-[#071d2b] text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-slate-800">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5"><span className="grid size-9 place-items-center rounded-xl bg-[#007FC5]"><Headphones className="size-5" /></span><div><p className="font-semibold tracking-tight">payveo Desk</p><p className="text-xs text-slate-400">Kommunikation</p></div></div>
      <nav className="flex gap-1 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-visible" aria-label="Desk-Navigation">{nav.map((item) => { const Icon=item.icon; return <Link className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active(item.view) ? "bg-white/12 text-white" : "text-slate-400 hover:bg-white/8 hover:text-white"}`} href={item.href} key={item.href}><Icon className="size-4" />{item.label}</Link>; })}</nav>
      <div className="hidden border-t border-white/10 p-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block"><p className="truncate text-sm font-medium">{session?.user.displayName ?? session?.user.email}</p><p className="truncate text-xs text-slate-400">{session?.tenant.name}</p></div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur sm:px-6"><div><p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">payveo</p><p className="text-sm font-semibold">Desk-Arbeitsbereich</p></div><div className="flex items-center gap-2">{canManage ? <Link className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground" href="/tickets/new"><Plus className="size-4" />Neues Ticket</Link> : null}<button aria-label="Darstellung wechseln" className="grid size-9 place-items-center rounded-lg border" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} type="button">{resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</button><button aria-label="Abmelden" className="grid size-9 place-items-center rounded-lg border" onClick={() => void logout()} type="button"><LogOut className="size-4" /></button></div></header>
      <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
