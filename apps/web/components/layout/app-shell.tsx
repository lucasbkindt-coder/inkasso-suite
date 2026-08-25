"use client";

import { Menu, Scale, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { StaffProfile } from "@/components/staff-auth/staff-profile";
import { Button } from "@/components/ui/button";
import { staffAuthApi } from "@/lib/staff-auth-api";
import { cn } from "@/lib/utils";

import { isNavigationItemActive, navigationGroups, resolvePageTitle } from "./navigation";

const navigationPermissions: Record<string, string[]> = {
  "/": ["report:read"],
  "/akten": ["case:read"],
  "/parteien": ["debtor:read"],
  "/schuldner": ["debtor:read"],
  "/aufgaben": ["case:read"],
  "/auftragseingang": ["case:read"],
  "/ratenanfragen": ["case:read"],
  "/mandanten": ["tenant:read"],
  "/benutzer": ["member:read"],
  "/teams": ["team:read"],
  "/rollen": ["role:read"],
  "/einstellungen": ["settings:read"],
};

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [permissions, setPermissions] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    let active = true;
    staffAuthApi.session().then((session) => {
      if (active) setPermissions(session.permissions);
    }).catch(() => {
      if (active) setPermissions([]);
    });
    return () => { active = false; };
  }, []);

  const groups = navigationGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions === null || (navigationPermissions[item.href] ?? []).every((permission) => permissions.includes(permission))),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Scale className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">payveo</p>
          <p className="text-xs text-muted-foreground">Arbeitsbereich</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Hauptnavigation">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = isNavigationItemActive(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                    )}
                    href={item.href}
                    key={item.href}
                    onClick={onNavigate}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/60 p-3">
          <div className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            IS
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">payveo</p>
            <p className="truncate text-xs text-muted-foreground">Arbeitsbereich</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileNavigationOpen, setMobileNavigationOpen] = React.useState(false);
  const pathname = usePathname();
  const title = resolvePageTitle(pathname);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <Sidebar />
      </div>

      {isMobileNavigationOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Navigation schließen"
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setMobileNavigationOpen(false)}
            type="button"
          />
          <div className="relative h-full w-72 shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <Button
                aria-label="Navigation schließen"
                onClick={() => setMobileNavigationOpen(false)}
                size="icon"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            </div>
            <Sidebar onNavigate={() => setMobileNavigationOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              aria-label="Navigation öffnen"
              className="lg:hidden"
              onClick={() => setMobileNavigationOpen(true)}
              size="icon"
              variant="ghost"
            >
              <Menu className="size-5" />
            </Button>
            <div>
              <p className="text-xs text-muted-foreground">payveo</p>
              <h1 className="text-base font-semibold tracking-tight">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <StaffProfile />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
