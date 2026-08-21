import { Suspense } from "react";

import { NewClientSubmissionPage } from "@/components/portal/client-submissions-page";

export default function Page() {
  return (
    <Suspense>
      <NewClientSubmissionPage />
    </Suspense>
  );
}
