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
import { CommunicationsModule } from "./communications/communications.module";
import { PortalAuthModule } from "./portal-auth/portal-auth.module";
import { InstallmentRequestsModule } from "./installment-requests/installment-requests.module";
import { InstallmentPlansModule } from "./installment-plans/installment-plans.module";
import { StaffAuthModule } from "./staff-auth/staff-auth.module";
import { ActivityModule } from "./activity/activity.module";
import { EnforcementModule } from "./enforcement/enforcement.module";
import { HealthModule } from "./health/health.module";
import { ClientContactsModule } from "./client-contacts/client-contacts.module";
import { DataSubjectRequestsModule } from "./data-subject-requests/data-subject-requests.module";
import { BankImportsModule } from "./bank-imports/bank-imports.module";

@Module({
  imports: [
    CoreModule,
    HealthModule,
    ActivityModule,
    EnforcementModule,
    StaffAuthModule,
    DebtorsModule,
    PartiesModule,
    ClientContactsModule,
    DataSubjectRequestsModule,
    BankImportsModule,
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
    CommunicationsModule,
    PortalAuthModule,
    InstallmentRequestsModule,
    InstallmentPlansModule,
  ],
})
export class AppModule {}
