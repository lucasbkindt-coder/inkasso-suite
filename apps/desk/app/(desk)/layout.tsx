import { DeskAuthGate } from "@/components/desk-auth-gate";
import { DeskShell } from "@/components/desk-shell";

export default function DeskLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DeskAuthGate><DeskShell>{children}</DeskShell></DeskAuthGate>;
}
