import { Suspense } from "react";

import { ClientSubmissionsListPage } from "@/components/portal/client-submissions-page";

export default function Page() {
  return (
    <Suspense>
      <ClientSubmissionsListPage />
    </Suspense>
  );
}
