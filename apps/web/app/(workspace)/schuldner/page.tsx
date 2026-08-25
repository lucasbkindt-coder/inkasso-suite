import { PartiesClient } from "@/components/parties/parties-client";

export default function DebtorsPage() {
  return <PartiesClient createLabel="Schuldner anlegen" description="Schuldner-Stammdaten im Arbeitsbereich verwalten." role="DEBTOR" title="Schuldner" />;
}
