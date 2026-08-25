import { PartiesClient } from "@/components/parties/parties-client";

export default function TenantsPage() {
  return <PartiesClient createLabel="Mandant anlegen" description="Auftraggeber und Mandanten im Arbeitsbereich verwalten." role="CLIENT" title="Mandanten" />;
}
