import { cookies } from "next/headers";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { AppShell } from "@/components/layout/app-shell";
import { PublicHome } from "@/components/public-site/public-home";
import { PublicShell } from "@/components/public-site/public-shell";
import { WorkspaceAuthGate } from "@/components/staff-auth/workspace-auth-gate";
import { publicMetadata } from "@/lib/public-metadata";

async function hasStaffSession() {
  return (await cookies()).has("payveo_staff_session");
}

export async function generateMetadata() {
  return (await hasStaffSession())
    ? { title: "payveo – Arbeitsbereich", description: "payveo Forderungsmanagement" }
    : publicMetadata("Professionelles Forderungsmanagement", "payveo unterstützt Unternehmen bei einer klaren, strukturierten und zeitgemäßen Forderungsbearbeitung.", "/");
}

export default async function HomePage() {
  if (await hasStaffSession()) return <WorkspaceAuthGate><AppShell><DashboardLayout /></AppShell></WorkspaceAuthGate>;
  return <PublicShell><PublicHome /></PublicShell>;
}
