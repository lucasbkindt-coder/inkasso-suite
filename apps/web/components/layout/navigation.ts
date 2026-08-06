import {
  BadgeEuro,
  Building2,
  Files,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  WalletCards,
} from "lucide-react";

export const navigationGroups = [
  {
    label: "Arbeitsbereich",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/schuldner", label: "Schuldner", icon: Users },
      { href: "/forderungen", label: "Forderungen", icon: BadgeEuro },
      { href: "/zahlungen", label: "Zahlungen", icon: WalletCards },
      { href: "/dokumente", label: "Dokumente", icon: Files },
    ],
  },
  {
    label: "Verwaltung",
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
  "/schuldner": "Schuldner",
  "/mandanten": "Mandanten",
  "/forderungen": "Forderungen",
  "/zahlungen": "Zahlungen",
  "/dokumente": "Dokumente",
  "/benutzer": "Benutzer",
  "/teams": "Teams",
  "/rollen": "Rollen",
  "/einstellungen": "Einstellungen",
};
