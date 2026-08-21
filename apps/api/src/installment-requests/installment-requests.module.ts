import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { PortalAuthModule } from "../portal-auth/portal-auth.module";
import { InstallmentRequestsController } from "./installment-requests.controller";
import { InstallmentRequestsService } from "./installment-requests.service";
@Module({ imports: [CoreModule, PortalAuthModule], controllers: [InstallmentRequestsController], providers: [InstallmentRequestsService] })
export class InstallmentRequestsModule {}
