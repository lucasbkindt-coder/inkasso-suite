import { Suspense } from "react";
import { CallList } from "@/components/call-list";

export default function CallsPage() { return <Suspense fallback={<p className="text-sm text-muted-foreground">Anrufe werden geladen …</p>}><CallList /></Suspense>; }
