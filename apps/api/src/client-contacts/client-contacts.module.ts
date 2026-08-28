import { Module } from "@nestjs/common";

import { CoreModule } from "../core/core.module";
import { PortalAuthModule } from "../portal-auth/portal-auth.module";
import { ClientContactsController } from "./client-contacts.controller";
import { ClientContactsService } from "./client-contacts.service";

@Module({ imports: [CoreModule, PortalAuthModule], controllers: [ClientContactsController], providers: [ClientContactsService] })
export class ClientContactsModule {}
