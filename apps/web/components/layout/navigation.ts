import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";

export const navigationGroups = [
  {
    label: "Übersicht",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Forderungsmanagement",
    items: [
      { href: "/akten", label: "Inkassoakten", icon: FolderKanban },
      { href: "/parteien", label: "Parteien", icon: UsersRound },
      { href: "/schuldner", label: "Schuldner", icon: Users },
    ],
  },
  {
    label: "Arbeitsorganisation",
    items: [{ href: "/aufgaben", label: "Aufgaben & Fristen", icon: ListTodo }],
  },
  {
    label: "Administration",
    items: [
      { href: "/mandanten", label: "Mandanten", icon: Building2 },
      { href: "/benutzer", label: "Benutzer", icon: UsersRound },
      { href: "/teams", label: "Teams", icon: UsersRound },
      { href: "/rollen", label: "Rollen", icon: ShieldCheck },
      { href: "/einstellungen", label: "Einstellungen", icon: Settings },
    ],
  },
] as const;

export const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/akten": "Inkassoakten",
  "/schuldner": "Schuldner",
  "/parteien": "Parteien",
  "/aufgaben": "Aufgaben & Fristen",
  "/mandanten": "Mandanten",
  "/zahlungen": "Zahlungen",
  "/dokumente": "Dokumente",
  "/benutzer": "Benutzer",
  "/teams": "Teams",
  "/rollen": "Rollen",
  "/einstellungen": "Einstellungen",
};

export function isNavigationItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function resolvePageTitle(pathname: string) {
  if (pathname === "/") return pageTitles["/"];
  if (pathname.startsWith("/akten/")) return "Inkassoakte";
  if (pathname.startsWith("/parteien/")) return "Partei";
  if (pathname.startsWith("/schuldner/")) return "Schuldner";
  return pageTitles[pathname] ?? "Arbeitsbereich";
}
