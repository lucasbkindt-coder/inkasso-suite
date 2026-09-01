import {
  BadgeCheck,
  Building2,
  ContactRound,
  FolderKanban,
  HandCoins,
  Inbox,
  LayoutDashboard,
  Landmark,
  ListTodo,
  MapPinCheck,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

export const navigationGroups = [
  {
    label: "Arbeit",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/akten", label: "Inkassoakten", icon: FolderKanban },
      { href: "/aufgaben", label: "Aufgaben", icon: ListTodo },
      { href: "/auftragseingang", label: "Auftragseingang", icon: Inbox },
    ],
  },
  {
    label: "Parteien",
    items: [
      { href: "/parteien", label: "Parteien", icon: ContactRound },
      { href: "/mandanten", label: "Mandanten", icon: Building2 },
      { href: "/schuldner", label: "Schuldner", icon: Users },
    ],
  },
  {
    label: "Finanzen",
    items: [{ href: "/zahlungen/import", label: "Bankimport", icon: Landmark }],
  },
  {
    label: "Bearbeitung",
    items: [
      { href: "/ratenanfragen", label: "Ratenanfragen", icon: HandCoins },
      { href: "/adressermittlung", label: "Adressermittlung", icon: MapPinCheck },
      { href: "/auskunfteien", label: "Auskunfteien", icon: BadgeCheck },
    ],
  },
  {
    label: "Datenschutz",
    items: [{ href: "/datenschutz", label: "Datenschutz", icon: ShieldCheck }],
  },
  {
    label: "Verwaltung",
    items: [
      { href: "/benutzer", label: "Benutzer", icon: UserCog },
      { href: "/einstellungen", label: "Einstellungen", icon: Settings },
    ],
  },
] as const;

export const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/akten": "Inkassoakten",
  "/schuldner": "Schuldner",
  "/adressermittlung": "Adressermittlung",
  "/auskunfteien": "Auskunfteien",
  "/parteien": "Parteien",
  "/aufgaben": "Aufgaben",
  "/auftragseingang": "Auftragseingang",
  "/ratenanfragen": "Ratenanfragen",
  "/ratenplaene": "Ratenplan",
  "/mandanten": "Mandanten",
  "/zahlungen": "Zahlungen",
  "/zahlungen/import": "Bankimport",
  "/dokumente": "Dokumente",
  "/benutzer": "Benutzer",
  "/einstellungen": "Einstellungen",
  "/datenschutz": "Datenschutz",
};

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/ratenanfragen" && pathname.startsWith("/ratenplaene/")) return true;
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function resolvePageTitle(pathname: string) {
  if (pathname === "/") return pageTitles["/"];
  if (pathname.startsWith("/akten/")) return "Inkassoakte";
  if (pathname.startsWith("/parteien/")) return "Partei";
  if (pathname.startsWith("/schuldner/")) return "Schuldner";
  if (pathname.startsWith("/auftragseingang/")) return "Auftragseingang";
  if (pathname.startsWith("/ratenanfragen/")) return "Ratenanfrage";
  if (pathname.startsWith("/ratenplaene/")) return "Ratenplan";
  return pageTitles[pathname] ?? "Arbeitsbereich";
}
