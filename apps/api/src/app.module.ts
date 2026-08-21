import { Module } from "@nestjs/common";

import { CoreModule } from "./core/core.module";
import { CasesModule } from "./cases/cases.module";
import { CostsModule } from "./costs/costs.module";
import { DebtorsModule } from "./debtors/debtors.module";
import { LedgerModule } from "./ledger/ledger.module";
import { LegalReferencesModule } from "./legal-references/legal-references.module";
import { PartiesModule } from "./parties/parties.module";
import { DocumentsModule } from "./documents/documents.module";
import { TasksModule } from "./tasks/tasks.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { PortalPreviewModule } from "./portal-preview/portal-preview.module";
import { PortalModule } from "./portal/portal.module";
import { ClientSubmissionsModule } from "./client-submissions/client-submissions.module";
import { PortalAuthModule } from "./portal-auth/portal-auth.module";

@Module({
  imports: [
    CoreModule,
    DebtorsModule,
    PartiesModule,
    CasesModule,
    LedgerModule,
    LegalReferencesModule,
    CostsModule,
    DocumentsModule,
    TasksModule,
    DashboardModule,
    PortalPreviewModule,
    PortalModule,
    ClientSubmissionsModule,
    PortalAuthModule,
  ],
})
export class AppModule {}
