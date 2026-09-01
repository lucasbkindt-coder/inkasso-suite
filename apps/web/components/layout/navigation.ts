import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  Landmark,
  ListTodo,
  MapPinCheck,
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
      { href: "/adressermittlung", label: "Adressermittlung", icon: MapPinCheck },
      { href: "/zahlungen/import", label: "Bankimport", icon: Landmark },
    ],
  },
  {
    label: "Arbeitsorganisation",
    items: [
      { href: "/aufgaben", label: "Aufgaben & Fristen", icon: ListTodo },
      { href: "/auftragseingang", label: "Auftragseingang", icon: FolderKanban },
      { href: "/ratenanfragen", label: "Ratenanfragen", icon: ListTodo },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/mandanten", label: "Mandanten", icon: Building2 },
      { href: "/benutzer", label: "Benutzer", icon: UsersRound },
      { href: "/einstellungen", label: "Einstellungen", icon: Settings },
      { href: "/datenschutz", label: "Datenschutz", icon: ShieldCheck },
    ],
  },
] as const;

export const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/akten": "Inkassoakten",
  "/schuldner": "Schuldner",
  "/adressermittlung": "Adressermittlung",
  "/parteien": "Parteien",
  "/aufgaben": "Aufgaben & Fristen",
  "/auftragseingang": "Auftragseingang",
  "/ratenanfragen": "Ratenanfragen",
  "/mandanten": "Mandanten",
  "/zahlungen": "Zahlungen",
  "/zahlungen/import": "Bankimport",
  "/dokumente": "Dokumente",
  "/benutzer": "Benutzer",
  "/einstellungen": "Einstellungen",
  "/datenschutz": "Datenschutz",
};

export function isNavigationItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function resolvePageTitle(pathname: string) {
  if (pathname === "/") return pageTitles["/"];
  if (pathname.startsWith("/akten/")) return "Inkassoakte";
  if (pathname.startsWith("/parteien/")) return "Partei";
  if (pathname.startsWith("/schuldner/")) return "Schuldner";
  if (pathname.startsWith("/auftragseingang/")) return "Auftragseingang";
  if (pathname.startsWith("/ratenanfragen/")) return "Ratenanfrage";
  return pageTitles[pathname] ?? "Arbeitsbereich";
}
