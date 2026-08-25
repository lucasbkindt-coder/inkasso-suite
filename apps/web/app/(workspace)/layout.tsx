import { AppShell } from "@/components/layout/app-shell";
import { WorkspaceAuthGate } from "@/components/staff-auth/workspace-auth-gate";

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <WorkspaceAuthGate><AppShell>{children}</AppShell></WorkspaceAuthGate>;
}
