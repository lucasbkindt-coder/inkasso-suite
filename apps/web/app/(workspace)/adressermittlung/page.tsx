import { AddressResearchPanel } from "@/components/address-research/address-research-panel";

export default function AddressResearchPage() {
  return <div className="space-y-6"><header><p className="text-sm font-medium text-primary">payveo · Arbeitsbereich</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Adressermittlung</h2><p className="mt-2 text-sm text-muted-foreground">Offene Adressrecherchen und Ergebnisse tenantgebunden prüfen.</p></header><AddressResearchPanel /></div>;
}
