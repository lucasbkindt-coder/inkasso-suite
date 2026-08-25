import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { EnforcementController } from "./enforcement.controller";
import { EnforcementService } from "./enforcement.service";

@Module({ imports: [CoreModule], controllers: [EnforcementController], providers: [EnforcementService] })
export class EnforcementModule {}
