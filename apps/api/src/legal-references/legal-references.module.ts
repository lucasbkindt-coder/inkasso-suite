import { Module } from "@nestjs/common";

import { CoreModule } from "../core/core.module";
import { LegalReferencesController } from "./legal-references.controller";
import { LegalReferencesService } from "./legal-references.service";
import { LegalReferenceSyncService } from "./legal-reference-sync.service";

@Module({
  imports: [CoreModule],
  controllers: [LegalReferencesController],
  providers: [LegalReferencesService, LegalReferenceSyncService],
  exports: [LegalReferenceSyncService],
})
export class LegalReferencesModule {}
