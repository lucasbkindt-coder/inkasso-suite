import { Suspense } from "react";

import { ClientSubmissionDetailPage } from "@/components/portal/client-submissions-page";

export default function Page() {
  return (
    <Suspense>
      <ClientSubmissionDetailPage />
    </Suspense>
  );
}
