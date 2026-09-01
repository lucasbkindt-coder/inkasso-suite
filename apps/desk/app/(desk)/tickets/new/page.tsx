import { Suspense } from "react";

import { TicketCreateView } from "@/components/ticket-create";

export default function NewTicketPage() { return <Suspense fallback={<p className="text-sm text-muted-foreground">Formular wird geladen …</p>}><TicketCreateView /></Suspense>; }
