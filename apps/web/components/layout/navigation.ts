import {
  Building2,
  Files,
  FolderKanban,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  WalletCards,
} from "lucide-react";

export const navigationGroups = [
  {
    label: "Übersicht",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Forderungsmanagement",
    items: [
      { href: "/akten", label: "Inkassoakten", icon: FolderKanban },
      { href: "/parteien", label: "Parteien", icon: UsersRound },
      { href: "/schuldner", label: "Schuldner", icon: Users },
      { href: "/zahlungen", label: "Zahlungen", icon: WalletCards },
      { href: "/dokumente", label: "Dokumente", icon: Files },
    ],
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
  "/": "Übersicht",
  "/akten": "Inkassoakten",
  "/schuldner": "Schuldner",
  "/parteien": "Parteien",
  "/mandanten": "Mandanten",
  "/zahlungen": "Zahlungen",
  "/dokumente": "Dokumente",
  "/benutzer": "Benutzer",
  "/teams": "Teams",
  "/rollen": "Rollen",
  "/einstellungen": "Einstellungen",
};
