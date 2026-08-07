import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module";
import { PartiesController } from "./parties.controller";
import { PartiesService } from "./parties.service";
@Module({ imports: [CoreModule], controllers: [PartiesController], providers: [PartiesService] })
export class PartiesModule {}
