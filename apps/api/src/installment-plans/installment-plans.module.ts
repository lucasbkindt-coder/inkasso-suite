import { Module } from "@nestjs/common";

import { CoreModule } from "../core/core.module";
import { PortalAuthModule } from "../portal-auth/portal-auth.module";
import { InstallmentPlansController } from "./installment-plans.controller";
import { InstallmentPlansService } from "./installment-plans.service";

@Module({ imports: [CoreModule, PortalAuthModule], controllers: [InstallmentPlansController], providers: [InstallmentPlansService], exports: [InstallmentPlansService] })
export class InstallmentPlansModule {}
