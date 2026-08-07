import { Module } from "@nestjs/common";

import { CoreModule } from "../core/core.module";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";

@Module({ imports: [CoreModule], controllers: [CasesController], providers: [CasesService] })
export class CasesModule {}
