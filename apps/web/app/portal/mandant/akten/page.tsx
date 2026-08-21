import { Suspense } from "react";
import { ClientPortal } from "@/components/portal/portal-page";
export default function Page() {
  return (
    <Suspense>
      <ClientPortal view="cases" />
    </Suspense>
  );
}
