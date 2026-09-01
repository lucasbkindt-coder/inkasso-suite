import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { CreditReportingController } from "./credit-reporting.controller";
import { CreditReportingService } from "./credit-reporting.service";

@Module({ imports: [CoreModule], controllers: [CreditReportingController], providers: [CreditReportingService] })
export class CreditReportingModule {}
