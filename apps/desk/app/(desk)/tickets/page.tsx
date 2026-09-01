import { Suspense } from "react";

import { TicketListView } from "@/components/ticket-list";

export default function TicketsPage() { return <Suspense fallback={<p className="text-sm text-muted-foreground">Tickets werden geladen …</p>}><TicketListView /></Suspense>; }
